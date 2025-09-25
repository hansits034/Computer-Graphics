"use strict";

var canvas, gl, program;
// OLD transform variables, now for the model's own transform
var modelTheta = [0, -132, 0];
var modelTranslate = [0, 0, 0];
var modelScale = [0.32, 0.32, 0.32];
var spinEnabled = true;
var lastTime = 0;

// Lighting variables
var sunAzimuth = 135, sunElevation = 25, shadowIntensity = 0;
var lightDirLoc, lightColorLoc, ambientColorLoc, shadowFactorLoc;

// NEW camera and projection variables
var eye = vec3(1.0, 2.5, 3.8);
const at = vec3(0.0, 0.0, 0.0);
const up = vec3(0.0, 1.0, 0.0);

var projectionType = 'perspective';
var fovy = 63.0, aspect;
var near = 0.1, far = 100.0;
var orthoLeft = -5.0, orthoRight = 5.0, orthoBottom = -5.0, orthoTop = 5.0;

// NEW matrix and uniform location variables
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var positions = [];
var colors = [];
var normals = [];
var indices = []; 
var vertexCount = 0;

var cBuffer, vBuffer, nBuffer, iBuffer;
var colorLocAttrib, posLocAttrib, normalLocAttrib;
var numPositions = 0;
var triRotation = 0;

const PAL = {
  ground: vec4(0.4, 0.6, 0.3, 1.0),     
  wall: vec4(0.97, 0.95, 0.90, 1.0),    
  window: vec4(0.15, 0.35, 0.55, 1.0),  
  roof: vec4(0.7, 0.3, 0.15, 1.0),      
  lot: vec4(0.35, 0.35, 0.35, 1.0),     
  line: vec4(0.9, 0.9, 0.1, 1.0),       
  carBody: [
      vec4(0.6, 0.1, 0.1, 1.0), vec4(0.1, 0.1, 0.6, 1.0),
      vec4(0.1, 0.5, 0.2, 1.0), vec4(0.0, 0.0, 0.0, 1.0),
      vec4(1.0, 1.0, 1.0, 1.0), vec4(0.5, 0.5, 0.5, 1.0),
      vec4(0.55, 0.4, 0.25, 1.0), vec4(0.8, 0.8, 0.8, 1.0),
      vec4(0.5, 0.0, 0.1, 1.0), vec4(0.0, 0.1, 0.4, 1.0),
      vec4(1.0, 0.9, 0.1, 1.0)
  ],
  carWheel: vec4(0.05,0.05,0.05,1.0),
  treeTrunk: vec4(0.4,0.25,0.1,1.0),
  treeLeaves: vec4(0.2,0.5,0.15,1.0),
  motorBody: vec4(0.2,0.05,0.05,1.0),
  motorSeat: vec4(0.05,0.05,0.05,1.0),
  motorWheel: vec4(0.03,0.03,0.03,1.0),
  triWall: vec4(0.8,0.78,0.7,1.0),
  triRoof: vec4(0.6,0.25,0.1,1.0),
  tent: vec4(1.0, 1.0, 1.0, 1.0),
  tentPole: vec4(0.2, 0.2, 0.2, 1.0),
  canopyGrey: vec4(0.85, 0.85, 0.85, 1.0)
};

function pushCuboid(center, size, color) {
    const cx = center[0], cy = center[1], cz = center[2];
    const sx = size[0] / 2, sy = size[1] / 2, sz = size[2] / 2;
    const p = [
        vec4(cx - sx, cy - sy, cz + sz, 1.0), vec4(cx + sx, cy - sy, cz + sz, 1.0),
        vec4(cx + sx, cy + sy, cz + sz, 1.0), vec4(cx - sx, cy + sy, cz + sz, 1.0),
        vec4(cx - sx, cy - sy, cz - sz, 1.0), vec4(cx + sx, cy - sy, cz - sz, 1.0),
        vec4(cx + sx, cy + sy, cz - sz, 1.0), vec4(cx - sx, cy + sy, cz - sz, 1.0)
    ];
    const faceNormals = [
        vec3(0, 0, 1), vec3(1, 0, 0), vec3(0, 0, -1),
        vec3(-1, 0, 0), vec3(0, 1, 0), vec3(0, -1, 0)
    ];
    const faces = [
        { n: faceNormals[0], v: [0, 1, 2, 3] }, { n: faceNormals[1], v: [1, 5, 6, 2] },
        { n: faceNormals[2], v: [5, 4, 7, 6] }, { n: faceNormals[3], v: [4, 0, 3, 7] },
        { n: faceNormals[4], v: [3, 2, 6, 7] }, { n: faceNormals[5], v: [4, 5, 1, 0] }
    ];
    for (const face of faces) {
        positions.push(p[face.v[0]], p[face.v[1]], p[face.v[2]], p[face.v[3]]);
        normals.push(face.n, face.n, face.n, face.n);
        colors.push(color, color, color, color);
        indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
        );
        vertexCount += 4;
    }
    numPositions += 36;
}

