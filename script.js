import * as THREE from "three";
import { loadModelScene } from "./scripts/loadModelScene";
const { scene, camera, renderer, controls, loadedMeshes } = loadModelScene();

const perpendicularPlanes = new Map();
let rotationAngle = Math.PI / 180; // Define the rotation angle for each click (1 degrees)
let varusValgusAngle = 0;
let flexionExtensionAngle = 0;
let DistalResectionPlane = 10;

// Landmark interaction setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const landmarks = new Map();
const axisLines = new Map();
let isDragging = false;
let selectedLandmark = null;
let lastClickedRadio = null;

// Global function to update all dependent objects dynamically
function updateDependentObjects() {
  updateLines();
  updateRadioStyles(landmarks);

  createAnteriorLine();
  createOrUpdatePerpendicularPlane(
    "VarusValgusPlane",
    "MechanicalAxis",
    "femurCenter",
    100,
    0x3b82f6 // bg-blue-500
  );

  createFlexionExtensionLine();
  createOrUpdatePerpendicularPlane(
    "FlexionExtensionPlane", // New name for the Flexion/Extension Plane
    "MechanicalAxis", // Axis to align the plane with
    "femurCenter", // Reference point for positioning
    100, // Plane size
    0x22c55e // Plane color (Greenish)
  );

  rotateVarusValgusPlane(1, rotationAngle * varusValgusAngle);
  rotateFlexionExtensionPlane(1, rotationAngle * flexionExtensionAngle);

  createParallelPlaneThroughPoint(
    "FlexionExtensionPlane",
    landmarks.get("distalMedialPt").position,
    "DistalMedialPlane",
    150,
    0x880000
  );

  const distalMedialPoint = landmarks.get("distalMedialPt").position;
  const proximalOffset = new THREE.Vector3(0, 0, DistalResectionPlane);
  const newLandmarkPoint = distalMedialPoint.clone().add(proximalOffset);

  createParallelPlaneThroughPoint(
    "DistalMedialPlane",
    newLandmarkPoint,
    "DistalResectionPlane",
    130,
    0xf97316
  );
}

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
  const activeRadio = lastClickedRadio ? lastClickedRadio.id : null;

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

// Update lines dynamically during dragging
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
    if (landmarks.has(selectedLandmark.name)) {
      const landmark = landmarks.get(selectedLandmark.name);
      landmark.position.copy(newPosition); // Sync position with the map
    }

    updateDependentObjects(); // Update dependent objects
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

// Create or update a line between two points
function createOrUpdateLine(name, start, end, color = 0xffffff) {
  const material = new THREE.LineBasicMaterial({ color });
  const points = [start, end].map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  if (axisLines.has(name)) {
    const line = axisLines.get(name);
    line.geometry.dispose(); // Dispose of old geometry
    line.geometry = geometry; // Replace with new geometry
  } else {
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    axisLines.set(name, line);

    console.log("axis lines -> set", name);
  }
}

// Helper function to project a point onto a plane
function projectPointOnPlane(point, planeNormal, planePoint) {
  const pointVector = new THREE.Vector3(point.x, point.y, point.z);
  const planePointVector = new THREE.Vector3(
    planePoint.x,
    planePoint.y,
    planePoint.z
  );
  const planeToPoint = new THREE.Vector3().subVectors(
    pointVector,
    planePointVector
  );
  const distance = planeToPoint.dot(planeNormal); // Distance to plane
  return pointVector.sub(planeNormal.clone().multiplyScalar(distance)); // Projected point
}

// Update TEA projection on the newly created perpendicular plane
function updateTEAProjectionOnPlane() {
  if (
    landmarks.has("medialEpicondyle") &&
    landmarks.has("lateralEpicondyle") &&
    landmarks.has("femurCenter")
  ) {
    const medialEpicondyle = landmarks.get("medialEpicondyle").position;
    const lateralEpicondyle = landmarks.get("lateralEpicondyle").position;

    // Get the perpendicular plane created by Mechanical Axis
    const axisLine = axisLines.get("MechanicalAxis");
    const referencePoint = landmarks.get("femurCenter").position; // Updated reference point
    const start = axisLine.geometry.attributes.position.array.slice(0, 3);
    const end = axisLine.geometry.attributes.position.array.slice(3, 6);
    const startVector = new THREE.Vector3(start[0], start[1], start[2]);
    const endVector = new THREE.Vector3(end[0], end[1], end[2]);
    const axisDirection = new THREE.Vector3()
      .subVectors(endVector, startVector)
      .normalize();

    // Plane normal is the Mechanical Axis direction
    const planeNormal = axisDirection;

    // Project both Medial and Lateral Epicondyles onto the perpendicular plane
    const projectedMedial = projectPointOnPlane(
      medialEpicondyle,
      planeNormal,
      referencePoint
    );
    const projectedLateral = projectPointOnPlane(
      lateralEpicondyle,
      planeNormal,
      referencePoint
    );

    // Create or update the projected TEA line on the plane
    createOrUpdateLine(
      "TEA_Projection",
      projectedMedial,
      projectedLateral,
      0x00ffff
    ); // Cyan for the projection line
  }
}

