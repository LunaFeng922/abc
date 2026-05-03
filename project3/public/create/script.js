// ── DOM references ────────────────────────────────────────────
let video;
let canvas;
let camSound = document.querySelector("#camSound");
let sendButton = document.querySelector("#sendButton");
let previewButton = document.querySelector("#preview-button");
let captureButton = document.querySelector("#captureButton");
let userNameWrapper = document.querySelector("#user-nameWrapper");
let userNameInput = document.querySelector("#userNameInput");
let userNameButton = document.querySelector("#userNameButton");
let captureArea = document.querySelector("#captureArea");
let petNameWrapper = document.getElementById("pet-name-input-wrapper");
let petNameInput = document.getElementById("pet-name-input");
let colorInput = document.getElementById("color-picker");
let sizeSlider = document.getElementById("size-slider");

// ── Canvas / video settings ───────────────────────────────────
let canvasW = 480,
  canvasH = 480;
let videoW = 480,
  videoH = 640;
let videoOffsetY = -(videoH - canvasH) / 2;
let videoOffsetX = -(videoW - canvasW) / 2;
let canvasDisplayWidth, canvasDisplayHeight;
let videoGraphic;
let circleRatio = 0.4;

// ── Drawing tools ─────────────────────────────────────────────
let penStrokeW = 2;
let isErasing = false;
let drawLayer;
let curShape = "line";
let lastX = 0,
  lastY = 0;

// ── Flow state ────────────────────────────────────────────────
// phase: "snap" | "draw" | "preview"
// snapIndex: 0=front, 1=left, 2=right  (only used during snap phase)
// frameStep: 1 or 2  (only used during draw phase)
let phase = "snap";
let snapIndex = 0; // which face we're currently snapping
let frameStep = 1; // which draw frame
let snapped = false;
let petNamed = false;
let petName = "";
let frameDuration = 500;

// ── Saved data ────────────────────────────────────────────────
// 3 frozen face graphics
let faceImgs = [null, null, null]; // front, left, right
// 2 draw layers
let drawFrame1 = null; // saved draw layer frame 1
let drawFrame2 = null; // saved draw layer frame 2

let faceLabels = ["FRONT", "LEFT", "RIGHT"];

// ── Socket ────────────────────────────────────────────────────
let socket;
if (
  location.hostname.toLowerCase().startsWith("browsercircus") ||
  location.hostname.toLowerCase().startsWith("www")
) {
  socket = io({ path: "/ruiqi/port-4260/socket.io" });
} else {
  socket = io();
}

// ── User ID / Name ────────────────────────────────────────────
function getOrCreateUserId() {
  let id = localStorage.getItem("user-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("user-id", id);
  }
  return id;
}
let myUserId = getOrCreateUserId();
let myUsername = null;

function showCaptureArea() {
  userNameWrapper.style.display = "none";
  captureArea.style.display = "flex";
}
function getOrCreateUserName() {
  let name = localStorage.getItem("user-name");
  if (name) {
    userNameInput.value = name;
    showCaptureArea();
  }
  return name;
}
myUsername = getOrCreateUserName();

userNameButton.addEventListener("click", () => {
  let val = userNameInput.value.trim();
  if (!val) {
    alert("Please enter your name!");
    return;
  }
  myUsername = val;
  localStorage.setItem("user-name", myUsername);
  socket.emit("identify", { userId: myUserId, username: myUsername });
  showCaptureArea();
});

// ── p5 setup ──────────────────────────────────────────────────
function setup() {
  canvas = createCanvas(canvasW, canvasH);
  canvas.parent("canvas-wrapper");

  canvasDisplayHeight = window.innerHeight * 0.5;
  canvas.elt.style.height = canvasDisplayHeight + "px";
  canvasDisplayWidth = canvasDisplayHeight * (canvasW / canvasH);
  canvas.elt.style.width = canvasDisplayWidth + "px";

  videoGraphic = createGraphics(canvasW, canvasH);
  video = createCapture({ video: { facingMode: "user" }, audio: false });
  video.size(canvasW, canvasH);
  video.hide();

  drawLayer = createGraphics(canvasW, canvasH);
  drawLayer.clear();
  background(255);
  updateInstruction();
}