function pushRoof(center, size, color) {
    const cx = center[0], cy = center[1], cz = center[2];
    const sx = size[0] / 2, sy = size[1], sz = size[2] / 2;
    const v = [
        vec4(cx - sx, cy, cz + sz, 1.0), vec4(cx + sx, cy, cz + sz, 1.0),
        vec4(cx + sx, cy, cz - sz, 1.0), vec4(cx - sx, cy, cz - sz, 1.0),
        vec4(cx, cy + sy, cz + sz, 1.0), vec4(cx, cy + sy, cz - sz, 1.0),
    ];
    addTriangle(v[0], v[1], v[4], color);
    addTriangle(v[3], v[2], v[5], color);
    addQuad(v[0], v[4], v[5], v[3], color);
    addQuad(v[1], v[2], v[5], v[4], color);
}

function pushWindows(center, size, floors, rows, cols) {
  const floorHeight = size[1] / floors;
  const wallX = size[0], wallY = size[1], wallZ = size[2];
  for (let f = 0; f < floors; f++) {
    const baseY = center[1] - wallY / 2 + f * floorHeight;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        let wx = center[0] - wallX / 2 + (c + 0.5) * (wallX / cols);
        let wy = baseY + (r + 0.5) * (floorHeight / rows);
        let wzF = center[2] + wallZ / 2 + 0.01;
        let wzB = center[2] - wallZ / 2 - 0.01;
        const wxSize = (wallX / cols) * 0.7;
        const wySize = (floorHeight / rows) * 0.7;
        pushCuboid(vec3(wx, wy, wzF), vec3(wxSize, wySize, 0.02), PAL.window);
        pushCuboid(vec3(wx, wy, wzB), vec3(wxSize, wySize, 0.02), PAL.window);
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        let wz = center[2] - wallZ / 2 + (c + 0.5) * (wallZ / cols);
        let wy = baseY + (r + 0.5) * (floorHeight / rows);
        let wxL = center[0] - wallX / 2 - 0.01;
        let wxR = center[0] + wallX / 2 + 0.01;
        const sideW = 0.02;
        const sideH = (floorHeight / rows) * 0.6;
        pushCuboid(vec3(wxL, wy, wz), vec3(sideW, sideH, (wallZ / cols) * 0.6), PAL.window);
        pushCuboid(vec3(wxR, wy, wz), vec3(sideW, sideH, (wallZ / cols) * 0.6), PAL.window);
      }
    }
  }
}

function buildWing(center, size, floors) {
  pushCuboid(center, size, PAL.wall);
  pushWindows(center, size, floors, 1, 3);
  pushRoof(vec3(center[0], center[1] + size[1] / 2, center[2]),
           vec3(size[0], 0.25 + 0.05 * floors, size[2]), PAL.roof);
}

function buildTower(center, size) {
  const bodySize = vec3(size[0], size[1], size[2]);
  pushCuboid(center, bodySize, PAL.wall);
  pushRoof(vec3(center[0], center[1] + size[1] / 2, center[2]), vec3(size[0] * 1.1, 0.3, size[2] * 1.1), PAL.roof);
  pushWindows(center, vec3(size[0], size[1] * 0.9, size[2]), Math.min(3, Math.max(1, Math.floor(size[1] / 0.25))), 1, 1);
}

