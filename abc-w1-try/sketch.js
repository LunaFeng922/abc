let organs = ["@", "^", "(", ")", "%", "$", "#", "&", "*"];
//map ids of different touches to random organs correspondingly
let touchToOrgan = {};

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  background(255, 255, 190);
}

function draw() {}

function touchStarted() {
  for (let i = 0; i < touches.length; i++) {
    //assign a random organ to a new touch
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
  fill(0);
  //keep the organs for each touch the same as assigned
  for (let i = 0; i < touches.length; i++) {
    let organ = touchToOrgan[touches[i].id];
    let x = touches[i].x;
    let y = touches[i].y;
    text(organ,x,y);
  }
}

function touchEnded() {
//organs only show up when touching
background(255, 255, 190);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}