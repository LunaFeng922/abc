// ── socket ────────────────────────────────────────────────────
let socket;
if (
  location.hostname.toLowerCase().startsWith("browsercircus") ||
  location.hostname.toLowerCase().startsWith("www")
) {
  socket = io({ path: "/ruiqi/port-4260/socket.io" });
} else {
  socket = io();
}
const myUserId = localStorage.getItem("user-id");

// ── pet images ────────────────────────────────────────────────
let petName = "?";
let front1, front2, left1, left2, right1, right2;
let petReady = false;

// ── coordinate system ─────────────────────────────────────────
let WORLD = 800;

function s(v) {
  let side = min(width, height);
  return (v / WORLD) * side;
}
function sx(wx) {
  let side = min(width, height);
  let offsetX = (width - side) / 2;
  return (wx / WORLD) * side + offsetX;
}
function sy(wy) {
  let side = min(width, height);
  let offsetY = (height - side) / 2;
  return (wy / WORLD) * side + offsetY;
}
// screen - world
function toWX(px) {
  let side = min(width, height);
  let offsetX = (width - side) / 2;
  return ((px - offsetX) / side) * WORLD;
}
function toWY(py) {
  let side = min(width, height);
  let offsetY = (height - side) / 2;
  return ((py - offsetY) / side) * WORLD;
}

// ── world constants ───────────────────────────────────────────
const CX = 400,
  CY = 400,
  CR = 220;
const startX = CX,
  startY = CY - CR; // top of circle

// ── pet state ─────────────────────────────────────────────────
let petX = startX,
  petY = startY;
let petTx = startX,
  petTy = startY;
let petVx = 0;
let wanderAngle = 0;

// ── food (local only) ─────────────────────────────────────────
let foods = [];

// ── trail ─────────────────────────────────────────────────────
let trail = [];
let lastTX = -999,
  lastTY = -999;

// ── lap tracking ──────────────────────────────────────────────
let totalAngle = 0;
let prevAngle = 0;
let petLeftStart = false;
let gameOver = false;
let gameStarted = false;

// ── p5 ────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("sans-serif");
  prevAngle = atan2(startY - CY, startX - CX);
  loadPetFromServer();
}

function draw() {
  background(168, 230, 207);

  if (!petReady) {
    fill(50);
    noStroke();
    textSize(18);
    textAlign(CENTER, CENTER);
    text("loading...", width / 2, height / 2);
    return;
  }

  if (gameOver) return;

  drawForbiddenZone();
  drawTargetCircle();
  drawStartMarker();
  drawTrail();
  drawFoods();
  updatePet();
  drawPet();
  updateHUD();
  drawFoodSlots();
}

// ── draw functions ────────────────────────────────────────────

function drawForbiddenZone() {
  let cx = sx(CX),
    cy = sy(CY),
    cr = s(CR);
  let g = drawingContext;

  g.save();
  g.beginPath();
  g.arc(cx, cy, cr, 0, Math.PI * 2);
  g.clip();

  g.strokeStyle = "rgba(220, 60, 60, 0.25)";
  g.lineWidth = 1.5;
  let spacing = s(20);
  for (let i = -cr * 3; i < cr * 3; i += spacing) {
    g.beginPath();
    g.moveTo(cx + i, cy - cr * 2);
    g.lineTo(cx + i - cr * 2, cy + cr * 2);
    g.stroke();
  }
  g.restore();
}

function drawTargetCircle() {
  let cx = sx(CX),
    cy = sy(CY),
    cr = s(CR);
  drawingContext.setLineDash([s(12), s(8)]);
  stroke(220, 60, 60, 200);
  strokeWeight(3);
  noFill();
  circle(cx, cy, cr * 2);
  drawingContext.setLineDash([]);
}

function drawStartMarker() {
  let x = sx(startX),
    y = sy(startY);
  noStroke();
  fill(50, 200, 100, 200);
  circle(x, y, s(36));
  fill(255);
  textSize(s(16));
  textAlign(CENTER, CENTER);
  text("START", x, y);
}

