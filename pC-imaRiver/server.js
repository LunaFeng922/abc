const express = require('express');
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();
const portHTTPS = 4240;

app.use(express.static('public'));

const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app);

const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

let sockets = {};

const dataFile = path.join(__dirname, "public", "mapData.json");

let mapData;
try {
    let dataText = fs.readFileSync(dataFile, "utf8");
    mapData = JSON.parse(dataText);
    for (let s of mapData.slots) {
        if (!Array.isArray(s.memos)) s.memos = [];
    }
} catch (err) {
    console.error("Could not load", dataFile, "- run `node generateMap.js` first");
    process.exit(1);
}

function saveMap() {
    let dataAsText = JSON.stringify(mapData, null, 2);
    fs.writeFileSync(dataFile, dataAsText, 'utf8');
}

function getAllMemos() {
    let all = [];
    for (let s of mapData.slots) {
        for (let m of s.memos) {
            all.push({
                id: m.id,
                slot: s.index,
                authorId: m.authorId,
                authorName: m.authorName,
                text: m.text,
                branchPoints: m.branchPoints,
                createdAt: m.createdAt
            });
        }
    }
    return all;
}

// socket communication
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on("identify", function (data) {
        sockets[socket.id] = data;
        console.log("identified:", data);

        // send all existing users to the new user
        let allUsers = Object.values(sockets);
        socket.emit("all-users", allUsers);

        // send all existing memos to the new user
        socket.emit("all-memos", getAllMemos());

        // new user joined, notify others
        socket.broadcast.emit("user-joined", data);
    });

    socket.on("user-move", function (data) {
        let userData = sockets[socket.id];
        if (!userData) return;
        userData.pos = data.pos;
        io.emit("user-moved", {
            userId: userData.userId,
            pos: data.pos
        });
    });

    socket.on("new-memo", function (memo) {
        let userData = sockets[socket.id];
        if (!userData) {
            socket.emit("please-re-identify");
            return;
        }

        if (!memo || typeof memo.text !== "string" || !memo.text.trim()) return;

        let slotIdx = memo.slot - 1;
        if (typeof memo.slot !== "number" || slotIdx < 0 || slotIdx >= mapData.slots.length) return;

        let storedMemo = {
            id: memo.id,
            authorId: userData.userId,
            authorName: userData.username,
            text: memo.text.trim(),
            branchPoints: memo.branchPoints || [],
            createdAt: Date.now()
        };

        mapData.slots[slotIdx].memos.push(storedMemo);
        saveMap();

        io.emit("memo-added", {
            ...storedMemo,
            slot: memo.slot
        });
    });

    socket.on("disconnect", function () {
        console.log("someone disconnected", socket.id);
        let userData = sockets[socket.id];
        delete sockets[socket.id];
        if (userData) {
            io.emit("user-left", { userId: userData.userId });
        }
    });
});

HTTPSserver.listen(portHTTPS, function () {
    console.log("HTTPS Server started at port", portHTTPS);
});