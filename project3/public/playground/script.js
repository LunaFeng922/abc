let socket;
if (
  location.hostname.toLowerCase().startsWith("browsercircus") ||
  location.hostname.toLowerCase().startsWith("www")
) {
  socket = io({ path: "/ruiqi/port-4260/socket.io" });
} else {
  socket = io();
}

let pets = [];
let pendingPets = [];
let p5Ready = false;

let bgImg;

let records = [];
let saved = localStorage.getItem("activity-records");
if (saved) {
  records = JSON.parse(saved);
  renderRecords();
}

function preload() {
  // bgImg = loadImage("assets/pixel-grass.jpg");
}

function setup() {
  let c = createCanvas(windowWidth, windowHeight - 70 - 40);
  c.parent("canvas-wrapper");
  p5Ready = true;

  pendingPets.forEach(addPet);
  pendingPets = [];

  socket.emit("get-bg");
}

function draw() {
  background(168, 230, 207);
  if (bgImg) image(bgImg, 0, 0, width, height);

  // draw the food dropped by user
  foods.forEach((food) => {
    let sx = map(food.x, 0, 800, 0, width);
    let sy = map(food.y, 0, 600, 0, height);
    textSize(28);
    textAlign(CENTER, CENTER);
    noStroke();
    text(food.emoji, sx, sy);
  });

  // poop

  poops.forEach((poop) => {
    let sx = map(poop.x, 0, 800, 0, width);
    let sy = map(poop.y, 0, 600, 0, height);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("💩", sx, sy);
  });

  // draw the pets
  pets.forEach((pet) => {
    pet.draw();
  });
}

function addPet(petData) {
  if (!p5Ready) {
    pendingPets.push(petData);
    return;
  }

  let existing = pets.find(
    (p) => p.userId == petData.userId && p.petName == petData.petName,
  );
  if (existing) return;

  // preloading all the sound file to preven laggy issue

  let pet = new Pet(petData);

  if (petData.sounds) {
    pet.audioCache = {};
    Object.entries(petData.sounds).forEach(([type, url]) => {
      let audio = new Audio("/" + url);
      audio.load();
      pet.audioCache[type] = audio;
    });
  }

  pets.push(pet);
}

socket.on("historic-records", (data) => {
  records = data;
  renderRecords();
});

socket.on("historic-pets", function (data) {
  data.forEach(addPet);
  // show the already recorded audio..
  let myUserId = localStorage.getItem("user-id");
  let myPet = data.find((p) => p.userId == myUserId);
  if (myPet && myPet.sounds) {
    Object.entries(myPet.sounds).forEach(([type, url]) => {
      let previewArea = document.getElementById("preview-" + type);
      if (previewArea) {
        previewArea.innerHTML = "";
        let player = document.createElement("audio");
        player.controls = true;
        player.src = "/" + url;
        previewArea.appendChild(player);
      }
    });
  }
});

socket.on("new-pet", function (data) {
  addPet(data);
});

socket.on("positions", (posData) => {
  posData.forEach((pos) => {
    let pet = pets.find(
      (p) => p.userId == pos.userId && p.petName == pos.petName,
    );
    if (pet) {
      let newTx = map(pos.x, 0, 800, 0, width);

      pet.serverVx = newTx - pet.tx;

      pet.tx = newTx;
      pet.ty = map(pos.y, 0, 600, 0, height);
      pet.meetingFacing = pos.meetingFacing || 0;
    }
  });
});

class Pet {
  constructor(data) {
    this.petName = data.petName;
    this.userId = data.userId;
    this.username = data.username;
    this.stats = data.stats;

    this.x = data.x || random(width);
    this.y = data.y || random(height);
    this.tx = this.x;
    this.ty = this.y;
    this.vx = 0;
    this.serverVx = 0;

    this.size = 80;
    this.frameDuration = 500;
    this.selected = false;
    this.eatEffect = 0;

    this.front1 = null;
    this.front2 = null;
    this.left1 = null;
    this.left2 = null;
    this.right1 = null;
    this.right2 = null;

    this.bubbles = [];

    loadImage("/" + data.front1, (img) => {
      this.front1 = img;
    });
    loadImage("/" + data.front2, (img) => {
      this.front2 = img;
    });
    loadImage("/" + data.left1, (img) => {
      this.left1 = img;
    });
    loadImage("/" + data.left2, (img) => {
      this.left2 = img;
    });
    loadImage("/" + data.right1, (img) => {
      this.right1 = img;
    });
    loadImage("/" + data.right2, (img) => {
      this.right2 = img;
    });
  }

