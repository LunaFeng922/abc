const express = require("express");
const https = require("https");
const fs = require("fs");
const multer = require("multer");

const app = express();
const portHTTPS = 4260;

const options = {
  key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
  cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

let HTTPSserver = https.createServer(options, app);
const { Server } = require("socket.io");
const io = new Server(HTTPSserver);

let pets = [];
let dataText = fs.readFileSync("pets.json", "utf8");
pets = JSON.parse(dataText);

let foods = [];

// fine tuning parameters
let ageInterval = hourToMillis(24);
let hungryInterval = 10000;
let poopInterval = hourToMillis(0.05);

//poop
let poops = [];
let POOP_MIN_INTERVAL = 300;
let POOP_CHANCE = 0.5;

// settings

let settings = { bg: "assets/pixel-grass.jpg" };
try {
  let settingsText = fs.readFileSync("settings.json", "utf8");
  settings = JSON.parse(settingsText);
} catch (e) {
  // 文件不存在就用默认值
  fs.writeFileSync("settings.json", JSON.stringify(settings, null, 2), "utf8");
}

let currentBgPath = settings.bg;

// records

let activityRecords = [];

function addServerRecord(username, action) {
  activityRecords.unshift({ username, action, time: Date.now() });
  if (activityRecords.length > 100) activityRecords.pop();
}

function hourToMillis(hours) {
  let milliseconds = hours * 60 * 60 * 1000;
  return milliseconds;
}

// for development use, writing the missing parameters for existing pets
pets.forEach((pet) => {
  if (pet.x === undefined) pet.x = Math.random() * 800;
  if (pet.y === undefined) pet.y = Math.random() * 600;
  if (pet.vx === undefined) pet.vx = Math.random() * 10 + 1;
  if (pet.vy === undefined) pet.vy = Math.random() * 10 + 1;
  if (pet.lastPoopTime == undefined) pet.lastPoopTime = Date.now();
  if (pet.stats.weight == undefined) pet.stats.weight = 50;
  if (pet.wanderAngle === undefined)
    pet.wanderAngle = Math.random() * Math.PI * 2;
  if (pet.restTimer === undefined) pet.restTimer = 0; // 休息计时
});

fs.writeFileSync("pets.json", JSON.stringify(pets, null, 2), "utf8");

// ── multer ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + ".png");
  },
});
const upload = multer({ storage: storage });

app.use(express.static("public"));

// for the new pets
app.post("/upload-image", upload.single("image"), (req, res) => {
  let username = req.body.username || "Anonymous";
  let petName = req.body.petName || "Unknown";
  let userId = req.body.userId || "unknown";
  let frame = req.body.frame;

  let imageURL = "uploads/" + req.file.filename;

  if (frame === "front1") {
    pets.push({
      userId,
      username,
      petName,
      front1: imageURL,
      front2: null,
      left1: null,
      left2: null,
      right1: null,
      right2: null,
      stats: { hunger: 100, happy: 100, age: 0, weight: 50 },
      x: Math.random() * 800,
      y: Math.random() * 600,
      vx: 5,
      vy: 5,
      wanderAngle: Math.random() * Math.PI * 2,
      restTimer: 0,
      lastPoopTime: Date.now(),
    });
  } else {
    // 找到对应的宠物，填入剩余图片
    let pet = pets.find(
      (p) => p.userId === userId && p.petName === petName && p.front1 !== null,
    );
    if (pet) {
      pet[frame] = imageURL;

      // only broadcast if received 6 pics
      if (
        pet.front1 &&
        pet.front2 &&
        pet.left1 &&
        pet.left2 &&
        pet.right1 &&
        pet.right2
      ) {
        io.emit("new-pet", pet);
        addServerRecord(pet.petName + "joined!");
      }
    }
  }

  fs.writeFileSync("pets.json", JSON.stringify(pets, null, 2), "utf8");
  res.sendStatus(200);
});

