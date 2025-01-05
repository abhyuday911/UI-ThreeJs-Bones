import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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
}

// Camera fitting function to adjust camera position based on model size
function fitCameraToObject(objects, camera) {
  const box = new THREE.Box3();
  objects.forEach((obj) => box.expandByObject(obj));
  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxSize = Math.max(size.x, size.y, size.z);

  camera.position.set(center.x, -(center.y + maxSize), center.z);
  camera.lookAt(center);
}

// Load STL models and add them to the scene
function loadSTLModel(path, color, callback) {
  const loader = new STLLoader();
  loader.load(
    path,
    (geometry) => {
      const material = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      callback(mesh); // Pass loaded mesh to callback (e.g., for camera fitting)
    },
    (xhr) => console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`),
    (error) => console.error(`Error loading model from ${path}:`, error)
  );
}

// Store loaded meshes
const loadedMeshes = [];
loadSTLModel("./Right_Femur.stl", 0x808080, (femur) =>
  loadedMeshes.push(femur)
);
loadSTLModel("./Right_Tibia.stl", 0x00cc00, (tibia) =>
  loadedMeshes.push(tibia)
);

// Landmark creation and interaction functions
function createLandmark(position, color = 0xff0000) {
  const geometry = new THREE.SphereGeometry(2, 32, 32);
  const material = new THREE.MeshStandardMaterial({ color });
  const landmark = new THREE.Mesh(geometry, material);
  landmark.position.copy(position);
  scene.add(landmark);
  return landmark;
}

// Interactivity with landmarks
let selectedLandmark = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const landmarks = [];

// Mouse event listener for placing and dragging landmarks
window.addEventListener("click", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    selectedLandmark = createLandmark(intersects[0].point);
    landmarks.push(selectedLandmark);
    // selectedLandmark = null
  }
});

// Resize handling for responsive canvas
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onWindowResize);

// Main initialization function
function init() {
  setupLighting();
  setupCamera();

  function animate() {
    requestAnimationFrame(animate);
    if (loadedMeshes.length === 2) {
      fitCameraToObject(loadedMeshes, camera);
    }
    renderer.render(scene, camera);
  }

  animate();
}

init();
