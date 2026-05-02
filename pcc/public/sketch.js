let canvas;
let visualBranches = [];
let angle = 0;

// user info
let usernameKEY = "user-name";
let userPosKEY = "user-pos";

let username = localStorage.getItem(usernameKEY);
let myPos = parseInt(localStorage.getItem(userPosKEY));

function getOrCreateUserId() {
    let userID = localStorage.getItem("user-id");
    if (userID == undefined) {
        userID = crypto.randomUUID();
        localStorage.setItem("user-id", userID);
    }
    return userID;
}
let myUserId = getOrCreateUserId();

// socket.io communication
let socket;
if (location.hostname.toLowerCase().startsWith('browsercircus') ||
    location.hostname.toLowerCase().startsWith('www')) {
    socket = io({ path: "/luna/port-4240/socket.io" });
} else {
    socket = io();
}

let myInfo = {
    userId: myUserId,
    username: username,
    pos: myPos
};

socket.on("connect", function () {
    socket.emit("identify", myInfo);
});

socket.on("please-re-identify", function () {
    socket.emit("identify", myInfo);
});

// users & their positions
let users = {};
users[myUserId] = myInfo;

socket.on("all-users", function (allUsers) {
    for (let p of allUsers) {
        if (p.userId === myUserId) continue;
        users[p.userId] = p;
    }
});

socket.on("user-joined", function (p) {
    if (p.userId === myUserId) return;
    users[p.userId] = p;
});

socket.on("user-left", function (data) {
    delete users[data.userId];
});

socket.on("user-moved", function (data) {
    if (data.userId === myUserId) return;
    if (users[data.userId]) {
        users[data.userId].pos = data.pos;
    }
});

// memos
let memos = [];

