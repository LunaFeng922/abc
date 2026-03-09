if(location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')){
  socket = io({path: "/luna/port-4240/socket.io"});
}else{
  socket = io(); 
}

let text = [];
let currentVer = [];
let selectedWords = {};
let otherInputs = {};
let myFont;
let myColor;

let touchTimer;
let touchingIndex;//for loop words
let editingIndex;//for inputting words

const sentence = document.getElementById("sentence");
const inputBox  = document.getElementById("edit-inputBox");
const input     = document.getElementById("edit-input");

const inputSizer = createSizer();

const flipSound = new Audio("assets/flip.wav");

function createPara() {
  const p = document.createElement("p");
  p.classList.add("para");
  const indent = document.createElement("span");
  indent.classList.add("indent");
  p.appendChild(indent);//indent inside the para
  sentence.appendChild(p);//para inside the sentence
  return p;
}

function createBadge(current, total) {
  const badge = document.createElement("span");
  badge.classList.add("version-index-badge");
  badge.textContent = `${current}/${total}`;
  return badge;
}

//create a span element for a word (later to be retrived in renderText function)
function createWordSpan({ index, word, isSelected }) {
  const el = document.createElement("span");
  el.dataset.index = index;//which word in the dataset
  el.innerText = word.text;//the text of the word

  setFontStyle(el, word.font);

  if (word.color) {
    el.style.color = word.color.font;
    el.style.backgroundColor = word.color.bg;
  }

  if (!word.editable)  el.classList.add("non-editable");
  if (isSelected)      el.classList.add("selected-word");

  return el;
}

//set the font style
function setFontStyle(el, font) {
  if (!font || font.family === "inherit") return;

  const style    = font.style || "";
  const isItalic = style.includes("italic");
  const isBold   = style.includes("bold");

  el.style.fontFamily = font.family;
  if (isItalic) {
  el.style.fontStyle = "italic"; } 
  else {
  el.style.fontStyle = "normal";}
  if (isBold) {
  el.style.fontWeight = "bold";} 
  else {
  el.style.fontWeight = "normal";}
}

//create a hidden sizer element to calculate the width of input text for auto-resizing the input box
function createSizer() {
  const el = document.createElement("span");
  el.className = "input-sizer";
  document.body.appendChild(el);
  return el;
}

//resize the input box width based on the input text width
function resizeInput() {
  setFontStyle(inputSizer, myFont);// match inputSizer's font to input box font, so the width measurement is accurate
  inputSizer.textContent = input.value || " ";
  inputBox.style.width = `${inputSizer.offsetWidth + 5}px`;
}

//update the position of input box to make it always below the word being edited
function updateInputPos() {
  if (editingIndex === null) return;
  const span = document.querySelector(`[data-index="${editingIndex}"]`);//find the span of the word being edited
  if (!span) return;
  const rect = span.getBoundingClientRect();
  inputBox.style.left = rect.left + rect.width / 2 + window.scrollX + "px";//css: transform: translateX(-50%);
  inputBox.style.top  = rect.bottom + window.scrollY + "px";
}

//handling datas of words (later to be retrived in renderText function)
function resolveWord(index, versions) {
  if (index === editingIndex) {
    const original = versions[currentVer[index]];
    return {
      text:     input.value || original.text,
      font:     myFont,
      editable: true,
      color:    myColor,
    };
  }

  if (otherInputs[index]) {
    const other = otherInputs[index];
    return {
      text:     other.text,
      font:     other.font,
      editable: true,
      color:    other.color,
    };
  }

  return versions[currentVer[index]];
}


// socket events
socket.on("connect", () => {
  editingIndex   = null;
  selectedWords  = {};
  otherInputs    = {};
  touchTimer     = null;
  touchingIndex  = null;
  inputBox.classList.add("hidden");
});

socket.on("current-text", (data) => {
  text       = data.text;
  currentVer = data.latestVer;
  myFont     = data.fontAsd || myFont;
  myColor    = data.myColor;

  setFontStyle(input, myFont);
  input.style.backgroundColor = myColor.font;
  input.style.color           = myColor.bg;
  input.style.caretColor      = myColor.bg;

  renderText();
});

socket.on("word-looped", (data) => {
  currentVer[data.index] = data.versionIdx;
  flipSound.currentTime = 0;
  flipSound.play();
  renderText();
});

socket.on("word-selected", (data) => {
  selectedWords[data.index] = "others";
  renderText();
});

socket.on("letter-input", (data) => {
  otherInputs[data.index] = {
    text:  data.currentInput,
    font:  data.font,
    color: data.color,
  };
  renderText();
});

socket.on("finish-input", (data) => {
  text[data.index]       = data.versions;
  currentVer[data.index] = data.versionIdx;

  delete otherInputs[data.index];

  if (editingIndex !== data.index) {
    delete selectedWords[data.index];
  }

  renderText();
});

