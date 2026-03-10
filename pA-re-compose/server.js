let express = require("express");
let https   = require("https");
let fs      = require("fs");
let { Server } = require("socket.io");

let app  = express();
let port = 4240;

app.use(express.static("public"));

let options = {
  key:  fs.readFileSync("keys-for-local-https/localhost-key.pem"),
  cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

let httpsServer = https.createServer(options, app);
let io = new Server(httpsServer);

let originalText = `
I can't bear to think of it.
I have only just realized that I have been living all these years in a place where for four thousand years they have been eating human flesh.
My brother had just taken over the charge of the house when our sister died, and he may well have used her flesh in our rice and dishes, making us eat it unwittingly.
It is possible that I ate several pieces of my sister's flesh unwittingly, and now it is my turn...
How can a man like myself, after four thousand years of man-caring history, even though I knew nothing about it at first—ever hope to face real men?
Perhaps there are still children who have not eaten men? Save the children.
`;

let text = dataFromText(originalText);
let latestVer = text.map(() => 0);
let selectedWords = {};

//fonts for texts
const fonts = [
  { family: "Georgia, serif",                              style: "italic" },
  { family: "Palatino, 'Palatino Linotype', serif",        style: "italic" },
  { family: "Didot, 'Bodoni MT', serif",                   style: "italic" },
  { family: "Baskerville, 'Baskerville Old Face', serif",  style: "bold italic" },
  { family: "'Trebuchet MS', sans-serif",                  style: "normal" },
  { family: "'Courier New', monospace",                    style: "bold" },
  { family: "'American Typewriter', 'Courier New', monospace", style: "normal" },
];

let fontIdx = 0;
let clientFonts = {};

//color pairs for texts
const colorPairs = [
  { font: "#67a300", bg: "#ffd3ef" },
  { font: "#ffff00", bg: "#4B0082" },
  { font: "#ccff00", bg: "#003403" },
  { font: "#6b400f", bg: "#6dad67" },
  { font: "#fffb00", bg: "#002668" },
  { font: "#2b00ff", bg: "#26e6ff" },
  { font: "#46004b", bg: "#92ffb8" },
  { font: "#bbf7fe", bg: "#431a00" },
  { font: "#ff561d", bg: "#d3fb8e" },
  { font: "#c1e08f", bg: "#250012" }
];
let colorPairIdx = 0;
let clientColors = {};


io.on("connection", (socket) => {

  let fontAsd = fonts[fontIdx % fonts.length];
  fontIdx++;
  clientFonts[socket.id] = fontAsd;

  let pair = colorPairs[colorPairIdx % colorPairs.length];
  colorPairIdx++;
  clientColors[socket.id] = pair;

  socket.emit("current-text", {
    text,
    latestVer,
    fontAsd,
    myColor: pair
  });

  socket.on("word-looped", (data) => {
    let index = Number(data.index); //A,B,C
    let versionIdx = Number(data.versionIdx); //A0,A1,A2
    //can't loop if no index or version or selected
    if (!text[index]) return;
    if (selectedWords[index]) return;
    //update timestamp to make it latest
    text[index][versionIdx].timestamp = Date.now();
    latestVer[index] = versionIdx;
    socket.broadcast.emit("word-looped", { index, versionIdx });
  });

  socket.on("word-selected", (data) => {
    let index = Number(data.index);
    if (selectedWords[index]) return;
    selectedWords[index] = socket.id;
    socket.broadcast.emit("word-selected", { index });
  });

  socket.on("letter-input", (data) => {
    let index = Number(data.index);
    if (selectedWords[index] === socket.id) {
      socket.broadcast.emit("letter-input", data);
    }
  });

  socket.on("finish-input", (data) => {
    let index = Number(data.index);
    let newText = (data.newText || "").trim();//trim to delete extra spaces at the beginning and end and prevent empty inputs
    if (!text[index]) return;
    if (selectedWords[index] !== socket.id) return;

    let font = clientFonts[socket.id] || { family: "inherit", style: "normal" };
    let pair = clientColors[socket.id];

    text[index].push({
      text:      newText,
      timestamp: Date.now(),
      font:      font,
      editable:  true,
      color:     pair
    });

    latestVer[index] = text[index].length - 1;//the latest version is the one just added
    delete selectedWords[index];//deselect the word after finishing input

    io.emit("finish-input", {
      index,
      versions:   text[index],
      versionIdx: latestVer[index]
    });
  });

  socket.on("cancel-input", (data) => {
    let index = Number(data.index);
    if (selectedWords[index] === socket.id) {
      delete selectedWords[index];
      io.emit("cancel-input", { index });
    }
  });

  socket.on("disconnect", () => {
    for (const index in selectedWords) {
      if (selectedWords[index] === socket.id) {
        delete selectedWords[index];
        io.emit("cancel-input", { index: Number(index) });
      }
    }
    delete clientFonts[socket.id];
    delete clientColors[socket.id];
  });

});


httpsServer.listen(port, function(req, res) {
  console.log("HTTPS Server started at port", port);
});


function dataFromText(str) {
  const pattern = /\w+('\w+)?|\n|[^\w\s]/g;
  const resultArray = str.match(pattern) || [];
  return resultArray.map(word => {
    return [{
      text: word,
      timestamp: Date.now(),
      font: { family: "inherit", style: "normal" },
      editable: /\w/.test(word)
    }];
  });
}