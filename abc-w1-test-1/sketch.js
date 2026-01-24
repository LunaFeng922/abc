let organs = ["@", "^", "(", ")", "%", "$", "#", "&", "*", "<", ">", "?", "=", "+", "-", "~", ".", ";", ":"];
let touchToOrgan = {};

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  background(255, 255, 190);
}

function draw() {}

function touchStarted() {
  for (let i = 0; i < touches.length; i++) {
    if (touchToOrgan[touches[i].id] == null) {
    touchToOrgan[touches[i].id] = random(organs);
    }
  }
}

function touchMoved() {
  background(255, 255, 190);
  for (let i = 0; i < touches.length; i++) {
    let organ = touchToOrgan[touches[i].id];
    let x = touches[i].x;
    let y = touches[i].y;
    let d = dist(x, y, width/2, height/2);
    let dMax = dist(0, 0, width/2, height/2);
    let sizeN = map(d, 0, dMax, 1, 0.3);
    textSize(min(width/3*sizeN, height/3*sizeN));
    //textSize(min(width/3, height/3));
    //textSize(width / touches.length);
    textAlign(CENTER, CENTER);
    text(organ,x,y);
  }
  return false;
}

function touchEnded() {
//background(255, 255, 190);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}