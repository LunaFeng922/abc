let organs = ["@", "^", "(", ")", "%", "$", "#", "&", "*"];
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
  textSize(min(width/3, height/3));
  //textSize(width / touches.length);
  textAlign(CENTER, CENTER);
  for (let i = 0; i < touches.length; i++) {
    let organ = touchToOrgan[touches[i].id];
    let x = touches[i].x;
    let y = touches[i].y;
    text(organ,x,y);
  }
  return false;
}

function touchEnded() {
background(255, 255, 190);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}