function buildCar(center, color) {
  const baseY = center[1] - 0.06; 
  const chassisHeight = 0.3;
  pushCuboid(vec3(center[0], baseY + chassisHeight / 2, center[2]), vec3(1.0, chassisHeight, 0.5), color);
  const cabinHeight = 0.16;
  const cabinY = baseY + chassisHeight + cabinHeight / 2;
  const cabinXoffset = -0.1; 
  pushCuboid(vec3(center[0] + cabinXoffset, cabinY, center[2]), vec3(0.6, cabinHeight, 0.48), PAL.carBody[3]); 
  const wOffX = 0.38, wOffZ = 0.22;
  const wheelY = baseY; 
  pushCuboid(vec3(center[0]-wOffX, wheelY, center[2]+wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
  pushCuboid(vec3(center[0]+wOffX, wheelY, center[2]+wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
  pushCuboid(vec3(center[0]-wOffX, wheelY, center[2]-wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
  pushCuboid(vec3(center[0]+wOffX, wheelY, center[2]-wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
}

function buildCar90(center, color) {
  const baseY = center[1] - 0.06;
  const chassisHeight = 0.3;
  pushCuboid(vec3(center[0], baseY + chassisHeight / 2, center[2]), vec3(0.5, chassisHeight, 1.0), color);
  const cabinHeight = 0.16;
  const cabinY = baseY + chassisHeight + cabinHeight / 2;
  const cabinZoffset = -0.1;
  pushCuboid(vec3(center[0], cabinY, center[2] + cabinZoffset), vec3(0.48, cabinHeight, 0.6), PAL.carBody[3]);
  const wOffZ = 0.38, wOffX = 0.22;
  const wheelY = baseY;
  pushCuboid(vec3(center[0]-wOffX, wheelY, center[2]+wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
  pushCuboid(vec3(center[0]+wOffX, wheelY, center[2]+wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
  pushCuboid(vec3(center[0]-wOffX, wheelY, center[2]-wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
  pushCuboid(vec3(center[0]+wOffX, wheelY, center[2]-wOffZ), vec3(0.12,0.12,0.12), PAL.carWheel);
}

function buildMotorcycle(center, color) {
  pushCuboid(vec3(center[0], center[1], center[2]), vec3(0.5, 0.12, 0.18), color);
  pushCuboid(vec3(center[0]-0.12, center[1]+0.08, center[2]), vec3(0.22, 0.06, 0.16), PAL.motorSeat);
  pushCuboid(vec3(center[0]-0.22, center[1]-0.12, center[2]), vec3(0.12,0.12,0.12), PAL.motorWheel);
  pushCuboid(vec3(center[0]+0.22, center[1]-0.12, center[2]), vec3(0.12,0.12,0.12), PAL.motorWheel);
}

function buildTree(center, height, leafiness) {
    const trunkHeight = height * (0.35 + Math.random() * 0.1);
    const trunkRadius = trunkHeight * 0.1;
    pushCuboid(vec3(center[0], center[1] + trunkHeight / 2, center[2]), vec3(trunkRadius, trunkHeight, trunkRadius), PAL.treeTrunk);
    const canopyBaseY = center[1] + trunkHeight;
    const canopyHeight = height - trunkHeight;
    const numLeafBlocks = 4 + Math.floor(leafiness * 6);
    for (let i = 0; i < numLeafBlocks; i++) {
        const progress = i / (numLeafBlocks > 1 ? numLeafBlocks - 1 : 1);
        let baseSize = canopyHeight * (0.4 + leafiness * 0.3);
        let size = baseSize * (1.0 - progress * 0.6) * (0.7 + Math.random() * 0.6); 
        const offsetX = (Math.random() - 0.5) * size * 0.5;
        const offsetZ = (Math.random() - 0.5) * size * 0.5;
        const yPos = canopyBaseY + progress * canopyHeight * 0.8;
        const variedLeafColor = vec4(
            PAL.treeLeaves[0] * (0.9 + Math.random() * 0.2),
            PAL.treeLeaves[1] * (0.9 + Math.random() * 0.2),
            PAL.treeLeaves[2] * (0.9 + Math.random() * 0.2),
            1.0
        );
        pushCuboid(vec3(center[0] + offsetX, yPos, center[2] + offsetZ), vec3(size, size, size), variedLeafColor);
    }
}

function buildParkingLot(center, size, slots) {
  pushCuboid(center, size, PAL.lot);
  const slotDepth = (slots>0) ? size[2] / slots : 0; 
  for (let i = 0; i < slots; i++) {
    const z = center[2] - size[2]/2 + i*slotDepth + slotDepth/2;
    pushCuboid(vec3(center[0], center[1]+0.01, z), vec3(size[0]*0.02, 0.02, slotDepth*0.95 || 0.05), PAL.line);
  }
}

function plantTreesInArea(areaCenter, areaSize, count) {
    for (let i = 0; i < count; i++) {
        const x = areaCenter[0] + (Math.random() - 0.5) * areaSize[0];
        const z = areaCenter[2] + (Math.random() - 0.5) * areaSize[2];
        const height = 1.2 + Math.random() * 3;
        const leafiness = 0.4 + Math.random() * 0.6;
        buildTree(vec3(x, areaCenter[1], z), height, leafiness);
    }
}

function smallplantTreesInArea(areaCenter, areaSize, count) {
    for (let i = 0; i < count; i++) {
        const x = areaCenter[0] + (Math.random() - 0.5) * areaSize[0];
        const z = areaCenter[2] + (Math.random() - 0.5) * areaSize[2];
        const height = 0.8 + Math.random() * 0.9;
        const leafiness = 0.1 + Math.random() * 0.3;
        buildTree(vec3(x, areaCenter[1], z), height, leafiness);
    }
}

function smallerplantTreesInArea(areaCenter, areaSize, count) {
    for (let i = 0; i < count; i++) {
        const x = areaCenter[0] + (Math.random() - 0.5) * areaSize[0];
        const z = areaCenter[2] + (Math.random() - 0.5) * areaSize[2];
        const height = 0.8 + Math.random() * 0.6;
        const leafiness = 0.02 + Math.random() * 0.15;
        buildTree(vec3(x, areaCenter[1], z), height, leafiness);
    }
}

function mossInArea(areaCenter, areaSize, count) {
    for (let i = 0; i < count; i++) {
        const x = areaCenter[0] + (Math.random() - 0.5) * areaSize[0];
        const z = areaCenter[2] + (Math.random() - 0.5) * areaSize[2];
        const height = 0.2 + Math.random() * 0.3;
        const leafiness = 0.02 + Math.random() * 0.15;
        buildTree(vec3(x, areaCenter[1], z), height, leafiness);
    }
}

function addTriangle(a, b, c, color) {
    const u = subtract(b, a);
    const v = subtract(c, a);
    const normal = normalize(cross(u, v));

    positions.push(a, b, c);
    colors.push(color, color, color);
    normals.push(normal, normal, normal);
    indices.push(vertexCount, vertexCount + 1, vertexCount + 2);
    vertexCount += 3;
    numPositions += 3;
}

function addQuad(a, b, c, d, color) {
    addTriangle(a, b, c, color);
    addTriangle(a, c, d, color);
}

function pushTriPrism(center, size, floors, rotationDeg, colorWall, colorRoof) {
  const cx=center[0], cy=center[1], cz=center[2];
  const w = size[0], h = size[1], d = size[2];
  const baseY = cy - h/2;
  const topY = cy + h/2;
  let p0 = [ -w/2, baseY, -d/2 ], p1 = [  w/2, baseY, -d/2 ], p2 = [ -w/2, baseY,  d/2 ]; 
  let p3 = [ p0[0], topY, p0[2] ], p4 = [ p1[0], topY, p1[2] ], p5 = [ p2[0], topY, p2[2] ];
  const a = rotationDeg * Math.PI / 180.0;
  const ca = Math.cos(a), sa = Math.sin(a);
  function rotAndTranslate(pt) {
    const rx = pt[0]*ca - pt[2]*sa;
    const rz = pt[0]*sa + pt[2]*ca;
    return vec4(rx + cx, pt[1], rz + cz, 1.0);
  }
  const rp0 = rotAndTranslate(p0), rp1 = rotAndTranslate(p1), rp2 = rotAndTranslate(p2);
  const rp3 = rotAndTranslate(p3), rp4 = rotAndTranslate(p4), rp5 = rotAndTranslate(p5);
  addTriangle(rp0, rp1, rp2, colorWall); 
  addTriangle(rp3, rp5, rp4, colorRoof);
  addQuad(rp0, rp3, rp4, rp1, colorWall);
  addQuad(rp2, rp5, rp3, rp0, colorWall);
  addQuad(rp1, rp4, rp5, rp2, colorWall);
  const topCenter = vec3(cx, topY + 0.02, cz);
  pushCuboid(topCenter, vec3(w*0.4, 0.04, d*0.4), colorRoof);
}

function buildTriPrismBuilding(center, baseWidth, baseDepth, floors, rotationDeg) {
  const perFloor = 0.9;
  const totalH = floors * perFloor;
  const cy = -1.0 + totalH / 2;
  pushTriPrism(vec3(center[0], cy, center[2]), vec3(baseWidth, totalH, baseDepth), floors, rotationDeg, PAL.triWall, PAL.triRoof);
}

function buildTent(center, baseWidth, baseDepth, poleHeight, roofHeight, color) {
  const tentColor = color || PAL.tent;
  const cx = center[0], cz = center[2];
  const groundY = -1.0;
  const poleTopY = groundY + poleHeight;
  const apexY = poleTopY + roofHeight;
  const hx = baseWidth / 2, hz = baseDepth / 2;
  const insetFactor = 0.9;
  const p0 = vec4(cx - hx * insetFactor, poleTopY, cz - hz * insetFactor, 1.0);
  const p1 = vec4(cx + hx * insetFactor, poleTopY, cz - hz * insetFactor, 1.0);
  const p2 = vec4(cx + hx * insetFactor, poleTopY, cz + hz * insetFactor, 1.0);
  const p3 = vec4(cx - hx * insetFactor, poleTopY, cz + hz * insetFactor, 1.0);
  const apex = vec4(cx, apexY, cz, 1.0);
  const poleThickness = Math.min(baseWidth, baseDepth) * 0.04;
  pushCuboid(vec3(cx-hx*0.95, (groundY+poleTopY)/2, cz-hz*0.95), vec3(poleThickness, poleHeight, poleThickness), PAL.tentPole);
  pushCuboid(vec3(cx+hx*0.95, (groundY+poleTopY)/2, cz-hz*0.95), vec3(poleThickness, poleHeight, poleThickness), PAL.tentPole);
  pushCuboid(vec3(cx+hx*0.95, (groundY+poleTopY)/2, cz+hz*0.95), vec3(poleThickness, poleHeight, poleThickness), PAL.tentPole);
  pushCuboid(vec3(cx-hx*0.95, (groundY+poleTopY)/2, cz+hz*0.95), vec3(poleThickness, poleHeight, poleThickness), PAL.tentPole);
  pushCuboid(vec3(cx, groundY + 0.02, cz), vec3(baseWidth*0.6, 0.04, baseDepth*0.6), vec4(0.95,0.95,0.95,1.0));
  addTriangle(p0, p1, apex, tentColor);
  addTriangle(p1, p2, apex, tentColor);
  addTriangle(p2, p3, apex, tentColor);
  addTriangle(p3, p0, apex, tentColor);
}

function generateRandomParkedCars() {
  const allParkingSlots = [];
  const startZ = 2.7, endZ = -0.6, stepZ = -0.55;
  for (let z = startZ; z >= endZ - 0.01; z += stepZ) { allParkingSlots.push(vec3(4.9, -0.78, z)); }
  for (let z = startZ; z >= endZ - 0.01; z += stepZ) { allParkingSlots.push(vec3(8.2, -0.78, z)); }
  allParkingSlots.sort(() => 0.5 - Math.random());
  const numCars = Math.floor(Math.random() * 14) + 1;
  for (let i = 0; i < numCars; i++) {
    const color = PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)];
    buildCar(allParkingSlots[i], color);
  }
}

function generateRandomMotorcycles() {
  const allMotorcycleSlots = [];
  const xSections = [-4.8, -5.6, -6.4, -7.2];
  const startZ = -3.35, endZ = 3.3, stepZ = 0.35;
  for (const x of xSections) {
    for (let z = startZ; z <= endZ + 0.01; z += stepZ) {
      allMotorcycleSlots.push(vec3(x, -0.82, z));
    }
  }
  allMotorcycleSlots.sort(() => 0.5 - Math.random());
  const numMotorcycles = Math.floor(Math.random() * 72) + 5;
  for (let i = 0; i < numMotorcycles; i++) {
    const color = PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)];
    buildMotorcycle(allMotorcycleSlots[i], color);
  }
}

function buildModel() {
  positions = []; colors = []; normals = []; indices = [];
  vertexCount = 0;
  numPositions = 0;

  pushCuboid(vec3(0, -1.0, 0), vec3(20, 0.05, 20), PAL.ground);
  const floors = 3, floorHeight = 1, totalHeight = floors * floorHeight;
  buildWing(vec3(-2.6, -1.0 + totalHeight / 2, 0.5), vec3(2.1, totalHeight, 5), floors);
  buildWing(vec3(2.6, -1.0 + totalHeight / 2, 0.5), vec3(2.1, totalHeight, 5), floors);
  buildWing(vec3(0, -1.0 + totalHeight / 2, -3), vec3(3.5, totalHeight, 2.1), floors);
  buildTower(vec3(-2.6, totalHeight/2, -3), vec3(1.25, 3, 1.25));
  buildTower(vec3(2.6, totalHeight/2, -3), vec3(1.25, 3, 1.25));
  buildTower(vec3(-6.3, -2.0 + totalHeight/2, -4.5), vec3(1, 1, 1));
  buildTower(vec3(-0.8, -2.15 + totalHeight/2, 3.5), vec3(0.7, 0.7, 0.7));
  buildParkingLot(vec3(0, -0.95, -1.5), vec3(17.6, 0.02, 11), 0);
  buildParkingLot(vec3(-6, -0.95, 0), vec3(3, 0.02, 7), 20);
  buildParkingLot(vec3(-7.5, -0.95, 0), vec3(2, 0.02, 7), 20);
  buildParkingLot(vec3(-4.5, -0.95, 0), vec3(2, 0.02, 7), 20);
  buildTent(vec3(0, -1.0, -5.2), 3.5, 1.7, 1.6, 0.6, PAL.canopyGrey);
  buildCar90(vec3(-1.4, -0.78, -5.2), PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)]);
  buildCar90(vec3(-0.7, -0.78, -5.2), PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)]);
  buildCar90(vec3(0, -0.78, -5.2), PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)]);
  buildCar90(vec3(0.7, -0.78, -5.2), PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)]);
  buildCar90(vec3(1.4, -0.78, -5.2), PAL.carBody[Math.floor(Math.random() * PAL.carBody.length)]);
  generateRandomParkedCars();
  generateRandomMotorcycles();
  plantTreesInArea(vec3(0, -1.0, 5.0), vec3(18, 0, 1), 20);
  plantTreesInArea(vec3(-1, -1.0, -8.5), vec3(16, 0, 1), 13);
  plantTreesInArea(vec3(-9.4, -1.0, -0.75), vec3(1, 0, 10), 10);
  plantTreesInArea(vec3(9.4, -1.0, -0.5), vec3(1, 0, 10), 12);
  smallplantTreesInArea(vec3(4, -1.0, 0), vec3(0.3, 0, 5), 8);
  smallplantTreesInArea(vec3(-4, -1.0, 0), vec3(0.3, 0, 5), 8);
  smallerplantTreesInArea(vec3(0, -1.0, -8.5), vec3(4.5, 0, 0.3), 15);
  smallerplantTreesInArea(vec3(1.3, -1.0, 0.5), vec3(0.3, 0, 4.5), 11);
  smallerplantTreesInArea(vec3(-1.3, -1.0, 0.5), vec3(0.3, 0, 4.5), 11);
  mossInArea(vec3(6.5, -1.0, 0.5), vec3(0.3, 0, 4.8), 100);
  smallplantTreesInArea(vec3(6.3, -1.0, -3.5), vec3(0.5, 0, 0.5), 1);
  buildTriPrismBuilding(vec3(-2.6, -1.0, -3), 2, 2, 3, 180);
  buildTriPrismBuilding(vec3(2.6, -1.0, -3), 2, 2, 3, 270);
  buildTent(vec3(0, -1.0, -0.5), 2.3, 1.6, 1.4, 0.6);
  buildTent(vec3(-7.7, -1.0, -4.8), 1.2, 2, 0.8, 0.5);
  buildTent(vec3(-8, -1.0, -2.3), 0.8, 3, 0.8, 0.5);
  buildTent(vec3(2.6, -1.0, -3), 1.15, 1.15, 1.15, 0.1);
  buildTent(vec3(-2.6, -1.0, -3), 1.15, 1.15, 1.15, 0.1);
}

function calculateSunDirection() {
  const azRad = sunAzimuth * Math.PI / 180;
  const elRad = sunElevation * Math.PI / 180;
  return [ Math.cos(elRad) * Math.sin(azRad), Math.sin(elRad), Math.cos(elRad) * Math.cos(azRad) ];
}

function init() {
  canvas = document.getElementById("gl-canvas");
  gl = canvas.getContext("webgl2");
  if (!gl) { alert("WebGL 2 not available"); return; }

  let isDragging = false, lastX, lastY;
  canvas.addEventListener("mousedown", (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
  canvas.addEventListener("mouseup", () => isDragging = false);
  canvas.addEventListener("mouseout", () => isDragging = false);
  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    modelTheta[1] += (e.clientX - lastX) * 0.5;
    modelTheta[0] -= (e.clientY - lastY) * 0.5;
    document.getElementById('rxRange').value = modelTheta[0];
    document.getElementById('ryRange').value = modelTheta[1];
    document.getElementById('rx').textContent = Math.round(modelTheta[0]);
    document.getElementById('ry').textContent = Math.round(modelTheta[1]);
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault(); 
    const scaleFactor = ev.deltaY < 0 ? 1.05 : 1 / 1.05;
    const s = Math.max(0.05, Math.min(5.0, Number(document.getElementById('sRange').value) * scaleFactor));
    modelScale = [s, s, s];
    document.getElementById('sRange').value = s;
    document.getElementById('sVal').textContent = s.toFixed(2);
  });
  
  const resizeObserver = new ResizeObserver(() => {
    const rect = canvas.parentElement.getBoundingClientRect();
    
    const aspect = 800 / 600;
    const newWidth = rect.width;
    const newHeight = newWidth / aspect;

    
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  });
  resizeObserver.observe(canvas.parentElement);


  gl.clearColor(0.6, 0.8, 1.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  cBuffer = gl.createBuffer();
  vBuffer = gl.createBuffer();
  nBuffer = gl.createBuffer();
  iBuffer = gl.createBuffer();

  colorLocAttrib = gl.getAttribLocation(program, "aColor");
  posLocAttrib = gl.getAttribLocation(program, "aPosition");
  normalLocAttrib = gl.getAttribLocation(program, "aNormal");
  
  // NEW: Get new uniform locations
  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

  lightDirLoc = gl.getUniformLocation(program, "uLightDirection");
  lightColorLoc = gl.getUniformLocation(program, "uLightColor");
  ambientColorLoc = gl.getUniformLocation(program, "uAmbientColor");
  shadowFactorLoc = gl.getUniformLocation(program, "uShadowFactor");

  buildModel();
  refreshBuffers();
  requestAnimationFrame(render);
}

function refreshBuffers() {
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
  gl.vertexAttribPointer(colorLocAttrib, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorLocAttrib);
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);
  gl.vertexAttribPointer(posLocAttrib, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLocAttrib);
  gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
  gl.vertexAttribPointer(normalLocAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(normalLocAttrib);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

function render(now) {
  now = now || 0;
  const dt = now - lastTime;
  lastTime = now;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (spinEnabled) {
    modelTheta[1] = (modelTheta[1] + 0.02 * dt) % 360;
    // Update slider to reflect spin
    const ryRange = document.getElementById('ryRange');
    const ryDisplay = document.getElementById('ry');
    if (ryRange && ryDisplay) {
        ryRange.value = modelTheta[1];
        ryDisplay.textContent = Math.round(modelTheta[1]);
    }
  }

  // MVP Matrix Calculation
  let modelMatrix = mult(translate(modelTranslate[0], modelTranslate[1], modelTranslate[2]),
                    mult(rotateZ(modelTheta[2]),
                    mult(rotateY(modelTheta[1]),
                    mult(rotateX(modelTheta[0]),
                        scale(modelScale[0], modelScale[1], modelScale[2]))))); // <-- Perubahan di sini

  // View Matrix
  let viewMatrix = lookAt(eye, at, up);

  // ModelView Matrix
  modelViewMatrix = mult(viewMatrix, modelMatrix);
  
  // Projection Matrix
  aspect = canvas.width / canvas.height;
  if (projectionType === 'perspective') {
      projectionMatrix = perspective(fovy, aspect, near, far);
  } else {
      projectionMatrix = ortho(orthoLeft, orthoRight, orthoBottom, orthoTop, near, far);
  }

  // lighting
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
  
  const sunDir = calculateSunDirection();
  gl.uniform3fv(lightDirLoc, new Float32Array(sunDir));
  gl.uniform3fv(lightColorLoc, new Float32Array([1.0, 0.95, 0.8])); 
  gl.uniform3fv(ambientColorLoc, new Float32Array([0.3, 0.35, 0.4])); 
  gl.uniform1f(shadowFactorLoc, shadowIntensity);

  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  requestAnimationFrame(render);
}

function toggleSpin() { spinEnabled = !spinEnabled; }

function keyboardControl(ev) {
  const step = 0.05, sstep = 0.05;
  if (ev.key === "ArrowLeft") modelTranslate[0] -= step;
  else if (ev.key === "ArrowRight") modelTranslate[0] += step;
  else if (ev.key === "ArrowUp") modelTranslate[1] += step;
  else if (ev.key === "ArrowDown") modelTranslate[1] -= step;
  else if (ev.key === "+") { const s = modelScale[0] + sstep; modelScale = [s,s,s]; }
  else if (ev.key === "-") { const s = modelScale[0] - sstep; modelScale = [s,s,s]; }
  else if (ev.key === "r" || ev.key === "R") {
    modelTheta = [-16, -132, 0]; modelTranslate = [0, 0, 0]; modelScale = [0.32, 0.32, 0.32];
  }
  return false;
}

window.onload = function() {
  init();
  const el = (id) => document.getElementById(id);
  
  // Object Transform Controls
  const transformRanges = {
    rx: el('rxRange'), ry: el('ryRange'), rz: el('rzRange'),
    tx: el('txRange'), ty: el('tyRange'), tz: el('tzRange'), s: el('sRange')
  };
  const transformDisplays = {
    rx: el('rx'), ry: el('ry'), rz: el('rz'),
    tx: el('tx'), ty: el('ty'), tz: el('tz'), s: el('sVal')
  };
  
  // Lighting Controls
  const lightingRanges = {
    sunAz: el('sunAzRange'), sunEl: el('sunElRange'), shadowInt: el('shadowIntRange')
  };
  const lightingDisplays = {
    sunAz: el('sunAz'), sunEl: el('sunEl'), shadowInt: el('shadowInt')
  };

  // Camera and Projection]
  const cameraRanges = {
      eyeX: el('eyeXRange'), eyeY: el('eyeYRange'), eyeZ: el('eyeZRange')
  };
  const cameraDisplays = {
      eyeX: el('eyeXVal'), eyeY: el('eyeYVal'), eyeZ: el('eyeZVal')
  };
  const projectionRanges = {
      fovy: el('fovyRange'), orthoLR: el('orthoLRRange'), orthoBT: el('orthoBTRange'),
      near: el('nearRange'), far: el('farRange')
  };
  const projectionDisplays = {
      fovy: el('fovyVal'), orthoLR: el('orthoLRVal'), orthoBT: el('orthoBTVal'),
      near: el('nearVal'), far: el('farVal')
  };
  const projTypeSelect = el('projectionType');

  function updateDisplays() {
    transformDisplays.rx.textContent = transformRanges.rx.value;
    transformDisplays.ry.textContent = transformRanges.ry.value;
    transformDisplays.rz.textContent = transformRanges.rz.value;
    transformDisplays.tx.textContent = Number(transformRanges.tx.value).toFixed(2);
    transformDisplays.ty.textContent = Number(transformRanges.ty.value).toFixed(2);
    transformDisplays.tz.textContent = Number(transformRanges.tz.value).toFixed(2);
    transformDisplays.s.textContent = Number(transformRanges.s.value).toFixed(2);
    
    lightingDisplays.sunAz.textContent = lightingRanges.sunAz.value;
    lightingDisplays.sunEl.textContent = lightingRanges.sunEl.value;
    lightingDisplays.shadowInt.textContent = Number(lightingRanges.shadowInt.value).toFixed(1);

    cameraDisplays.eyeX.textContent = Number(cameraRanges.eyeX.value).toFixed(1);
    cameraDisplays.eyeY.textContent = Number(cameraRanges.eyeY.value).toFixed(1);
    cameraDisplays.eyeZ.textContent = Number(cameraRanges.eyeZ.value).toFixed(1);

    projectionDisplays.fovy.textContent = projectionRanges.fovy.value;
    projectionDisplays.orthoLR.textContent = projectionRanges.orthoLR.value;
    projectionDisplays.orthoBT.textContent = projectionRanges.orthoBT.value;
    projectionDisplays.near.textContent = Number(projectionRanges.near.value).toFixed(1);
    projectionDisplays.far.textContent = projectionRanges.far.value;
  }
  
  function setupEventListeners() {
    Object.keys(transformRanges).forEach(key => {
        transformRanges[key].addEventListener('input', () => {
            modelTheta = [Number(transformRanges.rx.value), Number(transformRanges.ry.value), Number(transformRanges.rz.value)];
            modelTranslate = [Number(transformRanges.tx.value), Number(transformRanges.ty.value), Number(transformRanges.tz.value)];
            const s = Number(transformRanges.s.value);
            modelScale = [s, s, s];
            updateDisplays();
        });
    });

    Object.keys(lightingRanges).forEach(key => {
        lightingRanges[key].addEventListener('input', () => {
            sunAzimuth = Number(lightingRanges.sunAz.value);
            sunElevation = Number(lightingRanges.sunEl.value);
            shadowIntensity = Number(lightingRanges.shadowInt.value);
            updateDisplays();
        });
    });

    Object.keys(cameraRanges).forEach(key => {
        cameraRanges[key].addEventListener('input', () => {
            eye = vec3(Number(cameraRanges.eyeX.value), Number(cameraRanges.eyeY.value), Number(cameraRanges.eyeZ.value));
            updateDisplays();
        });
    });

    projTypeSelect.addEventListener('change', (e) => {
        projectionType = e.target.value;
        el('perspective-controls').style.display = (projectionType === 'perspective') ? 'block' : 'none';
        el('ortho-controls').style.display = (projectionType === 'ortho') ? 'block' : 'none';
    });
    
    Object.keys(projectionRanges).forEach(key => {
        projectionRanges[key].addEventListener('input', () => {
            fovy = Number(projectionRanges.fovy.value);
            const lr = Number(projectionRanges.orthoLR.value);
            orthoLeft = -lr; orthoRight = lr;
            const bt = Number(projectionRanges.orthoBT.value);
            orthoBottom = -bt; orthoTop = bt;
            near = Number(projectionRanges.near.value);
            far = Number(projectionRanges.far.value);
            updateDisplays();
        });
    });

    el('btnReset').addEventListener('click', () => {
      transformRanges.rx.value = 0; transformRanges.ry.value = -132; transformRanges.rz.value = 0;
      transformRanges.tx.value = 0; transformRanges.ty.value = 0; transformRanges.tz.value = 0;
      transformRanges.s.value = 0.32;
      cameraRanges.eyeX.value = 1.0; cameraRanges.eyeY.value = 2.5; cameraRanges.eyeZ.value = 3.8;
      projTypeSelect.value = 'perspective';
      projectionRanges.fovy.value = 63; projectionRanges.near.value = 0.1; projectionRanges.far.value = 100;

      transformRanges.rx.dispatchEvent(new Event('input'));
      cameraRanges.eyeX.dispatchEvent(new Event('input'));
      projTypeSelect.dispatchEvent(new Event('change'));
      projectionRanges.fovy.dispatchEvent(new Event('input'));
    });
    
    el('btnToggleSpin').addEventListener('click', toggleSpin);
    window.addEventListener('keydown', keyboardControl);
  }

  setupEventListeners();
  updateDisplays();
  // Trigger initial event to hide/show correct projection controls
  projTypeSelect.dispatchEvent(new Event('change'));
};