import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export function loadModelScene() {
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
    loader.load(
      path,
      (geometry) => {
        const material = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        loadedMeshes.push(mesh);

        if (loadedMeshes.length === 2) {
          fitCameraToObject(loadedMeshes, camera, controls);
          hideLoadingScreen();  // Hide loading once both models are loaded
        }
      },
      (xhr) => {
        // Update loading progress
        const progress = (xhr.loaded / xhr.total) * 100;
        updateLoadingScreen(progress); // Update progress bar or text
      },
      (error) => {
        console.error("Error loading model:", error);
        hideLoadingScreen();  // Hide loading if there's an error
      }
    );
  }

  loadSTLModel("./Right_Femur.stl", 0xa0a0a0);
  loadSTLModel("./Right_Tibia.stl", 0x60ee60);

  // Show loading screen and progress
  function showLoadingScreen() {
    const loadingScreen = document.getElementById("loadingScreen");
    loadingScreen.classList.remove('hidden');  // Show loading screen
  }

  function updateLoadingScreen(progress) {
    const loadingScreen = document.getElementById("loadingScreen");
    loadingScreen.innerHTML = `Loading... ${Math.round(progress)}%`; // Update text with progress
  }

  function hideLoadingScreen() {
    const loadingScreen = document.getElementById("loadingScreen");
    loadingScreen.classList.add('hidden');  // Hide loading screen when done
  }

  // Main initialization function
  function init() {
    showLoadingScreen(); // Show loading at the beginning
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
  return { scene, camera, renderer, controls, loadedMeshes };
}
