const express = require("express");
const https = require("https");
const fs = require("fs");

const app = express();
app.use(express.static("public"));

const options = {
  key: fs.readFileSync("localhost-key.pem"),
  cert: fs.readFileSync("localhost.pem"),
};
const HTTPSserver = https.createServer(options, app);
const { Server } = require("socket.io");
const io = new Server(HTTPSserver);

const PORT = 4240;
const COLOR = "#000000";

//head area for hair growing
const headCx = 0.2;
const headCy = -0.38;
const ellipseRx = 0.17;
const ellipseRy = 0.11;
const tilt = 0.5;
const size = 300;
const imgBuf = fs.readFileSync("public/assets/JingWu01.png");
const imgAsp = imgBuf.readUInt32BE(20) / imgBuf.readUInt32BE(16);

function randomHeadOffset() {
  let angle = Math.random() * Math.PI * 2;
  let r = Math.sqrt(Math.random());
  let ex = ellipseRx * r * Math.cos(angle);
  let ey = ellipseRy * r * Math.sin(angle);

  let pxX = ex * size;
  let pxY = ey * size * imgAsp;
  let rx = pxX * Math.cos(tilt) - pxY * Math.sin(tilt);
  let ry = pxX * Math.sin(tilt) + pxY * Math.cos(tilt);
  return {
    headOffsetX: headCx * size + rx,
    headOffsetY: headCy * size * imgAsp + ry,
  };
}

let players = {};
let persistedTraces = {};
let globalOriginLat = null;
let globalOriginLon = null;

// socket events
io.on("connection", (socket) => {
  console.log("connected", socket.id);

  let offset = randomHeadOffset();
  let traceID = socket.id;

  persistedTraces[traceID] = {
    headOffsetX: offset.headOffsetX,
    headOffsetY: offset.headOffsetY,
    color: COLOR,
    originLat: null,
    originLon: null,
    points: [],
  };

  players[socket.id] = {
    traceID,
    headOffsetX: offset.headOffsetX,
    headOffsetY: offset.headOffsetY,
    color: COLOR,
    currentLat: 0,
    currentLon: 0,
  };

  socket.emit("welcome", {
    socketID: socket.id,
    traceID,
    headOffsetX: offset.headOffsetX,
    headOffsetY: offset.headOffsetY,
    color: COLOR,
  });

  // Send full trace history + current online players to the newcomer
  socket.emit("initData", {
    traces: persistedTraces,
    myTraceID: traceID,
    globalOriginLat,
    globalOriginLon,
    onlinePlayers: Object.fromEntries(
      Object.entries(players).map(([sid, p]) => [
        sid,
        {
          traceID: p.traceID,
          headOffsetX: p.headOffsetX,
          headOffsetY: p.headOffsetY,
          color: p.color,
          currentLat: p.currentLat,
          currentLon: p.currentLon,
        },
      ]),
    ),
  });

  // Notify existing clients of the new player
  socket.broadcast.emit("playerJoined", {
    socketID: socket.id,
    traceID,
    headOffsetX: offset.headOffsetX,
    headOffsetY: offset.headOffsetY,
    color: COLOR,
  });

  // First GPS fix — register the trace origin
  socket.on("registerOrigin", function (data) {
    persistedTraces[traceID].originLat = data.originLat;
    persistedTraces[traceID].originLon = data.originLon;
    players[socket.id].originLat = data.originLat;
    players[socket.id].originLon = data.originLon;

    // First user to register sets the global head position for everyone
    if (globalOriginLat === null) {
      globalOriginLat = data.originLat;
      globalOriginLon = data.originLon;
      io.emit("globalOrigin", { lat: globalOriginLat, lon: globalOriginLon });
    }

    socket.broadcast.emit("traceOrigin", {
      traceID,
      originLat: data.originLat,
      originLon: data.originLon,
    });
  });

  // Continuous location updates
  socket.on("locationFromClient", function (data) {
    let p = players[socket.id];
    if (!p) return;
    p.currentLat = data.lat;
    p.currentLon = data.lon;

    persistedTraces[traceID].points.push({ lat: data.lat, lon: data.lon });

    socket.broadcast.emit("locationFromServer", {
      socketID: socket.id,
      traceID,
      lat: data.lat,
      lon: data.lon,
    });
  });

  // Remove live session; keep trace history
  socket.on("disconnect", function () {
    console.log("disconnected", socket.id);
    socket.broadcast.emit("deletePerson", { socketID: socket.id });
    delete players[socket.id];
  });
});

HTTPSserver.listen(PORT, function () {
  console.log("HTTPS server listening on port", PORT);
});
