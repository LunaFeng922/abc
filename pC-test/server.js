const express = require('express');
const https = require("https");
const fs = require("fs");

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

// every memo: { id, slot, authorId, authorName, text, x, y }
let memos = [];
const DATA_FILE = "userData.json";

try {
    let dataText = fs.readFileSync(DATA_FILE, "utf8");
    let parsed = JSON.parse(dataText);
    if (Array.isArray(parsed)) {
        memos = parsed;
    } else if (parsed && Array.isArray(parsed.memos)) {
        memos = parsed.memos;
    }
} catch (err) {
    memos = [];
}

function saveMemos() {
    let dataAsText = JSON.stringify({ memos: memos }, null, 2);
    fs.writeFileSync(DATA_FILE, dataAsText, 'utf8');
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
        socket.emit("all-memos", memos);

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
        if (typeof memo.slot !== "number" || memo.slot < 1 || memo.slot > 1000) return;

        let cleanMemo = {
            id: memo.id,
            slot: memo.slot,
            authorId: userData.userId,
            authorName: userData.username,
            text: memo.text.trim(),
            x: (typeof memo.x === "number") ? memo.x : 0.5,
            y: (typeof memo.y === "number") ? memo.y : 0.5,
            createdAt: Date.now()
        };

        memos.push(cleanMemo);
        saveMemos();

        io.emit("memo-added", cleanMemo);
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