// ── p5 draw loop ──────────────────────────────────────────────
function draw() {
  strokeWeight(5);
  stroke(255);
  noFill();
  rect(0, 0, width, height);

  // PREVIEW: cycle through all 6 combinations
  if (phase === "preview") {
    background(205, 234, 255);
    // 6 frames: front1, front2, left1, left2, right1, right2
    let f = Math.floor(millis() / frameDuration) % 6;
    let faceIdx = Math.floor(f / 2); // 0,0,1,1,2,2
    let frameIdx = f % 2; // 0,1,0,1,0,1
    let faceG = faceImgs[faceIdx];
    let drawG = frameIdx === 0 ? drawFrame1 : drawFrame2;
    if (faceG && drawG) {
      image(faceG, 0, 0);
      image(drawG, 0, 0);
    }
    return;
  }

  background(255);

  // SNAP: live camera or frozen
  if (phase === "snap") {
    if (!snapped) {
      videoGraphic.clear();
      videoGraphic.push();
      videoGraphic.circle(
        videoGraphic.width / 2,
        videoGraphic.height / 2,
        videoGraphic.width * circleRatio,
      );
      videoGraphic.canvas.getContext("2d").clip();
      videoGraphic.translate(videoGraphic.width, 0);
      videoGraphic.scale(-1, 1);
      videoGraphic.image(video, videoOffsetX, videoOffsetY, videoW, videoH);
      videoGraphic.pop();
    }
    image(videoGraphic, 0, 0);
    return;
  }

  // DRAW: show front face as base, ghost frame1 if on frame2
  if (phase === "draw") {
    if (faceImgs[0]) image(faceImgs[0], 0, 0); // always draw on front face
    if (frameStep === 2 && drawFrame1) {
      tint(255, 80);
      image(drawFrame1, 0, 0);
      noTint();
    }
    image(drawLayer, 0, 0);
    return;
  }
}

// ── CAPTURE BUTTON ────────────────────────────────────────────
captureButton.addEventListener("click", () => {
  if (phase !== "snap") return;

  if (!snapped) {
    snapped = true;
    captureButton.innerText = "Try Again";
    captureButton.style.width = "30%";
    captureButton.style.backgroundColor = "rgb(255, 191, 191)";
    previewButton.style.display = "flex";
    previewButton.innerText = "Save ✓";
    sendButton.style.visibility = "hidden";
  } else {
    snapped = false;
    captureButton.innerText = "SNAP!";
    captureButton.style.width = "50%";
    captureButton.style.backgroundColor = "initial";
    previewButton.style.display = "none";
  }
  updateInstruction();
});

// ── PREVIEW/SAVE BUTTON ───────────────────────────────────────
previewButton.addEventListener("click", () => {
  // Save this face snapshot
  if (phase === "snap" && snapped) {
    faceImgs[snapIndex] = snapFace();

    if (snapIndex < 2) {
      // move to next face
      snapIndex++;
      snapped = false;
      captureButton.innerText = "SNAP!";
      captureButton.style.width = "50%";
      captureButton.style.backgroundColor = "initial";
      previewButton.style.display = "none";
      updateInstruction();
    } else {
      // all 3 faces done → enter draw phase
      phase = "draw";
      frameStep = 1;
      snapped = false;
      captureButton.style.display = "none";
      document.getElementById("pen-tools").style.display = "flex";
      previewButton.innerText = "Save Frame 1";
      drawLayer.clear();
      updateInstruction();
    }
    return;
  }

  // Save draw frame 1
  if (phase === "draw" && frameStep === 1) {
    drawFrame1 = createGraphics(canvasW, canvasH);
    drawFrame1.clear();
    drawFrame1.image(drawLayer, 0, 0);

    frameStep = 2;
    drawLayer.clear();
    previewButton.innerText = "Save Frame 2";
    updateInstruction();
    return;
  }

  // Save draw frame 2 → go to preview
  if (phase === "draw" && frameStep === 2) {
    drawFrame2 = createGraphics(canvasW, canvasH);
    drawFrame2.clear();
    drawFrame2.image(drawLayer, 0, 0);

    phase = "preview";
    document.getElementById("pen-tools").style.display = "none";
    captureButton.style.display = "none";
    previewButton.innerText = "OK, name my pet →";
    updateInstruction();
    return;
  }

  // Name phase
  if (phase === "preview" && !petNamed) {
    petNameWrapper.style.display = "flex";
    previewButton.style.display = "none";
    sendButton.style.visibility = "visible";
  }
});