// ── Socket ───────────────────────────────────────
io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  // broadcast the background image to new users
  socket.on("get-bg", () => {
    socket.emit("bg-changed-from-server", { bg: currentBgPath });
  });

  socket.emit("historic-records", activityRecords);

  let completePets = pets.filter(
    (p) => p.front1 && p.front2 && p.left1 && p.left2 && p.right1 && p.right2,
  );
  socket.emit("historic-pets", completePets);
  // send historical food to user
  socket.emit("historic-foods", foods);
  // send historical poop to user
  socket.emit("historic-poops", poops);

  // for settings
  socket.on("bg-changed-from-client", (data) => {
    currentBgPath = data.bg;
    settings.bg = data.bg;
    fs.writeFileSync(
      "settings.json",
      JSON.stringify(settings, null, 2),
      "utf8",
    );
    io.emit("bg-changed-from-server", data);
  });

  socket.on("identify", (info) => {
    console.log("user logged in:", info);
  });

  // for feeding
  socket.on("food-data-from-client", (foodData) => {
    let food = {
      username: foodData.username,
      id: Date.now(),
      emoji: foodData.emoji,
      x: foodData.x,
      y: foodData.y,
    };
    foods.push(food);
    io.emit("food-data-from-server", food);
    addServerRecord(food.username, `fed ${food.emoji}`);
  });

  socket.on("remove-poop", (id) => {
    poops = poops.filter((p) => p.id !== id);
    io.emit("poop-removed", id);
  });

  // for game playing
  // pull the pet data from server
  socket.on("get-my-pet", (data) => {
    let pet = pets.find(
      (p) =>
        p.userId === data.userId &&
        p.front1 &&
        p.front2 &&
        p.left1 &&
        p.left2 &&
        p.right1 &&
        p.right2,
    );
    socket.emit("my-pet-data", pet || null);
    console.log("sent");
  });

  // game score
  socket.on("reduced-weight-by-game", (data) => {
    let pet = pets.find((p) => p.userId === data.userId && p.front1);
    if (pet) {
      pet.stats.weight = Math.max(0, pet.stats.weight - data.amount);
      fs.writeFileSync("pets.json", JSON.stringify(pets, null, 2), "utf8");
      let completePets = pets.filter(
        (p) =>
          p.front1 && p.front2 && p.left1 && p.left2 && p.right1 && p.right2,
      );
      io.emit(
        "stats-update",
        completePets.map((p) => ({
          userId: p.userId,
          petName: p.petName,
          stats: p.stats,
        })),
      );
    }
  });

  socket.on("happy-score-by-game", (data) => {
    let pet = pets.find((p) => p.userId === data.userId && p.front1);
    if (pet) {
      pet.stats.happy = Math.min(100, pet.stats.happy + data.amount);
      fs.writeFileSync("pets.json", JSON.stringify(pets, null, 2), "utf8");
    }
  });

  socket.on("pet-clicked-by-user", (data) => {
    let pet = pets.find(
      (p) => p.userId === data.petUserId && p.petName === data.petName,
    );
    if (pet && pet.sounds && pet.sounds.greet) {
      socket.emit("play-sound", { url: pet.sounds.greet });
      console.log(pet, pet.sounds.greet);
    }
  });

  socket.on("disconnect", () => {
    console.log("someone disconnected", socket.id);
  });
});

let WORLD_W = 800;
let WORLD_H = 600;