socket.on("cancel-input", (data) => {
  delete selectedWords[data.index];
  delete otherInputs[data.index];

  if (editingIndex === data.index) {
    inputBox.classList.add("hidden");
    editingIndex = null;
  }

  renderText();
});


// render text
function renderText() {
  sentence.innerHTML = "";
  let currentPara = createPara();

  text.forEach((versions, index) => {
    const word = resolveWord(index, versions);

    if (word.text === "\n") {
      currentPara = createPara();
      return;
    }

    const span = createWordSpan({
      index,
      word,
      isSelected: !!selectedWords[index],
    });

    if (versions.length > 1 && index !== editingIndex) {
      span.appendChild(createBadge(currentVer[index] + 1, versions.length));
    }

    currentPara.appendChild(span);
  });

  if (editingIndex !== null) updateInputPos();
}

//touch events
sentence.addEventListener("touchstart", (e) => {
  const span = e.target;
  if (!span.dataset.index) return; // not a word, ignore

  touchingIndex = Number(span.dataset.index); // which word was touched
  const currentWord = text[touchingIndex][currentVer[touchingIndex]]; // get current version of the word
  if (!currentWord.editable) return; // word is not editable, ignore

  const indexSelected = touchingIndex; // lock the index in a local variable, because touchingIndex may change in 500ms

  // we don't know yet if this is a short tap or a long press, start the timer and wait
  touchTimer = setTimeout(() => {
    // 500ms passed, finger still down: confirmed long press → enter edit mode

    if (selectedWords[indexSelected]) return; // word already taken by someone else, ignore

    // if another word is being edited, cancel it first, only one word can be edited at a time
    if (editingIndex !== null && editingIndex !== indexSelected) {
      socket.emit("cancel-input", { index: editingIndex });
      delete selectedWords[editingIndex];
      renderText();
    }

    editingIndex = indexSelected; // mark this word as being edited
    selectedWords[indexSelected] = "mine"; // mark as selected by me, not others
    input.value = ""; // clear the input box

    // measure the original word width so the input box starts at the right size
    const originalWord = text[indexSelected][currentVer[indexSelected]];
    setFontStyle(inputSizer, myFont);
    inputSizer.textContent = originalWord.text;
    inputBox.style.width = `${inputSizer.offsetWidth + 5}px`;

    inputBox.classList.remove("hidden"); // show the input box
    updateInputPos(); // position it under the word
    input.focus(); // focus so the keyboard pops up

    // intent confirmed: long press → tell others this word is taken
    socket.emit("word-selected", { index: indexSelected });
    renderText();
    touchTimer = null; // timer has fired, clear the handle
  }, 500);
});

sentence.addEventListener("touchend", (e) => {
  if (touchTimer === null) return; // timer already fired (long press completed), ignore touchend
  flipSound.currentTime = 0; // reset so it can replay immediately on fast taps
  flipSound.play();
  // finger lifted before 500ms: confirmed short tap → cancel the long press timer
  clearTimeout(touchTimer);
  touchTimer = null;

  const span = e.target;
  if (!span.dataset.index) return; // not a word, ignore

  const index = Number(span.dataset.index);
  if (selectedWords[index]) return; // word is selected by someone, can't loop
  if (text[index].length <= 1) return; // only one version, nothing to loop

  // intent confirmed: short tap → loop to next version
  currentVer[index] = (currentVer[index] + 1) % text[index].length; // loop back to 0 after last version
  socket.emit("word-looped", { index, versionIdx: currentVer[index] }); // tell others which version this word is now on

  
  renderText();
});

sentence.addEventListener("touchcancel", () => {
  // touch interrupted by system (phone call, notification etc.) → clean up the timer
  if (touchTimer !== null) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
});

// input events
input.addEventListener("input", () => {
  if (editingIndex === null) return;

  resizeInput();
  updateInputPos();
  renderText();

  socket.emit("letter-input", {
    index:        editingIndex,
    currentInput: input.value,
    font:         myFont,
    color:        myColor,
  });
});

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || editingIndex === null) return;

  const idx    = editingIndex;
  editingIndex = null;
  inputBox.classList.add("hidden");

  if (input.value.trim() === "") {
    socket.emit("cancel-input", { index: idx });
  } else {
    socket.emit("finish-input", { index: idx, newText: input.value });
  }
});

// when input box loses focus, also finish or cancel the input (emm it actually doesn't work in all situations)
input.addEventListener("blur", () => {

  if (editingIndex === null) return;

  const idx    = editingIndex;
  editingIndex = null;
  inputBox.classList.add("hidden");

  if (input.value.trim() === "") {
    socket.emit("cancel-input", { index: idx });
  } else {
    socket.emit("finish-input", { index: idx, newText: input.value });
  }
});

window.addEventListener("resize", updateInputPos);
window.addEventListener("scroll", updateInputPos);