  getCurrentImg() {
    let f = Math.floor(millis() / this.frameDuration) % 2;

    // 相遇时优先显示侧脸
    if (this.meetingFacing && this.meetingFacing !== 0) {
      if (this.meetingFacing > 0) return f === 0 ? this.left1 : this.left2;
      else return f === 0 ? this.right1 : this.right2;
    }

    let dir = this.serverVx || 0;
    if (dir < -1) return f == 0 ? this.right1 : this.right2;
    else if (dir > 1) return f == 0 ? this.left1 : this.left2;
    else return f == 0 ? this.front1 : this.front2;
  }

  isTouched(tx, ty) {
    let d = dist(tx, ty, this.x, this.y);
    return d < this.size / 2;
  }
  spawnBubble(emoji) {
    // 清空之前的，只保留最新一个
    this.bubbles = [
      {
        emoji: emoji,
        life: 90,
      },
    ];
  }

  drawBubbles() {
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
    this.bubbles.forEach((b) => {
      b.life--;
      let alpha = b.life > 20 ? 255 : map(b.life, 0, 20, 0, 255); // 最后20帧才淡出

      // 固定在宠物头顶
      let bx = this.x;
      let by = this.y - this.size / 2 - 20;

      // 画气泡背景
      noStroke();
      fill(255, 255, 255, alpha);
      let pw = 36,
        ph = 30;
      rect(bx - pw / 2, by - ph / 2, pw, ph, 8);

      // 气泡小尾巴
      triangle(bx - 6, by + ph / 2, bx + 6, by + ph / 2, bx, by + ph / 2 + 8);

      // emoji
      textSize(18);
      textAlign(CENTER, CENTER);
      fill(0, 0, 0, alpha);
      text(b.emoji, bx, by);
    });
  }

  draw() {
    let img = this.getCurrentImg();
    if (!img) return;

    let prevX = this.x;
    this.x = lerp(this.x, this.tx, 0.05);
    this.y = lerp(this.y, this.ty, 0.05);

    // add some shadow to make it visible even on a messy bg
    drawingContext.shadowOffsetX = 2;
    drawingContext.shadowOffsetY = 4;
    drawingContext.shadowBlur = 8;
    drawingContext.shadowColor = "rgba(0, 0, 0, 0.22)";

    imageMode(CENTER);
    image(img, this.x, this.y, this.size, this.size);
    imageMode(CORNER);

    drawingContext.shadowColor = "transparent";

    // also for name
    textAlign(CENTER);
    textSize(12);
    strokeWeight(2);
    stroke(255, 100);
    fill(50);
    text(this.petName, this.x, this.y + this.size / 2 + 16);
    noStroke();

    if (this.selected) this.drawInfo();

    if (this.eatEffect > 0) {
      this.eatEffect--;
      let alpha = map(this.eatEffect, 0, 60, 0, 255);
      let offset = map(this.eatEffect, 0, 60, 30, 0);
      textSize(20);
      fill(255, 200, 0, alpha);
      text("✨", this.x + 30, this.y - offset);
      text("😋", this.x - 30, this.y - offset - 10);
      noFill();
      strokeWeight(this.size / 10);
      stroke(255, 200, 0, alpha);
      circle(this.x, this.y, this.size * 0.4);
    }

    this.drawBubbles();
  }