function drawTrail() {
  noStroke();
  textAlign(CENTER, CENTER);
  trail.forEach((pt) => {
    // white glow behind poop
    drawingContext.shadowColor = "rgba(255,255,255,0.9)";
    drawingContext.shadowBlur = s(8);
    textSize(s(22));
    text("💩", sx(pt.x), sy(pt.y));
    drawingContext.shadowColor = "transparent";
    drawingContext.shadowBlur = 0;
  });
}

function drawFoods() {
  noStroke();
  textAlign(CENTER, CENTER);
  foods.forEach((f) => {
    textSize(s(26));
    text("🍖", sx(f.x), sy(f.y));
  });
}

function drawPet() {
  let f = floor(millis() / 500) % 2;
  let img;
  if (petVx < -0.3) img = f === 0 ? right1 : right2;
  else if (petVx > 0.3) img = f === 0 ? left1 : left2;
  else img = f === 0 ? front1 : front2;
  if (!img) return;

  let px = sx(petX),
    py = sy(petY),
    sz = s(120);

  drawingContext.shadowOffsetX = 2;
  drawingContext.shadowOffsetY = 4;
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = "rgba(0,0,0,0.3)";
  imageMode(CENTER);
  image(img, px, py, sz, sz);
  imageMode(CORNER);
  drawingContext.shadowColor = "transparent";

  noStroke();
  fill(30);
  textSize(s(14));
  textAlign(CENTER, CENTER);
  strokeWeight(2);
  stroke(255, 120);
  text(petName, px, py + sz / 2 + s(10));
  noStroke();
}

function drawFoodSlots() {
  let maxFoods = 2;
  noStroke();
  fill(30, 30, 30, 160);
  textAlign(LEFT, CENTER);
  textSize(s(12));
  text("food slot:", s(20) + (width - min(width, height)) / 2, height - s(40));
  for (let i = 0; i < maxFoods; i++) {
    let bx = s(110 + i * 60) + (width - min(width, height)) / 2;
    let by = height - s(40);
    if (i < foods.length) {
      textSize(s(26));
      textAlign(CENTER, CENTER);
      text("🍖", bx, by);
    } else {
      noStroke();
      fill(100, 100, 100, 80);
      circle(bx, by, s(34));
    }
  }
}

function updateHUD() {
  let pct = min(100, round((abs(totalAngle) / TWO_PI) * 100));
  document.getElementById("lap-text").innerText = "lap: " + pct + "%";
}

// ── pet movement ──────────────────────────────────────────────
function updatePet() {
  let nearest = null,
    minD = Infinity;
  foods.forEach((f) => {
    let d = dist(f.x, f.y, petX, petY);
    if (d < minD) {
      minD = d;
      nearest = f;
    }
  });

  let prevTx = petTx;

  if (nearest) {
    let a = atan2(nearest.y - petY, nearest.x - petX);
    petTx += cos(a) * 3;
    petTy += sin(a) * 3;
    if (minD < 15) foods = foods.filter((f) => f.id !== nearest.id);
  } else {
    wanderAngle += random(-0.08, 0.08);
    petTx += cos(wanderAngle) * 0.6;
    petTy += sin(wanderAngle) * 0.6;
  }

  petTx = constrain(petTx, 20, 780);
  petTy = constrain(petTy, 20, 780);

  petVx = petTx - prevTx;
  petX = lerp(petX, petTx, 0.07);
  petY = lerp(petY, petTy, 0.07);

  // trail
  if (gameStarted && dist(petX, petY, lastTX, lastTY) > 14) {
    trail.push({ x: petX, y: petY });
    lastTX = petX;
    lastTY = petY;
  }

  // lap angle
  let a = atan2(petY - CY, petX - CX);
  let delta = a - prevAngle;
  if (delta > PI) delta -= TWO_PI;
  if (delta < -PI) delta += TWO_PI;
  totalAngle += delta;
  prevAngle = a;

  if (!petLeftStart && dist(petX, petY, startX, startY) > 40) {
    petLeftStart = true;
  }

  if (petLeftStart && !gameOver && abs(totalAngle) >= TWO_PI) {
    gameOver = true;
    setTimeout(showResult, 500);
  }
}