function generateMemoId() {
    return "memo-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}

socket.on("all-memos", function (allMemos) {
    memos = allMemos; 
    rebuildBranches(); 
});

socket.on("memo-added", function (memo) {
    let existingIndex = memos.findIndex(n => n.id === memo.id);
    if (existingIndex >= 0) memos[existingIndex] = memo;
    else memos.push(memo);
    createBranchFromData(memo, false);
});

function rebuildBranches() {
    visualBranches = [];
    for (let m of memos) {
        createBranchFromData(m, true);
    }
}

function createBranchFromData(memo, isInstant) {
    if (!memo.branchPoints || !slotPoses[memo.slot - 1]) return;

    let slotCenter = {
        x: slotPoses[memo.slot - 1].x * width,
        y: slotPoses[memo.slot - 1].y * height
    };

    let absPoints = memo.branchPoints.map(p => ({
        x: slotCenter.x + p.rx * width,
        y: slotCenter.y + p.ry * height
    }));

    // 将 memo 对象传入 BranchDroplet 实例
    let b = new BranchDroplet(absPoints[0].x, absPoints[0].y, 0, absPoints, memo);
    
    if (isInstant) {
        b.points = absPoints;
        b.isFinished = true;
    }
    
    visualBranches.push(b);
}

// compose view
let composeOverlay = document.querySelector("#composeOverlay");
let composeText = document.querySelector("#composeText");
let cancelBtn = document.querySelector("#cancelBtn");
let addBtn = document.querySelector("#addBtn");

function openCompose() {
    composeText.value = "";
    composeOverlay.classList.remove("hidden");
}

function closeCompose() {
    composeOverlay.classList.add("hidden");
    composeText.blur();
}

composeOverlay.addEventListener("touchstart", function (e) { e.stopPropagation(); });
composeOverlay.addEventListener("touchend", function (e) { e.stopPropagation(); });

composeText.addEventListener("touchend", function (e) {
    e.stopPropagation();
    composeText.focus();
});
composeText.addEventListener("click", function (e) {
    e.stopPropagation();
    composeText.focus();
});

cancelBtn.addEventListener("touchend", function (e) { e.stopPropagation(); });
addBtn.addEventListener("touchend", function (e) { e.stopPropagation(); });

cancelBtn.addEventListener("click", closeCompose);

addBtn.addEventListener("click", function () {
    let text = composeText.value.trim();
    if (!text) {
        closeCompose();
        return;
    }

    let slotIdx = myPos - 1;
    if (!slotPoses[slotIdx]) { closeCompose(); return; }

    let startX = slotPoses[slotIdx].x * width;
    let startY = slotPoses[slotIdx].y * height;

    let tempB = new BranchDroplet(startX, startY, angle);
    while (!tempB.isFinished) {
        tempB.update();
    }

    let relativePoints = tempB.points.map(p => ({
        rx: (p.x - startX) / width,
        ry: (p.y - startY) / height
    }));

    let memo = {
        id: generateMemoId(),
        slot: myPos,
        authorId: myUserId,
        authorName: username,
        text: text,
        branchPoints: relativePoints 
    };

    socket.emit("new-memo", memo);
    closeCompose();
});

// read view
let readOverlay = document.querySelector("#readOverlay");
let readAuthor = document.querySelector("#readAuthor");
let readText = document.querySelector("#readText");

function openRead(memo) {
    readAuthor.innerText = "— " + memo.authorName;
    readText.innerText = memo.text;
    readOverlay.classList.remove("hidden");
}

function closeRead() {
    readOverlay.classList.add("hidden");
}

readOverlay.addEventListener("touchstart", function (e) { e.stopPropagation(); });
readOverlay.addEventListener("touchend", function (e) {
    e.stopPropagation();
    e.preventDefault();
    closeRead();
});
readOverlay.addEventListener("click", function (e) {
    e.stopPropagation();
    closeRead();
});

// touch events
let touchStartY = 0;
let swipeAnchorY = 0;
let swipeUnit = 24;

function touchStarted() {
    if (!composeOverlay.classList.contains("hidden")) return;
    if (!readOverlay.classList.contains("hidden")) return;

    let ty;
    if (touches.length > 0) ty = touches[0].y;
    else ty = mouseY;

    touchStartY = ty;
    swipeAnchorY = ty;

    return false;
}

function touchMoved() {
    if (!composeOverlay.classList.contains("hidden")) return;
    if (!readOverlay.classList.contains("hidden")) return;

    let ty;
    if (touches.length > 0) ty = touches[0].y;
    else ty = mouseY;

    let dy = ty - swipeAnchorY;

    if (Math.abs(dy) >= swipeUnit) {
        let steps;
        if (dy < 0) steps = Math.floor(-dy / swipeUnit);
        else steps = -Math.floor(dy / swipeUnit);
        if (steps !== 0) {
            changeMyPos(myPos + steps);
            swipeAnchorY = ty;
        }
    }

    return false;
}

function touchEnded() {
    if (!composeOverlay.classList.contains("hidden")) return;
    if (!readOverlay.classList.contains("hidden")) return;

    let myPosX = displayX[myUserId];
    let myPosY = displayY[myUserId];

    let offsetX, offsetY;
    if (myPosX !== undefined) offsetX = width / 2 - myPosX;
    else offsetX = 0;
    if (myPosY !== undefined) offsetY = height / 2 - myPosY;
    else offsetY = 0;

    let endX = mouseX - offsetX;
    let endY = mouseY - offsetY;

    let dy = endY - (touchStartY - offsetY);
    let totalMove = Math.abs(dy);

    if (totalMove < 15) {
        // --- 修改：点击检测逻辑 ---
        // 遍历当前 slot 的 visualBranches，检测是否点中了最末端的点
for (let b of visualBranches) {
            if (b.memoData && b.memoData.slot === myPos) { // 核心过滤
                let lastP = b.points[b.points.length - 1];
                if (dist(endX, endY, lastP.x, lastP.y) < 30) {
                    openRead(b.memoData);
                    return false;
                }
            }
        }

        if (myPosX !== undefined && myPosY !== undefined) {
            if (dist(endX, endY, myPosX, myPosY) < 60) {
                openCompose();
            }
        }
    }

    return false;
}

function changeMyPos(newPos) {
    newPos = constrain(newPos, 1, totalSlots);
    if (newPos === myPos) return;

    myPos = newPos;
    myInfo.pos = newPos;
    users[myUserId].pos = myPos;
    localStorage.setItem(userPosKEY, myPos);
    socket.emit("user-move", { pos: myPos });
}

// p5
function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("p5-canvas-container");
    textFont("sans-serif");
}

let displayX = {};
let displayY = {};