// pet movement
setInterval(() => {
  let completePets = pets.filter(
    (p) => p.front1 && p.front2 && p.left1 && p.left2 && p.right1 && p.right2,
  );
  if (completePets.length === 0) return;

  completePets.forEach((pet) => {
    let weight = pet.stats.weight || 50;
    let speed = Math.max(0.3, 15 - Math.sqrt(weight));

    let nearest = null;
    let minDist = Infinity;
    foods.forEach((food) => {
      let d = Math.hypot(food.x - pet.x, food.y - pet.y);
      if (d < minDist) {
        minDist = d;
        nearest = food;
      }
    });

    if (nearest) {
      let angle = Math.atan2(nearest.y - pet.y, nearest.x - pet.x);
      pet.x += Math.cos(angle) * speed;
      pet.y += Math.sin(angle) * speed;

      if (minDist < 10) {
        pet.stats.hunger = Math.min(100, pet.stats.hunger + 20);
        if (pet.stats.weight < 100) {
          pet.stats.weight += 5;
        }

        foods = foods.filter((f) => f.id !== nearest.id);
        io.emit("food-eaten", nearest.id);
        io.emit("pet-ate", {
          userId: pet.userId,
          petName: pet.petName,
          eatSound: pet.sounds?.eat || null,
        });
      }
    } else {
      // 没有食物，随机游荡
      let weight = pet.stats.weight || 50;
      let speed = Math.max(0.3, 15 - Math.sqrt(weight));

      let closePet = null;
      for (let other of completePets) {
        if (other.userId === pet.userId) continue;
        let d = Math.hypot(other.x - pet.x, other.y - pet.y);
        if (d < 60) {
          closePet = other;
          break;
        }
      }

      if (
        closePet &&
        !pet.meetingTimer &&
        !closePet.meetingTimer &&
        Math.abs(pet.y - closePet.y) < 30 &&
        Math.random() < 0.015
      ) {
        pet.meetingTimer = 60;
        closePet.meetingTimer = 60;
        pet.meetingFacing = pet.x < closePet.x ? 1 : -1;
        closePet.meetingFacing = -pet.meetingFacing;

        // 生成气泡序列并广播
        let emojis = [
          "😊",
          "🥹",
          "👀",
          "💭",
          "❓",
          "🌸",
          "✨",
          "😶",
          "🤔",
          "😳",
          "🫢",
          "🫠",
          "💫",
          "‼️",
          "🙄",
        ];
        let bubbles = [];
        for (let i = 0; i < 6; i++) {
          bubbles.push({
            userId: i % 2 === 0 ? pet.userId : closePet.userId,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            delay: i * 18, // 每隔18帧（约5秒）冒一个
          });
        }
        io.emit("meeting-bubbles", {
          bubbles,
          pet1: pet.userId,
          pet2: closePet.userId,
        });

        let gap = 80;
        if (pet.x < closePet.x) {
          pet.x = closePet.x - gap;
        } else {
          pet.x = closePet.x + gap;
        }
      }

      if (pet.meetingTimer > 0) {
        pet.meetingTimer--;
        // 停着不动，vx 用来控制方向显示
        pet.vx = pet.meetingFacing || 1;
        // 不更新位置
      } else {
        pet.meetingTimer = 0;
        pet.meetingFacing = 0;

        // random restig
        if (pet.restTimer > 0) {
          pet.restTimer--;
        } else {
          if (Math.random() < 0.008) {
            pet.restTimer = Math.floor(Math.random() * 60) + 20; // 休息20-80帧
          } else {
            pet.wanderAngle += (Math.random() - 0.5) * 0.3;

            if (Math.random() < 0.01) {
              pet.wanderAngle += (Math.random() - 0.5) * Math.PI;
            }

            pet.x += Math.cos(pet.wanderAngle) * speed;
            pet.y += Math.sin(pet.wanderAngle) * speed;

            pet.vx = Math.cos(pet.wanderAngle) * speed;
            pet.vy = Math.sin(pet.wanderAngle) * speed;
          }
        }

        if (pet.x < 50) {
          pet.x = 50;
          pet.wanderAngle = Math.PI - pet.wanderAngle;
        }
        if (pet.x > WORLD_W - 50) {
          pet.x = WORLD_W - 50;
          pet.wanderAngle = Math.PI - pet.wanderAngle;
        }
        if (pet.y < 50) {
          pet.y = 50;
          pet.wanderAngle = -pet.wanderAngle;
        }
        if (pet.y > WORLD_H - 50) {
          pet.y = WORLD_H - 50;
          pet.wanderAngle = -pet.wanderAngle;
        }
      }
    }
  });

  io.emit(
    "positions",
    completePets.map((p) => ({
      userId: p.userId,
      petName: p.petName,
      x: p.x,
      y: p.y,
      meetingFacing: p.meetingFacing || 0,
    })),
  );
}, 300);