// ── touch → place food ────────────────────────────────────────
function touchStarted() {
  // 如果点击的是 HTML 元素（按钮等），不拦截
  if (document.activeElement !== document.body) return;
  if (event && event.target && event.target.tagName !== "CANVAS") return;

  if (!petReady || gameOver) return false;
  if (!gameStarted) gameStarted = true;

  let tx = touches.length > 0 ? touches[0].x : mouseX;
  let ty = touches.length > 0 ? touches[0].y : mouseY;

  let wx2 = toWX(tx);
  let wy2 = toWY(ty);

  if (dist(wx2, wy2, CX, CY) < CR) return false;

  if (foods.length >= 2) foods.shift();
  foods.push({ id: Date.now(), x: wx2, y: wy2 });
  return false;
}

// ── result ────────────────────────────────────────────────────
function showResult() {
  let hit = trail.filter(
    (pt) => abs(dist(pt.x, pt.y, CX, CY) - CR) < 35,
  ).length;
  let score = trail.length == 0 ? 0 : round((hit / trail.length) * 100);

  let weightReduced;
  let happyScore;
  let emoji, stars, msg;
  if (score >= 80) {
    emoji = "💩💩💩";
    msg = "Poop artist!";
    weightReduced = 10;
    happyScore = 10;
  } else if (score >= 55) {
    emoji = "💩💩";
    msg = "Well done!";
    weightReduced = 5;
    happyScore = 5;
  } else {
    emoji = "💩";
    msg = "Perfect pooping require more practice.";
    weightReduced = 1;
    happyScore = 1;
  }

  socket.emit("reduced-weight-by-game", {
    userId: myUserId,
    amount: weightReduced,
  });
  socket.emit("happy-score-by-game", { userId: myUserId, amount: happyScore });

  document.getElementById("result-score").innerText = score + "%";
  document.getElementById("result-emoji").innerText = emoji;
  document.getElementById("result-weight").innerText =
    "⚖️ -" + weightReduced + " weight";
  document.getElementById("result-happy").innerText =
    "😊 +" + happyScore + " happy";
  document.getElementById("result-msg").innerText = msg;
  document.getElementById("result").classList.add("show");
}

function retryGame() {
  foods = [];
  trail = [];
  lastTX = -999;
  lastTY = -999;
  totalAngle = 0;
  petLeftStart = false;
  gameOver = false;
  gameStarted = false;
  petX = startX;
  petY = startY;
  petTx = startX;
  petTy = startY;
  prevAngle = atan2(startY - CY, startX - CX);
  document.getElementById("result").classList.remove("show");
}

// ── load pet ──────────────────────────────────────────────────
function loadPetFromServer() {
  socket.on("my-pet-data", (data) => {
    if (!data) {
      alert("You don't have a pet yet!");
      location.href = "/create";
      return;
    }
    petName = data.petName;

    let keys = ["front1", "front2", "left1", "left2", "right1", "right2"];
    let loaded = 0;
    keys.forEach((k) => {
      loadImage("/" + data[k], (img) => {
        if (k === "front1") front1 = img;
        if (k === "front2") front2 = img;
        if (k === "left1") left1 = img;
        if (k === "left2") left2 = img;
        if (k === "right1") right1 = img;
        if (k === "right2") right2 = img;
        loaded++;
        if (loaded === keys.length) petReady = true;
      });
    });
  });

  if (socket.connected) {
    socket.emit("get-my-pet", { userId: myUserId });
  } else {
    socket.on("connect", () => {
      socket.emit("get-my-pet", { userId: myUserId });
    });
  }
}
