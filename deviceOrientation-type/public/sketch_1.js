let alpha = 0;
let beta = 0;
let gamma = 0;
let userText = "";
let fonts = [
  "Arial",
  "Georgia",
  "Courier New",
  "Verdana",
  "Times New Roman",
  "Comic Sans MS",
  "PingFang SC, Heiti SC, sans-serif",
  "Hiragino Sans GB, PingFang SC, sans-serif"
];
let currentFontIdx = 0;
let styles = ["normal", "bold", "italic", "bold italic"];
let currentStyleIdx = 0;
let fontSizes = [20, 25, 30, 35];
let currentSizeIdx = 0;
let cr_bg = [255, 255, 190];
let lastFont = 0;
let lastStyle = 0;
let lastSize = 0;
let inputElement;

function setup() {
  background(cr_bg);
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  // create input box
  inputElement = createInput("");
  inputElement.input(updateText);
  inputElement.attribute("maxlength", "100");

  // clear text when pressing Enter or when input loses focus
  inputElement.elt.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      userText = inputElement.value();
      inputElement.value("");
    }
  });
  inputElement.elt.addEventListener("change", function(e) {
    userText = inputElement.value();
    inputElement.value("");
  });
}

function draw() {
  background(cr_bg);
  noStroke();
  fill(0);

  push();
  textSize(10);
  textStyle(NORMAL);
  textFont("Arial");
  text("alpha: " + round(alpha), 10, 30);
  text("beta: " + round(beta), 10, 40);
  text("gamma: " + round(gamma), 10, 50);
  pop();

  // map beta to -90 to 90
  let betaMapped;
  if (beta >= -90 && beta <= 90) {
    betaMapped = beta;
  } else if (beta > 90) {
    betaMapped = 180 - beta;
  } else {
    betaMapped = -180 - beta;
  }

  if (Math.abs(gamma) > 50) {
    userText = "";
    inputElement.value("");
  }

  if (betaMapped > 40 && millis() - lastFont > 100 && millis() - lastSize > 100) {
    currentFontIdx = int(random(fonts.length));
    lastFont = millis();
    currentSizeIdx = (currentSizeIdx + 1) % fontSizes.length;
    lastSize = millis();
  }

  if (betaMapped < -40 && millis() - lastStyle > 100) {
    currentStyleIdx = int(random(styles.length));
    lastStyle = millis();
  }

  // text-typed
  push();
  textAlign(CENTER, CENTER);
  textFont(fonts[currentFontIdx]);
  if (currentStyleIdx === 0) {
    textStyle(NORMAL);
  } else if (currentStyleIdx === 1) {
    textStyle(BOLD);
  } else if (currentStyleIdx === 2) {
    textStyle(ITALIC);
  } else if (currentStyleIdx === 3) {
    textStyle(BOLDITALIC);
  }
  textSize(fontSizes[currentSizeIdx]);
  textWrap(CHAR);
  translate(width / 2, height / 2);
  translate(gamma / 50 * width / 2, betaMapped * 4);
  rotate(radians(gamma));
  let maxW = width * 0.7;
  text(userText, -maxW / 2, -height / 4, maxW, height / 2);
  pop();
}

function updateText() {
  userText = inputElement.value();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function handleOrientation(eventData) {
  document.querySelector('#requestOrientationButton').style.display = "none";
  alpha = eventData.alpha;
  beta = eventData.beta;
  gamma = eventData.gamma;
}