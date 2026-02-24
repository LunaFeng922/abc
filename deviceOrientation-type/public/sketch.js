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
let cr_bg = [255, 255, 255];
let lastFont = 0;
let lastStyle = 0;
let lastSize = 0;
let inputElement;

let colors = [
  [101, 67, 33],
  [0, 0, 0],
  [25, 50, 90],
  [40, 80, 50],
  [139, 60, 40]
];
let currentColorIdx = 0;

function setup() {
  background(cr_bg);
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  inputElement = createInput("");
  inputElement.input(updateText);
  inputElement.attribute("maxlength", "100");

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
  textSize(12);
  textStyle(NORMAL);
  textFont("Arial");
  text("α: " + round(alpha), 10, 30);
  text("β: " + round(beta), 10, 45);
  text("γ: " + round(gamma), 10, 60);
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

  if (betaMapped >60) {
    userText = "";
    inputElement.value("");
  }

  if (gamma > 40 && millis() - lastFont > 100) {
    currentFontIdx = int(random(fonts.length));
    currentColorIdx = int(random(colors.length));
    lastFont = millis();
  }

  if (betaMapped <- 20 && millis() - lastSize > 100) {
    currentSizeIdx = (currentSizeIdx + 1) % fontSizes.length;
    lastSize = millis();
  }

  if (gamma < -40 && millis() - lastStyle > 100) {
    currentStyleIdx = int(random(styles.length));
    lastStyle = millis();
  }

  // text-typed
  push();
  textAlign(CENTER, TOP);
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

  fill(colors[currentColorIdx][0], colors[currentColorIdx][1], colors[currentColorIdx][2]);

  translate(width / 2, height / 2);
  translate(gamma / 50 * width / 2, betaMapped * 8);

  let lineHeight = textAscent() + textDescent() + 5;
  let colWidth = fontSizes[currentSizeIdx] + 8;

  let maxRows = floor((height * 0.6) / lineHeight);
  let totalCols = ceil(userText.length / maxRows);
  let totalWidth = totalCols * colWidth;
  let startX = totalWidth / 2 - colWidth / 2;
  let startY = -(min(userText.length, maxRows) * lineHeight) / 2;
  
// for (let i = 0; i < userText.length; i++) {
//   let col = floor(i / maxRows);
//   let row = i % maxRows;
//   let x = startX - col * colWidth;

//   let charsInThisCol = min(userText.length - col * maxRows, maxRows);
//   let y = startY + (charsInThisCol - 1 - row) * lineHeight;

//   push();
//   translate(x, y + lineHeight / 2);
//   rotate(radians(gamma));
//   text(userText[i], 0, -lineHeight / 2);
//   pop();
// }

  for (let i = 0; i < userText.length; i++) {
    let col = floor(i / maxRows);
    let row = i % maxRows;
    let x = startX - col * colWidth;
    let y = startY + row * lineHeight;

    push();
    translate(x, y + lineHeight / 2);
    rotate(radians(gamma));
    text(userText[i], 0, -lineHeight / 2);
    pop();
  }


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