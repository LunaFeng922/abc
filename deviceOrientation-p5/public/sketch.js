let alpha = 0;
let beta =0;
let gamma = 0;
let organs = ["@", "^", "(", ")","$", "#", "&", "*", ">", "?", "=", "+", "-", "~", "'",".", ";", ":"];
let organ_1, organ_2;
let bgs = [[255, 255, 190],[0,0,0]];
let cr_bg=[255, 255, 190];

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  organ_1 = random(organs);
  organ_2 = random(organs);
  cr_bg = random(bgs);
}

function draw() {
background(cr_bg);
  
//text color
  noStroke();
if (
  cr_bg[0] === 255 && cr_bg[1] === 255 && cr_bg[2] === 190) 
  {
    fill(0); 
} else 
  {
  fill(255,255,190);
}

//orientation info
  push();
  textSize(10);
  text("alpha: " + round(alpha), 10, 30);
  text("beta: " + round(beta), 10, 40);
  text("gamma: " + round(gamma), 10, 50);
  pop();
  
//mouth or nose

//shifts
if (abs(beta) > 80||abs(gamma) > 40){ 
  organ_1 = random(organs);
  }

let tx = map(gamma, -90, 90, -width / 2, width / 2);
let ty = map(beta, -90, 90, -height / 4, height / 4);

push();
  translate(width / 2 + tx, height / 2 + ty);
  rotate(radians(alpha));
  //face which side
  if (organ_1=="'"||organ_1=="$"||organ_1=="("||organ_1==")"||organ_1=="#"||organ_1=="?"||organ_1==";"||organ_1==":"){
    rotate(-radians(90));
      if(tx>0){
      scale(1,-1);
      }
      else {
      scale(1,1);
      }
  }
  else {
    if(tx>0){
      scale(-1,1);
    }
    else {
     scale(1,1);
   }
  }
  //size
    let d = dist(width / 2 + tx, height / 2 + ty, width/2, height/2);
    let dMax = dist(0, 0, width/2, height/2);
    let sizeN = map(d, 0, dMax, 0.3, 1);
    textSize(width/2*sizeN);
    textAlign(CENTER, CENTER);
  text(organ_1,0,0);
pop();

//eyes

//shifts
if (abs(beta) > 40||abs(gamma) > 80){ 
  organ_2 = random(organs);
  cr_bg = random(bgs);
  }

let tx_2 = map(gamma, -90, 90, -width / 4, width / 4);
let ty_2 = map(beta, 90, -90, -height / 2, height / 2);

  push();
  translate(width / 4 + tx_2, height / 2 + ty_2);
  rotate(radians(gamma));
    if(tx_2<0)
    {scale(-1,1);}
  else {
    scale(1,1);
  }
      let ts_2=width/3+tx_2
      textSize(ts_2);
      textAlign(CENTER, CENTER);
  text(organ_2,0,0);
  pop();

  push();
  translate(width *3/4 + tx_2, height / 2 + ty_2);
  rotate(radians(gamma));
    if(tx_2<0)
    {scale(-1,1);}
  else {
    scale(1,1);
  }
      let ts_3=width/3-tx_2
      textSize(ts_3);
      textAlign(CENTER, CENTER);
  text(organ_2,0,0);
  pop();
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

function handleOrientation(eventData){
  document.querySelector('#requestOrientationButton').style.display = "none";

  console.log(eventData.alpha, eventData.beta, eventData.gamma);
  
  alpha = eventData.alpha;
  beta = eventData.beta;
  gamma = eventData.gamma;
    
}