  drawInfo() {
    let bw = 160;
    let bh = 112;
    let bx = this.x - bw / 2;
    let by = this.y - this.size / 2 - bh;

    bx = constrain(bx, 5, width - bw - 5);
    by = constrain(by, 5, height - bh - 5);

    fill(255, 255, 255, 220);
    stroke(200);
    strokeWeight(1);
    rect(bx, by, bw, bh, 10); // 圆角

    noStroke();
    fill(50);
    textAlign(LEFT);
    textSize(12);
    text("🐾 " + this.petName, bx + 10, by + 20);
    text("👤 " + this.username, bx + 10, by + 36);
    text("🎂 AGE: " + this.stats.age, bx + 10, by + 52);
    text("⚖️ WEIGHT: " + this.stats.weight, bx + 10, by + 68);
    let hungerHearts = heartsBar(this.stats.hunger, 5);
    let happyHearts = heartsBar(this.stats.happy, 5);

    fill(0);
    strokeWeight(10);
    text("🍖 " + hungerHearts, bx + 10, by + 84);
    text("😊 " + happyHearts, bx + 10, by + 100);
  }

  triggerEatEffect() {
    this.eatEffect = 120;
  }
}

function heartsBar(value, maxHearts) {
  let filled = Math.round((value / 100) * maxHearts);
  let empty = maxHearts - filled;
  return "♥︎".repeat(filled) + "♡".repeat(empty);
}

