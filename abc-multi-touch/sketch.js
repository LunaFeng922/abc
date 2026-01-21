function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  background(255, 255, 190);
}

function draw() {
  fill(0);
  circle(width/2, height/2, 100);

}

// P5 touch events: https://p5js.org/reference/#Touch

function touchStarted() {
  console.log(touches);


   for (let i = 0; i < touches.length; i++) {
    let x = touches[i].x;
    let y = touches[i].y;
    circle(x, y, 100);
  }
}

function touchMoved() {
}

function touchEnded() {
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}