// Function to update all lines based on landmark positions
function updateLines() {
  if (landmarks.has("femurCenter") && landmarks.has("hipCenter")) {
    createOrUpdateLine(
      "MechanicalAxis",
      landmarks.get("femurCenter").position,
      landmarks.get("hipCenter").position,
      0xff0000
    ); // Mechanical Axis

    // Update or create the perpendicular plane for the Mechanical Axis
    createOrUpdatePerpendicularPlane(
      "MechanicalAxisPlane",
      "MechanicalAxis",
      "femurCenter", // Reference point for the plane
      100,
      0x888888
    );

    // Update TEA projection on the newly created perpendicular plane
    updateTEAProjectionOnPlane(); // Project TEA on the plane
  }

  if (
    landmarks.has("femurProximalCanal") &&
    landmarks.has("femurDistalCanal")
  ) {
    createOrUpdateLine(
      "AnatomicalAxis",
      landmarks.get("femurProximalCanal").position,
      landmarks.get("femurDistalCanal").position,
      0x00ff00
    ); // Anatomical Axis
  }

  if (landmarks.has("medialEpicondyle") && landmarks.has("lateralEpicondyle")) {
    createOrUpdateLine(
      "TEA",
      landmarks.get("medialEpicondyle").position,
      landmarks.get("lateralEpicondyle").position,
      0x0000ff
    ); // TEA
  }

  if (
    landmarks.has("posteriorMedialPt") &&
    landmarks.has("posteriorLateralPt")
  ) {
    createOrUpdateLine(
      "PCA",
      landmarks.get("posteriorMedialPt").position,
      landmarks.get("posteriorLateralPt").position,
      0xffff00
    ); // PCA
  }

  // Update the perpendicular plane based on the Mechanical Axis
  if (axisLines.has("MechanicalAxis")) {
    createOrUpdatePerpendicularPlane("MechanicalAxis");
    console.log("perpendicular plane -> set");
  }
}

// Update lines when the "Update" button is clicked
document.getElementById("updateButton").addEventListener("click", () => {
  if (landmarks.size === 0) return;
  lastClickedRadio = null;
  updateDependentObjects();
});

// Create or Update a Perpendicular Plane to the Mechanical Axis
function createOrUpdatePerpendicularPlane(
  planeName,
  axisName,
  referencePointName,
  size = 100,
  color = 0x888888
) {
  if (!axisLines.has(axisName)) return; // Ensure axis exists
  if (!landmarks.has(referencePointName)) return; // Ensure reference point exists

  const axisLine = axisLines.get(axisName);
  const referencePoint = landmarks.get(referencePointName).position;

  // Get positions of the Mechanical Axis endpoints
  const start = axisLine.geometry.attributes.position.array.slice(0, 3);
  const end = axisLine.geometry.attributes.position.array.slice(3, 6);

  const startVector = new THREE.Vector3(start[0], start[1], start[2]);
  const endVector = new THREE.Vector3(end[0], end[1], end[2]);

  // Calculate the direction of the axis (Mechanical Axis vector)
  const axisDirection = new THREE.Vector3()
    .subVectors(endVector, startVector)
    .normalize();

  // Check if the plane already exists
  let planeMesh;
  if (perpendicularPlanes.has(planeName)) {
    planeMesh = perpendicularPlanes.get(planeName);
  } else {
    // Create a new plane if it doesn't exist
    const planeGeometry = new THREE.PlaneGeometry(size, size);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    perpendicularPlanes.set(planeName, planeMesh);
    scene.add(planeMesh);
  }

  // Set the plane's position to the reference point
  planeMesh.position.copy(referencePoint);

  // Set the plane's orientation to be perpendicular to the axis
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), // Default plane normal (Z-axis)
    axisDirection
  );
  planeMesh.setRotationFromQuaternion(quaternion);

  return;
}