function draw() {
    background(255);
    
    let slotPos = slotPoses.map(p => ({
        x: p.x * width,
        y: p.y * height
    }));

    let myTargetX, myTargetY;
    if (slotPoses[myPos - 1]) {
        if (displayX[myUserId] !== undefined) {
            myTargetX = displayX[myUserId];
            myTargetY = displayY[myUserId];
        } else {
            myTargetX = slotPos[myPos - 1].x;
            myTargetY = slotPos[myPos - 1].y;
        }
    } else {
        myTargetX = width/2; myTargetY = height/2;
    }

    let offsetX = width / 2 - myTargetX;
    let offsetY = height / 2 - myTargetY;

    push();
    translate(offsetX, offsetY);

for (let b of visualBranches) {
        if (b.memoData && b.memoData.slot === myPos) {
            b.update();
            b.display();
        }
    }

    // find visible slot range
    let viewTop = -offsetY;
    let viewBottom = -offsetY + height;
    let firstVisible = 0;
    let lastVisible = slotPos.length - 1;
    for (let i = 0; i < slotPos.length; i++) {
        if (slotPos[i].y >= viewTop - height * 0.5) {
            firstVisible = Math.max(0, i - 2);
            break;
        }
    }
    for (let i = slotPos.length - 1; i >= 0; i--) {
        if (slotPos[i].y <= viewBottom + height * 0.5) {
            lastVisible = Math.min(slotPos.length - 1, i + 2);
            break;
        }
    }

    // lines between visible slots, highlighted if in my current stage
    let stageStartIdx, stageEndIdx;
    let myCurrentSlotInfo = getSlotInfo(myPos);
    if (myCurrentSlotInfo.graduated) {
        let seniorFinalInfo = getSlotInfo(999);
        stageStartIdx = seniorFinalInfo.stageSlotStart - 1;
        stageEndIdx = totalSlots - 1;
    } else {
        stageStartIdx = myCurrentSlotInfo.stageSlotStart - 1;
        stageEndIdx = myCurrentSlotInfo.stageSlotEnd - 1;
    }

    //decorative extensions
    stroke(180, 220, 255);
    noFill();

    let extStart = extensionStart.map(p => ({ x: p.x * width, y: p.y * height }));
    let extEnd = extensionEnd.map(p => ({ x: p.x * width, y: p.y * height }));

    for (let i = 0; i < extStart.length - 1; i++) {
        strokeWeight(5 + (seededRandom(i + 9000) - 0.5) * 0.6);
        line(extStart[i].x, extStart[i].y, extStart[i + 1].x, extStart[i + 1].y);
    }
    if (extStart.length > 0) {
        strokeWeight(5);
        let last = extStart[extStart.length - 1];
        line(last.x, last.y, slotPos[0].x, slotPos[0].y);
    }

    if (extEnd.length > 0) {
        strokeWeight(5);
        line(slotPos[slotPos.length - 1].x, slotPos[slotPos.length - 1].y, extEnd[0].x, extEnd[0].y);
    }
    for (let i = 0; i < extEnd.length - 1; i++) {
        strokeWeight(5 + (seededRandom(i + 9100) - 0.5) * 0.6);
        line(extEnd[i].x, extEnd[i].y, extEnd[i + 1].x, extEnd[i + 1].y);
    }

    noFill();
    for (let i = firstVisible; i < lastVisible; i++) {
        let inStage = (i >= stageStartIdx && i + 1 <= stageEndIdx);
        if (inStage) stroke(96, 165, 250);
        else stroke(180, 220, 255);

        let infoA = getSlotInfo(i + 1);
        let infoB = getSlotInfo(i + 2);
        let wA;
        if (infoA.graduated) wA = 5;
        else wA = infoA.stageWeight;
        let wB;
        if (infoB.graduated) wB = 5;
        else wB = infoB.stageWeight;
        let weight = (wA + wB) / 2;

        let wiggle = (seededRandom(i + 8000) - 0.5) * 0.6;
        strokeWeight(weight + wiggle);

        line(slotPos[i].x, slotPos[i].y, slotPos[i + 1].x, slotPos[i + 1].y);
    }


    //users poses (eye)
    for (let id in users) {
        let isMe = (id === myUserId);

        let p = users[id];
        let n = parseInt(p.pos);
        if (isNaN(n) || n < 1 || n > totalSlots || !slotPos[n-1]) continue; 

        let targetX = slotPos[n - 1].x;
        let targetY = slotPos[n - 1].y;

        if(isMe){
            if (n === 1) {
                let vx = slotPos[1].x - slotPos[0].x;
                let vy = slotPos[1].y - slotPos[0].y;
                angle = atan2(vy, vx);
            }
            else if (n === totalSlots) {
                let vx = slotPos[n - 1].x - slotPos[n - 2].x;
                let vy = slotPos[n - 1].y - slotPos[n - 2].y;
                angle = atan2(vy, vx);
            }
            else if (slotPos[n]){ 
                let v1x = slotPos[n - 1].x - slotPos[n - 2].x;
                let v1y = slotPos[n - 1].y - slotPos[n - 2].y;
                let v2x = slotPos[n - 1].x - slotPos[n].x;
                let v2y = slotPos[n - 1].y - slotPos[n].y;
                let len1 = Math.hypot(v1x, v1y);
                let len2 = Math.hypot(v2x, v2y);
                v1x /= len1; v1y /= len1;
                v2x /= len2; v2y /= len2;
                angle = atan2(v1y + v2y, v1x + v2x);
            }
   
            push();
            translate(slotPos[n - 1].x, slotPos[n - 1].y);
            rotate(angle);
            stroke(0);
            noFill();
            line(0, 0, 50, 0);
            pop();
        }

        if (displayX[id] === undefined) {
            displayX[id] = targetX;
            displayY[id] = targetY;
        } else {
            displayX[id] = lerp(displayX[id], targetX, 0.25);
            displayY[id] = lerp(displayY[id], targetY, 0.25);
        }

        let x = displayX[id];
        let y = displayY[id];
        
        let size;
        if (isMe) { size = 30; }
        else { size = 20; }

        fill(255);
        stroke(255, 140, 0);
        strokeWeight(3);

        let eyeWidth = size * 2;
        let eyeLift = size * 0.5;

        beginShape();
        curveVertex(x - eyeWidth / 2, y);
        curveVertex(x - eyeWidth / 2, y);
        curveVertex(x, y - eyeLift);
        curveVertex(x + eyeWidth / 2, y);
        curveVertex(x + eyeWidth / 2, y);
        endShape();

        beginShape();
        curveVertex(x - eyeWidth / 2, y);
        curveVertex(x - eyeWidth / 2, y);
        curveVertex(x, y + eyeLift);
        curveVertex(x + eyeWidth / 2, y);
        curveVertex(x + eyeWidth / 2, y);
        endShape();

        noStroke();
        fill(255, 140, 0);
        circle(x, y, size);

        if (isMe) {
            fill(120);
            textSize(14);
            if (myCurrentSlotInfo.graduated) {
                textAlign(LEFT, CENTER);
                text("Graduated", x + 40, y);
            } else {
                textAlign(RIGHT, CENTER);
                text(myCurrentSlotInfo.yearName + " " + myCurrentSlotInfo.semLabel, x - 40, y);
                textAlign(LEFT, CENTER);
                text(myCurrentSlotInfo.stageName, x + 40, y);
            }
        }
    }

    pop();
}

