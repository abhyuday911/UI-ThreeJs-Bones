import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  3000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector("main").appendChild(renderer.domElement);

// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;

// Set up lighting
function setupLighting() {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
  directionalLight.position.set(10, 10, -50).normalize();
  scene.add(directionalLight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);
}

// Setup camera
function setupCamera() {
  camera.position.set(0, 50, 300);
  camera.lookAt(0, 0, 0);
  controls.update(); // Ensure controls sync with initial camera position
}

// Camera fitting function
function fitCameraToObject(objects, camera, controls) {
  const box = new THREE.Box3();
  objects.forEach((obj) => box.expandByObject(obj));

  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  const maxSize = Math.max(size.x, size.y, size.z);

  camera.position.set(center.x, -(center.y + maxSize), center.z);
  camera.lookAt(center);

  if (controls) {
    controls.target.set(center.x, center.y, center.z);
    controls.update();
  }
}

// Load STL models
const loadedMeshes = [];
function loadSTLModel(path, color) {
  new STLLoader().load(path, (geometry) => {
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    loadedMeshes.push(mesh);

    if (loadedMeshes.length === 2)
      fitCameraToObject(loadedMeshes, camera, controls);
  });
}

loadSTLModel("./Right_Femur.stl", 0xa0a0a0);
loadSTLModel("./Right_Tibia.stl", 0x00cc00);

// Landmark interaction setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const landmarks = new Map();
let isDragging = false;
let selectedLandmark = null;
let lastClickedRadio = null;

function createOrUpdateLandmark(position, name, color = 0xff0000) {
  const existingLandmark = landmarks.get(name);

  if (existingLandmark) {
    existingLandmark.position.copy(position);
  } else {
    const landmark = new THREE.Mesh(
      new THREE.SphereGeometry(2, 32, 32),
      new THREE.MeshStandardMaterial({ color })
    );
    landmark.name = name;
    landmark.position.copy(position);
    scene.add(landmark);
    landmarks.set(name, landmark);
  }
}

// Function to get the most recently clicked active radio button
function getActiveRadioButton(landmarks) {
  return lastClickedRadio ? lastClickedRadio.id : null;
}

// Function to update other radios and their corresponding landmarks
function updateRadioStyles(landmarks) {
  const radios = document.querySelectorAll(".landmarkRadioButton");

  radios.forEach((radio) => {
    // Skip the last clicked radio
    if (radio === lastClickedRadio) return;

    if (landmarks.has(radio.id)) {
      // If the radio's value is in landmarks, add the Tailwind class
      radio.classList.add("accent-slate-300");
      const landmark = landmarks.get(radio.id);
      if (landmark) {
        landmark.material.color.set(0x0000aa); // Blue for inactive landmark
      }
    } else {
      // Otherwise, uncheck it and remove the Tailwind class
      radio.checked = false;
      radio.classList.remove("accent-slate-300");
    }
  });
}

// Add a single event listener for radio button clicks
document.addEventListener("click", (event) => {
  const clickedElement = event.target;

  // Check if the clicked element is a radio button
  if (event.target.classList.contains("landmarkRadioButton")) {
    lastClickedRadio = clickedElement; // Update the last clicked radio button
    event.target.classList.remove("accent-slate-300");

    // Update other radios based on their presence in landmarks
    updateRadioStyles(landmarks);

    // If the clicked radio has a corresponding landmark, color it green
    if (landmarks.has(clickedElement.id)) {
      const landmark = landmarks.get(clickedElement.id);
      if (landmark) {
        landmark.material.color.set(0xff0000); // Red for the active landmark
      }
    }
  }
});

// Main interaction logic
window.addEventListener("click", (event) => {
  const activeRadio = getActiveRadioButton(landmarks);

  if (!activeRadio) return; // No active radio, skip
  if (landmarks.has(activeRadio)) return; // Landmark already exists, skip

  // Calculate mouse position and set up raycasting
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(loadedMeshes, true);
  if (intersects.length > 0) {
    const pointPosition = intersects[0].point;
    createOrUpdateLandmark(pointPosition, activeRadio);
  }
});

window.addEventListener("mousedown", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersectedLandmarks = Array.from(landmarks.values());
  const intersects = raycaster.intersectObjects(intersectedLandmarks, true);

  if (intersects.length > 0) {
    isDragging = true;
    selectedLandmark = intersects[0].object;
    controls.enabled = false; // Disable OrbitControls during dragging
  }
});

window.addEventListener("mousemove", (event) => {
  if (!isDragging || !selectedLandmark) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(loadedMeshes, true);
  if (intersects.length > 0) {
    const newPosition = intersects[0].point;

    // Update the 3D position of the landmark
    selectedLandmark.position.copy(newPosition);

    // Update the position in the landmarks map
    if (landmarks.has(selectedLandmark.id)) {
      const landmark = landmarks.get(selectedLandmark.id);
      landmark.position.copy(newPosition); // Sync position with the map
    }
  }
});

window.addEventListener("mouseup", () => {
  if (isDragging) {
    controls.enabled = true; // Re-enable OrbitControls after dragging
    isDragging = false;
    selectedLandmark = null;
  }
});

// Resize handling
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main initialization function
function init() {
  setupLighting();
  setupCamera();

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

init();
