let alpha = 0;
let beta = 0;
let gamma = 0;

let organs = ["@", "^", "(", ")","$", "#", "&", "*", "<", "?", "=", "+", "-", "~", "'",".", ";", ":"];
let organ_1, organ_2;

let bgs = [[255, 255, 190],[200,0,0],[0, 0, 190]];
let cr_bg=[255, 255, 190];

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  organ_1 = random(organs);
  organ_2 = random(organs);
  cr_bg = random(bgs);
}

function draw() {

//background & text color
  let a = abs(gamma) / (cr_bg[0] + cr_bg[1] + cr_bg[2]);
  background(
    cr_bg[0] * (1 + a),
    cr_bg[1] * (1 + a),
    cr_bg[2] * (1 + a)
  );

  noStroke();
  if (cr_bg[0] === 255 && cr_bg[1] === 255 && cr_bg[2] === 190) {
    fill(0);
  } else {
    fill(255,255,190);
  }

  //orintation values
  push();
  textSize(10);
  text("alpha: " + round(alpha), 10, 30);
  text("beta: " + round(beta), 10, 40);
  text("gamma: " + round(gamma), 10, 50);
  pop();

  //map beta to -90~90
  let betaMapped;

  if (beta >= -90 && beta <= 90) {
    betaMapped = beta;
  } else if (beta > 90) {
    betaMapped = 180 - beta;
  } else {
    betaMapped = -180 - beta;
  }

  //mouth / nose

  if (abs(gamma) > 40) {
    organ_1 = random(organs);
  }

  let tx = map(gamma, -90, 90, -width/2, width/2);
  let ty = map(betaMapped,  -90, 90, -height/4, height/4);

  let sx, sy, r;

  push();
  translate(width/2 + tx, height/2 + ty);

  if (gamma <= 0 && betaMapped >= 0) {
    sx = 1;  sy = 1;
    r = -HALF_PI;
    rotate(radians(alpha));
  } else if (gamma > 0 && betaMapped > 0) {
    sx = -1; sy = 1;
    r = HALF_PI;
    rotate(radians(alpha));
  } else if (gamma> 0 && betaMapped < 0) {
    sx = -1; sy = -1;
    r = -HALF_PI;
    rotate(radians(180 - alpha));
  } else {
    sx = 1;  sy = -1;
    r = HALF_PI;
    rotate(radians(180 - alpha));
  }

if (organ_1=="'"||organ_1=="$"||organ_1=="("||organ_1==")"||organ_1=="#"||organ_1=="?"||organ_1==";"||organ_1==":") {
    rotate(r);
  }

  scale(sx, sy);

  let d = dist(width/2 + tx, height/2 + ty, width/2, height/2);
  let dMax = dist(0, 0, width/2, height/2);
  let sizeN = map(d, 0, dMax, 0.3, 1);

  textSize(width/2 * sizeN);
  textAlign(CENTER, CENTER);
  text(organ_1, 0, 0);
  pop();

  //eyes

  if (abs(betaMapped) > 75 && abs(betaMapped) < 105) {
    organ_2 = random(organs);
    cr_bg = random(bgs);
  }

  let tx2 = map(gamma, -90, 90, -width/4, width/4);
  let ty2 = map(betaMapped,  -90, 90,  height/2, -height/2);


  push();
  translate(width/4 + tx2, height/2 + ty2);

  if (gamma <= 0 && betaMapped >= 0) {
    rotate(radians(gamma));
    scale(1,1);
  } else if (gamma > 0 && betaMapped > 0) {
    rotate(radians(gamma));
    scale(-1,1);
  } else if (gamma > 0 && betaMapped < 0) {
    rotate(radians(-gamma));
    scale(-1,-1);
  } else {
    rotate(radians(-gamma));
    scale(1,-1);
  }

  textSize(width/3 + tx2);
  textAlign(CENTER, CENTER);
  text(organ_2, 0, 0);
  pop();

  
  push();
  translate(width*3/4 + tx2, height/2 + ty2);

  if (gamma <= 0 && betaMapped >= 0) {
    rotate(radians(gamma));
    scale(1,1);
  } else if (gamma > 0 && betaMapped > 0) {
    rotate(radians(gamma));
    scale(-1,1);
  } else if (gamma > 0 && betaMapped < 0) {
    rotate(radians(-gamma));
    scale(-1,-1);
  } else {
    rotate(radians(-gamma));
    scale(1,-1);
  }

  textSize(width/3 - tx2);
  textAlign(CENTER, CENTER);
  text(organ_2, 0, 0);
  pop();
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

function handleOrientation(eventData){
  document.querySelector('#requestOrientationButton').style.display = "none";
  alpha = eventData.alpha;
  beta = eventData.beta;
  gamma = eventData.gamma;
}