// update hunger and happy par
setInterval(() => {
  let completePets = pets.filter(
    (p) => p.front1 && p.front2 && p.left1 && p.left2 && p.right1 && p.right2,
  );
  if (completePets.length === 0) return;

  completePets.forEach((pet) => {
    pet.stats.hunger = Math.max(0, pet.stats.hunger - 1);
    pet.stats.happy = Math.max(0, pet.stats.happy - 1);
  });

  // broadcast stats to everyone
  io.emit(
    "stats-update",
    completePets.map((p) => ({
      userId: p.userId,
      petName: p.petName,
      stats: p.stats,
    })),
  );

  // save the stats
  fs.writeFileSync("pets.json", JSON.stringify(pets, null, 2), "utf8");
}, hungryInterval);

// update age
setInterval(() => {
  let completePets = pets.filter(
    (p) => p.front1 && p.front2 && p.left1 && p.left2 && p.right1 && p.right2,
  );
  if (completePets.length === 0) return;

  completePets.forEach((pet) => {
    pet.stats.age++;
  });

  // broadcast stats to everyone
  io.emit(
    "stats-update",
    completePets.map((p) => ({
      userId: p.userId,
      petName: p.petName,
      stats: p.stats,
    })),
  );
}, ageInterval);

// poop
setInterval(() => {
  let completePets = pets.filter(
    (p) => p.front1 && p.front2 && p.left1 && p.left2 && p.right1 && p.right2,
  );
  if (completePets.length == 0) return;

  completePets.forEach((pet) => {
    let now = Date.now();
    let timeSinceLastPoop = now - pet.lastPoopTime;

    // let minInterval = pet.petName === "八脚香" ? 5000 : POOP_MIN_INTERVAL;
    // let chance = pet.petName === "八脚香" ? 0.9 : POOP_CHANCE;

    if (timeSinceLastPoop > POOP_MIN_INTERVAL) {
      if (Math.random() < POOP_CHANCE) {
        let poop = {
          id: now + pet.userId,
          x: pet.x,
          y: pet.y,
          petName: pet.petName,
          username: pet.username,
        };
        poops.push(poop);
        pet.lastPoopTime = now;

        if (pet.stats.weight > 20) {
          pet.stats.weight -= 5;
          io.emit(
            "stats-update",
            completePets.map((p) => ({
              userId: p.userId,
              petName: p.petName,
              stats: p.stats,
            })),
          );
        }
        io.emit("new-poop", {
          id: now + pet.userId,
          x: pet.x,
          y: pet.y,
          petName: pet.petName,
          username: pet.username,
          poopSound: pet.sounds?.poop || null,
        });
        addServerRecord(poop.petName, "pooped 💩!");

        console.log(pet.petName + " 拉屎了！");
      }
    }
  });
}, poopInterval);

// -------------- AUDIO PART --------------------------------//
const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads-audio");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + ".mp3");
  },
});
const uploadAudio = multer({ storage: audioStorage });

app.post("/upload-sound", uploadAudio.single("sound"), (req, res) => {
  let userId = req.body.userId;
  let soundType = req.body.soundType; // "eat", "poop" etc
  let audioURL = "uploads-audio/" + req.file.filename;

  let pet = pets.find((p) => p.userId === userId && p.front1 !== null);
  if (pet) {
    if (!pet.sounds) pet.sounds = {};
    pet.sounds[soundType] = audioURL;
    fs.writeFileSync("pets.json", JSON.stringify(pets, null, 2), "utf8");
  }

  io.emit("sound-updated", {
    userId: userId,
    soundType: soundType,
    url: audioURL,
  });

  res.sendStatus(200);
});

HTTPSserver.listen(portHTTPS, function () {
  console.log("HTTPS Server started at port", portHTTPS);
});