function createAnteriorLine() {
  if (!landmarks.has("femurCenter") || !axisLines.has("TEA_Projection")) {
    console.error("Femur Center or TEA Projection not found!");
    return;
  }

  // Get Femur Center position
  const femurCenter = landmarks.get("femurCenter").position;

  // Get TEA Projection axis direction
  const teaLine = axisLines.get("TEA_Projection");
  const start = new THREE.Vector3(
    teaLine.geometry.attributes.position.array[0],
    teaLine.geometry.attributes.position.array[1],
    teaLine.geometry.attributes.position.array[2]
  );
  const end = new THREE.Vector3(
    teaLine.geometry.attributes.position.array[3],
    teaLine.geometry.attributes.position.array[4],
    teaLine.geometry.attributes.position.array[5]
  );

  const teaDirection = new THREE.Vector3().subVectors(end, start).normalize();

  // Calculate a vector perpendicular to TEA direction
  const anteriorDirection = new THREE.Vector3(0, 0, 1)
    .cross(teaDirection)
    .normalize();

  // Scale the perpendicular vector to 10mm
  const anteriorPoint = new THREE.Vector3().addVectors(
    femurCenter,
    anteriorDirection.multiplyScalar(10)
  );

  // Create the anterior line
  createOrUpdateLine("AnteriorLine", femurCenter, anteriorPoint, 0xff00ff); // Magenta for anterior line

  // Create or update the plane using the anterior line
}

function rotateVarusValgusPlane(direction, rotateBy) {
  // Get the anterior line
  const anteriorLine = axisLines.get("AnteriorLine");

  // Extract start and end points of the anterior line
  const start = new THREE.Vector3(
    anteriorLine.geometry.attributes.position.array[0],
    anteriorLine.geometry.attributes.position.array[1],
    anteriorLine.geometry.attributes.position.array[2]
  );
  const end = new THREE.Vector3(
    anteriorLine.geometry.attributes.position.array[3],
    anteriorLine.geometry.attributes.position.array[4],
    anteriorLine.geometry.attributes.position.array[5]
  );

  // Calculate the direction of the anterior line
  const anteriorLineDirection = new THREE.Vector3()
    .subVectors(end, start)
    .normalize();

  // Create a quaternion to represent the rotation around the anterior line
  const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
    anteriorLineDirection, // Axis of rotation is the anterior line direction
    direction * rotateBy // Angle to rotate
  );

  // Apply the rotation to the VarusValgusPlane
  const plane = perpendicularPlanes.get("VarusValgusPlane");

  // Rotate the plane by applying the rotation quaternion
  plane.rotation.setFromQuaternion(rotationQuaternion);
  // Update the perpendicularPlanes collection
  perpendicularPlanes.set("VarusValgusPlane", plane);
}

function createFlexionExtensionLine() {
  if (!landmarks.has("femurCenter") || !axisLines.has("AnteriorLine")) {
    console.error("Femur Center or AnteriorLine Projection not found!");
    return;
  }

  // Get Femur Center position
  const femurCenter = landmarks.get("femurCenter").position;

  // Get TEA Projection axis direction
  const AnteriorLine = axisLines.get("AnteriorLine");
  const start = new THREE.Vector3(
    AnteriorLine.geometry.attributes.position.array[0],
    AnteriorLine.geometry.attributes.position.array[1],
    AnteriorLine.geometry.attributes.position.array[2]
  );
  const end = new THREE.Vector3(
    AnteriorLine.geometry.attributes.position.array[3],
    AnteriorLine.geometry.attributes.position.array[4],
    AnteriorLine.geometry.attributes.position.array[5]
  );

  const AnteriorLineDirection = new THREE.Vector3()
    .subVectors(end, start)
    .normalize();

  // Calculate a vector perpendicular to TEA direction
  const lateralDirection = new THREE.Vector3(0, 0, 1)
    .cross(AnteriorLineDirection)
    .normalize();

  // Scale the perpendicular vector to 10mm
  const lateralEndPoint = new THREE.Vector3().addVectors(
    femurCenter,
    lateralDirection.multiplyScalar(-10)
  );

  // Create the lateral line from femur center to the lateral end point (10mm in the X direction)
  createOrUpdateLine("LateralLine", femurCenter, lateralEndPoint, 0x0000ff); // Blue for lateral line
}

// Function to rotate the Flexion/Extension plane
function rotateFlexionExtensionPlane(direction, rotateBy) {
  const lateralLine = axisLines.get("LateralLine");

  // Extract start and end points of the anterior line
  const start = new THREE.Vector3(
    lateralLine.geometry.attributes.position.array[0],
    lateralLine.geometry.attributes.position.array[1],
    lateralLine.geometry.attributes.position.array[2]
  );
  const end = new THREE.Vector3(
    lateralLine.geometry.attributes.position.array[3],
    lateralLine.geometry.attributes.position.array[4],
    lateralLine.geometry.attributes.position.array[5]
  );

  // Calculate the direction of the anterior line
  const lateralLineDirection = new THREE.Vector3()
    .subVectors(end, start)
    .normalize();

  // Create a quaternion to represent the rotation around the anterior line
  const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
    lateralLineDirection, // Axis of rotation is the anterior line direction
    direction * rotateBy // Angle to rotate
  );

  // Apply the rotation to the Flexion/Extension plane
  const plane = perpendicularPlanes.get("FlexionExtensionPlane");

  // Rotate the plane by applying the rotation quaternion
  plane.rotation.setFromQuaternion(rotationQuaternion);
  // Update the perpendicularPlanes collection, if needed
  perpendicularPlanes.set("FlexionExtensionPlane", plane);

  // Update the parallel planes to keep them aligned
  const planesToUpdate = ["DistalMedialPlane", "DistalResectionPlane"];

  planesToUpdate.forEach((planeName) => {
    const planeMesh = perpendicularPlanes.get(planeName);
    if (planeMesh) {
      // Apply the same rotation to the parallel plane to maintain parallelism
      planeMesh.rotation.setFromQuaternion(rotationQuaternion);
    }
  });
}

