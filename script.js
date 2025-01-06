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
  const loader = new STLLoader();
  loader.load(path, (geometry) => {
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    loadedMeshes.push(mesh);

    if (loadedMeshes.length === 2) {
      fitCameraToObject(loadedMeshes, camera, controls);
    }
  });
}

loadSTLModel("./Right_Femur.stl", 0xa0a0a0);
loadSTLModel("./Right_Tibia.stl", 0x00cc00);

// Interactivity with landmarks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const landmarks = new Map();

// Check the active radio button
let previouslyCheckedRadio = null; // To keep track of the last checked radio button

function getActiveRadioButton() {
  const radios = document.querySelectorAll(".landmarkRadioButton");
  let activeRadio = null;

  radios.forEach((radio) => {
    if (radio.checked) {
      activeRadio = radio; // Current active radio
    }
  });

  // Handle the sphere colors
  if (activeRadio && activeRadio !== previouslyCheckedRadio) {
    if (previouslyCheckedRadio) {
      // Change the color of the previously checked landmark to pink
      const previousSphere = landmarks.get(previouslyCheckedRadio.id);
      if (previousSphere) {
        previousSphere.material.color.set(0xff00ff); // Pink
      }
      previouslyCheckedRadio.disabled = true; // Disable the previous radio
    }

    // Change the color of the currently active landmark to green
    const activeSphere = landmarks.get(activeRadio.id);
    if (activeSphere) {
      activeSphere.material.color.set(0x00ff00); // Green
    }

    previouslyCheckedRadio = activeRadio; // Update the last checked radio reference
  }

  return activeRadio ? activeRadio.id : null; // Return the ID of the active radio button
}

// Function to create or update a landmark
function createOrUpdateLandmark(position, name, color = 0xff0000) {
  if (landmarks.has(name)) {
    // Update existing landmark's position
    landmarks.get(name).position.copy(position);
  } else {
    // Create a new landmark
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color });
    const landmark = new THREE.Mesh(geometry, material);
    landmark.name = name; // Store the name in the landmark
    landmark.position.copy(position);
    scene.add(landmark);
    landmarks.set(name, landmark); // Add landmark to the map
  }
}

// Mouse event listener for dragging landmarks
let isDragging = false;
let selectedLandmark = null;

// Mouse event listener for placing landmarks
window.addEventListener("click", (event) => {
  const activeRadio = getActiveRadioButton();
  if (!activeRadio) return; // No active radio, skip
  if (landmarks.has(activeRadio)) return; // Landmark already exists, skip
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
    selectedLandmark.position.copy(intersects[0].point);
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