class BranchDroplet{
  constructor(startX, startY, direction, dataPoints = null, memoData = null){
    this.startX = startX;
    this.startY = startY;
    this.stepSize = 20;
    this.range = random(PI / 3, PI / 2);
    this.direction = direction;
    this.memoData = memoData;

    if (dataPoints) {
        this.points = [dataPoints[0]]; 
        this.fullPathToGrow = dataPoints; 
        this.isFinished = false; 
    } else {
        this.points = [{ x: startX, y: startY }];
        this.stepLimit = floor(5 + random() * 5);
        this.stepNum = 0;
        this.isFinished = false;
    }
  }

  update(){
    if(this.isFinished) return;

    if (this.fullPathToGrow) {
        if (this.points.length < this.fullPathToGrow.length) {
            this.points.push(this.fullPathToGrow[this.points.length]);
        } else {
            this.isFinished = true;
        }
    } else {
        if(this.stepNum >= this.stepLimit) { this.isFinished = true; return; }
        
        let ranAngle = random(0, this.range)-this.range/2 + this.direction;
        let lastP = this.points[this.points.length - 1];
        let nextX = lastP.x + cos(ranAngle) * this.stepSize;
        let nextY = lastP.y + sin(ranAngle) * this.stepSize;
        
        this.points.push({ x: nextX, y: nextY });
        this.stepNum++;
    }
  }

  display(){
    noFill();
    stroke(96, 165, 250);
    strokeWeight(2);
    beginShape();
    for(let p of this.points){
      vertex(p.x, p.y);
    }
    endShape();

    for(let i = 0; i < this.points.length; i++){
      let p = this.points[i];
      if (this.isFinished && i === this.points.length - 1) {
          fill(96, 165, 250, 150);
          noStroke();
          circle(p.x, p.y, 5);
      }
      stroke(0, 10);
      strokeWeight(1);
      noFill();
      circle(p.x, p.y, this.stepSize*2);
    }
  }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    rebuildBranches();
}