function createParallelPlaneThroughPoint(
  referencePlaneName,
  landmarkPoint,
  newPlaneName,
  size = 100,
  color = 0x888888
) {
  // Retrieve the reference plane (e.g., Flexion/Extension Plane)
  let referencePlane = perpendicularPlanes.get(referencePlaneName);
  if (!referencePlane) {
    console.error(`${referencePlaneName} not found!`);
    return;
  }

  // Retrieve the normal of the reference plane
  const referencePlaneNormal = new THREE.Vector3(0, 0, 1); // Default normal (Z-axis)
  referencePlane.localToWorld(referencePlaneNormal); // Transform the normal from local space to world space

  let newPlaneMesh = perpendicularPlanes.get(newPlaneName);
  if (newPlaneMesh) {
    newPlaneMesh.position.copy(landmarkPoint);
    perpendicularPlanes.set(newPlaneName, newPlaneMesh);
  } else {
    const newPlaneGeometry = new THREE.PlaneGeometry(size, size);
    const newPlaneMaterial = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });

    newPlaneMesh = new THREE.Mesh(newPlaneGeometry, newPlaneMaterial);
    newPlaneMesh.position.copy(landmarkPoint);

    perpendicularPlanes.set(newPlaneName, newPlaneMesh);
    scene.add(newPlaneMesh);
  }
}

document
  .getElementById("varus-valgus-increment")
  .addEventListener("click", () => {
    varusValgusAngle += 1;
    rotateVarusValgusPlane(1, rotationAngle * varusValgusAngle);
    document.getElementById(
      "varus-valgus"
    ).innerText = `Varus/Valgus (${varusValgusAngle}°)`;
  });

document
  .getElementById("varus-valgus-decrement")
  .addEventListener("click", () => {
    varusValgusAngle -= 1;
    rotateVarusValgusPlane(1, rotationAngle * varusValgusAngle);
    document.getElementById(
      "varus-valgus"
    ).innerText = `Varus/Valgus (${varusValgusAngle}°)`;
  });

document
  .getElementById("flexion-extension-increment")
  .addEventListener("click", () => {
    flexionExtensionAngle += 1;
    rotateFlexionExtensionPlane(1, rotationAngle * flexionExtensionAngle);
    document.getElementById(
      "flexion-extension"
    ).innerText = `Flexion/Extension (${flexionExtensionAngle}°)`;
  });

document
  .getElementById("flexion-extension-decrement")
  .addEventListener("click", () => {
    flexionExtensionAngle -= 1;
    rotateFlexionExtensionPlane(1, rotationAngle * flexionExtensionAngle);
    document.getElementById(
      "flexion-extension"
    ).innerText = `Flexion/Extension (${flexionExtensionAngle}°)`;
  });

document
  .getElementById("distal-medial-resection-decrement")
  .addEventListener("click", () => {
    DistalResectionPlane -= 1;
    document.getElementById(
      "distal-medial-resection"
    ).innerText = `Distal Medial Resection (${DistalResectionPlane}mm)`;
    const distalMedialPoint = landmarks.get("distalMedialPt").position;
    const proximalOffset = new THREE.Vector3(0, 0, DistalResectionPlane);
    const newLandmarkPoint = distalMedialPoint.clone().add(proximalOffset);

    createParallelPlaneThroughPoint(
      "DistalMedialPlane",
      newLandmarkPoint,
      "DistalResectionPlane",
      130,
      0xffff00
    );
  });

document
  .getElementById("distal-medial-resection-increment")
  .addEventListener("click", () => {
    DistalResectionPlane += 1;
    document.getElementById(
      "distal-medial-resection"
    ).innerText = `Distal Medial Resection (${DistalResectionPlane}mm)`;
    const distalMedialPoint = landmarks.get("distalMedialPt").position;
    const proximalOffset = new THREE.Vector3(0, 0, DistalResectionPlane);
    const newLandmarkPoint = distalMedialPoint.clone().add(proximalOffset);

    createParallelPlaneThroughPoint(
      "DistalMedialPlane",
      newLandmarkPoint,
      "DistalResectionPlane",
      130,
      0xf97316
    );
  });