function touchStarted() {
  pets.forEach((pet) => {
    if (pet.isTouched(mouseX, mouseY)) {
      pet.selected = !pet.selected;
      if (pet.selected) {
        socket.emit("pet-clicked-by-user", {
          petUserId: pet.userId,
          petName: pet.petName,
        });
      }
    } else {
      pet.selected = false;
    }
  });

  if (currentTool) {
    let userName = localStorage.getItem("user-name");

    if (currentTool == "feed" && selectedFoodEmoji) {
      let sx = map(touches[0].x, 0, width, 0, 800);
      let sy = map(touches[0].y, 0, height, 0, 600);
      let foodData = {
        emoji: selectedFoodEmoji,
        x: sx,
        y: sy,
        username: userName,
      };
      socket.emit("food-data-from-client", foodData);

      currentTool = null;
      selectedFoodEmoji = null;
      document.getElementById("feed-btn").innerText = "🍖";
      document
        .querySelectorAll(".tool-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".food-option")
        .forEach((b) => b.classList.remove("selected")); // ← 加这行

      return false;
    } else if (currentTool == "poop") {
      poops.forEach((poop) => {
        let sx = map(poop.x, 0, 800, 0, width);
        let sy = map(poop.y, 0, 600, 0, height);
        if (dist(mouseX, mouseY, sx, sy) < 30) {
          socket.emit("remove-poop", poop.id);
        }
      });
    }
  }
}

// -- mode changing logic
let currentTool = null;
let selectedFoodEmoji = null;

// food
let foods = [];

// poop
let poops = [];

function selectTool(tool) {
  if (tool == "chat" || tool == "love") return; // for usertesting disable the btn first

  if (currentTool == tool) {
    currentTool = null;
    selectedFoodEmoji = null;
    document
      .querySelectorAll(".tool-btn")
      .forEach((b) => b.classList.remove("active"));
    document.getElementById("food-picker").style.display = "none";
    document.getElementById("board-panel").style.display = "none"; //
    document.getElementById("audio-panel").style.display = "none";
    document.getElementById("settings-panel").style.display = "none";

    return;
  }

  currentTool = tool;
  console.log(currentTool);
  document
    .querySelectorAll(".tool-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(tool + "-btn").classList.add("active");

  if (tool == "feed") {
    document.getElementById("food-picker").style.display = "flex";
  } else {
    document.getElementById("food-picker").style.display = "none";
    selectedFoodEmoji = null;
  }

  if (tool == "board") {
    document.getElementById("board-panel").style.display = "flex";
  } else {
    document.getElementById("board-panel").style.display = "none";
  }

  if (tool == "recorder") {
    document.getElementById("audio-panel").style.display = "flex";
    //Recorder(() => {});
  } else {
    document.getElementById("audio-panel").style.display = "none";
  }

  if (tool == "settings") {
    document.getElementById("settings-panel").style.display = "flex";
    //Recorder(() => {});
  } else {
    document.getElementById("settings-panel").style.display = "none";
  }

  if (tool == "game") {
    window.location.href = "/games";
    return;
  }
}

function selectFood(emoji) {
  selectedFoodEmoji = emoji;
  document
    .querySelectorAll(".food-option")
    .forEach((b) => b.classList.remove("selected"));
  event.target.classList.add("selected");

  document.getElementById("feed-btn").innerText = emoji;
  document.getElementById("food-picker").style.display = "none";
}

function addRecord(username, action) {
  records.unshift({ username, action, time: Date.now() });
  if (records.length > 100) records.pop();
  renderRecords();
}

function timeAgo(timestamp) {
  let diff = Math.floor((Date.now() - timestamp) / 1000); // 秒
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " hrs ago";
  let d = new Date(timestamp);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function renderRecords() {
  let list = document.getElementById("record-list");
  list.innerHTML = records
    .map(
      (r) => `
    <div class="record-item">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span><span class="record-who">${r.username}</span> <span class="record-what">${r.action}</span></span>
        <span class="record-when">${timeAgo(r.time)}</span>
      </div>
    </div>
  `,
    )
    .join("");
}

// handle the food related server communications
socket.on("food-data-from-server", (food) => {
  foods.push(food);
  addRecord(food.username, `fed ${food.emoji}`);
});

socket.on("historic-foods", (historicalFood) => {
  foods = historicalFood;
});

socket.on("food-eaten", (foodId) => {
  foods = foods.filter((f) => f.id !== foodId);
});

socket.on("pet-ate", (data) => {
  let pet = pets.find(
    (p) => p.userId == data.userId && p.petName == data.petName,
  );
  if (pet) pet.triggerEatEffect();

  if (data.eatSound) {
    new Audio("/" + data.eatSound).play().catch((e) => console.log(e));
  }
});

// poop functions
socket.on("new-poop", (poop) => {
  poops.push(poop);
  addRecord(poop.petName, "pooped 💩!");
  if (poop.poopSound) {
    new Audio("/" + poop.poopSound).play().catch((e) => console.log(e));
  }
});

socket.on("historic-poops", (data) => {
  poops = data;
});

socket.on("poop-removed", (id) => {
  poops = poops.filter((p) => p.id !== id);
});

socket.on("play-sound", (data) => {
  new Audio("/" + data.url).play().catch((e) => console.log(e));
});

socket.on("meeting-bubbles", (data) => {
  data.bubbles.forEach((b) => {
    setTimeout(() => {
      let pet = pets.find((p) => p.userId == b.userId);
      if (pet && pet.meetingFacing !== 0) {
        // ← 加这个检查
        pet.spawnBubble(b.emoji);
      }
    }, b.delay * 300);
  });
});

// update stats
socket.on("stats-update", (data) => {
  data.forEach((update) => {
    let pet = pets.find(
      (p) => p.userId == update.userId && p.petName == update.petName,
    );
    if (pet) {
      pet.stats = update.stats;
    }
  });
});

// -------- sound ----
socket.on("sound-updated", (data) => {
  let pet = pets.find((p) => p.userId == data.userId);
  if (pet) {
    if (!pet.audioCache) pet.audioCache = {};
    let audio = new Audio("/" + data.url);
    audio.load();
    pet.audioCache[data.soundType] = audio;
  }
});

// ------ for back ground  and other settings
// Settings
let currentBg = "assets/pixel-grass.jpg";

// 初始化 username 输入框
document.getElementById("settings-username").value =
  localStorage.getItem("user-name") || "";

// 保存 username
document.getElementById("settings-save-name").addEventListener("click", () => {
  let newName = document.getElementById("settings-username").value.trim();
  if (!newName) return;
  localStorage.setItem("user-name", newName);
  document.getElementById("settings-save-name").innerText = "Saved ✓";
  setTimeout(
    () => (document.getElementById("settings-save-name").innerText = "Save"),
    1500,
  );
});

document.querySelectorAll(".bg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentBg = btn.dataset.bg;
    document
      .querySelectorAll(".bg-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    socket.emit("bg-changed-from-client", { bg: currentBg });

    if (currentBg) {
      loadImage(currentBg, (img) => {
        bgImg = img;
      });
    } else {
      bgImg = null;
    }
  });
});

socket.on("bg-changed-from-server", (data) => {
  if (data.bg) {
    loadImage(data.bg, (img) => {
      bgImg = img;
    });
  } else {
    bgImg = null;
  }

  document.querySelectorAll(".bg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.bg === data.bg);
  });
});