// ── SEND BUTTON ───────────────────────────────────────────────
sendButton.addEventListener("click", () => {
  sendButton.disabled = true;
  sendButton.style.visibility = "hidden";

  petName = petNameInput.value.trim();
  if (!petName) {
    sendButton.disabled = false;
    sendButton.style.visibility = "visible";
    return;
  }

  petNamed = true;
  localStorage.setItem("curPetName", petName);
  petNameWrapper.style.display = "none";

  // Combine each face with each draw frame → 6 images
  // front1, front2, left1, left2, right1, right2
  let faceKeys = ["front", "left", "right"];
  let frameNums = [1, 2];
  let drawFrames = [drawFrame1, drawFrame2];

  let uploads = [];
  for (let fi = 0; fi < 3; fi++) {
    for (let df = 0; df < 2; df++) {
      uploads.push({
        key: faceKeys[fi] + frameNums[df],
        faceG: faceImgs[fi],
        drawG: drawFrames[df],
      });
    }
  }

  function combineAndUpload(i) {
    if (i >= uploads.length) {
      resetAll();
      window.location.href = "/playground";
      return;
    }
    let { key, faceG, drawG } = uploads[i];
    // combine face + draw into one graphic
    let combined = createGraphics(canvasW, canvasH);
    combined.clear();
    combined.image(faceG, 0, 0);
    combined.image(drawG, 0, 0);

    combined.elt.toBlob((blob) => {
      sendImageToServer(blob, key, () => combineAndUpload(i + 1));
    }, "image/png");
  }
  combineAndUpload(0);
});

// ── Helpers ───────────────────────────────────────────────────
function snapFace() {
  let img = createGraphics(canvasW, canvasH);
  img.clear();
  img.image(videoGraphic, 0, 0);
  return img;
}

function sendImageToServer(blob, frame, callback) {
  let formData = new FormData();
  formData.append("image", blob, "photo.png");
  formData.append("username", myUsername);
  formData.append("petName", petName);
  formData.append("userId", myUserId);
  formData.append("frame", frame);
  fetch("/upload-image", { method: "POST", body: formData }).then(() => {
    if (callback) callback();
  });
}

function resetAll() {
  phase = "snap";
  snapIndex = 0;
  frameStep = 1;
  petNamed = false;
  snapped = false;
  faceImgs = [null, null, null];
  drawFrame1 = null;
  drawFrame2 = null;
  petNameInput.value = "";
  petNameWrapper.style.display = "none";
  sendButton.style.visibility = "hidden";
  captureButton.innerText = "SNAP!";
  captureButton.style.width = "50%";
  captureButton.style.backgroundColor = "initial";
  captureButton.style.display = "block";
  previewButton.style.display = "none";
  document.getElementById("pen-tools").style.display = "none";
  drawLayer.clear();
  updateInstruction();
}

function updateInstruction() {
  let el = document.getElementById("instruction-text");
  if (phase === "snap") {
    if (!snapped)
      el.innerText = "📸 snap your " + faceLabels[snapIndex] + " face";
    else el.innerText = "✓ looks good? save — or try again";
  } else if (phase === "draw") {
    el.innerText = "✏️ decorate your pet — frame " + frameStep + " / 2";
  } else if (phase === "preview") {
    el.innerText = "🎉 looking good! give your pet a name";
  }
}

// ── Drawing ───────────────────────────────────────────────────
function touchStarted() {
  if (phase !== "draw" || touches.length === 0) return;
  lastX = touches[0].x;
  lastY = touches[0].y;
}

function touchMoved() {
  if (phase !== "draw" || touches.length === 0) return;
  let x = touches[0].x,
    y = touches[0].y;

  if (isErasing) {
    drawLayer.erase();
    drawLayer.fill(255);
    drawLayer.circle(x, y, penStrokeW);
    drawLayer.noErase();
  } else {
    drawLayer.stroke(colorInput.value);
    drawLayer.fill(colorInput.value);
    if (curShape === "line") {
      drawLayer.strokeWeight(penStrokeW);
      drawLayer.line(lastX, lastY, x, y);
    } else if (curShape === "strokeCircle") {
      drawLayer.noFill();
      drawLayer.strokeWeight(1);
      drawLayer.circle(x, y, penStrokeW);
    } else if (curShape === "circle") {
      drawLayer.noStroke();
      drawLayer.circle(x, y, penStrokeW);
    }
    lastX = x;
    lastY = y;
  }
}

colorInput.addEventListener("input", updatePen);
sizeSlider.addEventListener("input", updatePen);

function updatePen() {
  penStrokeW = sizeSlider.value * 0.5;
  let size = Math.max(8, parseInt(sizeSlider.value));
  colorInput.style.width = size + "px";
  colorInput.style.height = size + "px";
}

function changeShape(str) {
  isErasing = false;
  curShape = str;
  document.getElementById("eraser-btn").classList.remove("active");
  document
    .querySelectorAll(".shape-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("btn-" + str).classList.add("active");
}

document.getElementById("eraser-btn").addEventListener("click", () => {
  isErasing = !isErasing;
  document.getElementById("eraser-btn").classList.toggle("active", isErasing);
});

document.getElementById("clear-btn").addEventListener("click", () => {
  drawLayer.clear();
});

socket.on("new-image", (data) => {
  console.log(data);
});
