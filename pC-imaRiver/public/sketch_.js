function preload() {
    loadJSON("mapData.json", function (data) {
        applyMapData(data);
    });
}

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

// socket.io
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
    delete userFloatPos[data.userId];
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
        x: slotPoses[memo.slot - 1].x,
        y: slotPoses[memo.slot - 1].y
    };

    let absPoints = memo.branchPoints.map(p => ({
        x: slotCenter.x + p.dx,
        y: slotCenter.y + p.dy
    }));

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

function pickBranchStart(slotCenter) {
    let candidates = [];
    for (let b of visualBranches) {
        if (b.memoData && b.memoData.slot === myPos && b.points.length >= 3) {
            for (let i = 1; i < b.points.length - 1; i++) {
                candidates.push(b.points[i]);
            }
        }
    }

    if (candidates.length > 0 && Math.random() < 0.7) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return slotCenter;
}

addBtn.addEventListener("click", function () {
    let text = composeText.value.trim();
    if (!text) {
        closeCompose();
        return;
    }

    let slotIdx = myPos - 1;
    if (!slotPoses[slotIdx]) { closeCompose(); return; }

    let slotCenterX = slotPoses[slotIdx].x;
    let slotCenterY = slotPoses[slotIdx].y;

    let startPoint = pickBranchStart({ x: slotCenterX, y: slotCenterY });
    let startX = startPoint.x;
    let startY = startPoint.y;

    let existingEnds = [];
    for (let b of visualBranches) {
        if (b.memoData && b.memoData.slot === myPos && b.points.length > 0) {
            existingEnds.push(b.points[b.points.length - 1]);
        }
    }

    let tempB = new BranchDroplet(
        startX, startY, angle,
        null, null,
        { x: slotCenterX, y: slotCenterY },
        180,
        existingEnds
    );
    while (!tempB.isFinished) {
        tempB.update();
    }

    if (tempB.points.length < 2) {
        closeCompose();
        return;
    }

    let relativePoints = tempB.points.map(p => ({
        dx: p.x - slotCenterX,
        dy: p.y - slotCenterY
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

    let camX = getCameraX();
    let camY = getCameraY();
    let worldEndX = mouseX - width / 2 + camX;
    let worldEndY = mouseY - height / 2 + camY;
    let worldStartY = touchStartY - height / 2 + camY;

    let dy = worldEndY - worldStartY;
    let totalMove = Math.abs(dy);

    if (totalMove < 15) {
        for (let b of visualBranches) {
            if (b.memoData && b.memoData.slot === myPos) {
                let lastP = b.points[b.points.length - 1];
                if (dist(worldEndX, worldEndY, lastP.x, lastP.y) < 30) {
                    openRead(b.memoData);
                    return false;
                }
            }
        }

        let myWorldX = displayX[myUserId];
        let myWorldY = displayY[myUserId];
        if (myWorldX !== undefined && myWorldY !== undefined) {
            if (dist(worldEndX, worldEndY, myWorldX, myWorldY) < 60) {
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

let myFloatPos = null;
let userFloatPos = {};   
let cameraDisplayX = null;
let cameraDisplayY = null;

function getSlotPosFloat(floatSlot) {
    let i = Math.floor(floatSlot) - 1;
    let frac = floatSlot - Math.floor(floatSlot);
    if (i < 0) return slotPoses[0];
    if (i >= slotPoses.length - 1) return slotPoses[slotPoses.length - 1];
    let a = slotPoses[i];
    let b = slotPoses[i + 1];
    return {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac
    };
}

function updateCamera() {
    if (!slotPoses[myPos - 1]) return;

    if (myFloatPos === null) {
        myFloatPos = myPos;
    } else {
        myFloatPos = lerp(myFloatPos, myPos, 0.25);
        if (Math.abs(myPos - myFloatPos) < 0.05) myFloatPos = myPos;
    }

    let pos = getSlotPosFloat(myFloatPos);
    cameraDisplayX = pos.x;
    cameraDisplayY = pos.y;
}

function getCameraX() {
    return cameraDisplayX !== null ? cameraDisplayX : 0;
}

function getCameraY() {
    return cameraDisplayY !== null ? cameraDisplayY : 0;
}

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("p5-canvas-container");
    textFont("sans-serif");
}

let displayX = {};
let displayY = {};

function draw() {
    background(255);

    updateCamera();
    let camX = getCameraX();
    let camY = getCameraY();

    let offsetX = width / 2 - camX;
    let offsetY = height / 2 - camY;

    push();
    translate(offsetX, offsetY);

    // 1. 先画非当前 slot 的分支
    for (let b of visualBranches) {
        if (b.memoData && b.memoData.slot !== myPos) {
            b.update();
            b.display();
        }
    }
    // 2. 再画当前 slot 的分支（确保层级最高）
    for (let b of visualBranches) {
        if (b.memoData && b.memoData.slot === myPos) {
            b.update();
            b.display();
        }
    }

    let viewTop = camY - height / 2;
    let viewBottom = camY + height / 2;
    let firstVisible = 0;
    let lastVisible = slotPoses.length - 1;
    for (let i = 0; i < slotPoses.length; i++) {
        if (slotPoses[i].y >= viewTop - height * 0.5) {
            firstVisible = Math.max(0, i - 2);
            break;
        }
    }
    for (let i = slotPoses.length - 1; i >= 0; i--) {
        if (slotPoses[i].y <= viewBottom + height * 0.5) {
            lastVisible = Math.min(slotPoses.length - 1, i + 2);
            break;
        }
    }

    let myCurrentSlotInfo = getSlotInfo(myPos);
    let stageStartIdx = myCurrentSlotInfo.stageSlotStart - 1;
    let stageEndIdx = myCurrentSlotInfo.stageSlotEnd - 1;

    // extension lines
    stroke(225, 240, 255);
    noFill();
    for (let i = 0; i < extensionStart.length - 1; i++) {
        strokeWeight(5 + (seededRandom(i + 9000) - 0.5) * 0.6);
        line(extensionStart[i].x, extensionStart[i].y, extensionStart[i + 1].x, extensionStart[i + 1].y);
    }
    if (extensionStart.length > 0) {
        strokeWeight(5);
        let last = extensionStart[extensionStart.length - 1];
        line(last.x, last.y, slotPoses[0].x, slotPoses[0].y);
    }
    if (extensionEnd.length > 0) {
        strokeWeight(5);
        line(slotPoses[slotPoses.length - 1].x, slotPoses[slotPoses.length - 1].y, extensionEnd[0].x, extensionEnd[0].y);
    }
    for (let i = 0; i < extensionEnd.length - 1; i++) {
        strokeWeight(5 + (seededRandom(i + 9100) - 0.5) * 0.6);
        line(extensionEnd[i].x, extensionEnd[i].y, extensionEnd[i + 1].x, extensionEnd[i + 1].y);
    }

    // MAIN LINE: 两档颜色
    noFill();
    for (let i = firstVisible; i < lastVisible; i++) {
        let slotA = i + 1;
        let slotB = i + 2;
        let inStage = (slotA >= stageStartIdx + 1 && slotB <= stageEndIdx + 1);

        if (inStage) {
            stroke(160, 210, 255); // 阶段蓝
        } else {
            stroke(225, 240, 255); // 背景灰
        }

        let infoA = getSlotInfo(slotA);
        let infoB = getSlotInfo(slotB);
        let weight = (infoA.stageWeight + infoB.stageWeight) / 2;
        let wiggle = (seededRandom(i + 8000) - 0.5) * 0.2;
        strokeWeight(weight + wiggle);
        line(slotPoses[i].x, slotPoses[i].y, slotPoses[i + 1].x, slotPoses[i + 1].y);
    }

    // user display
    for (let id in users) {
        let isMe = (id === myUserId);
        let p = users[id];
        let n = parseInt(p.pos);
        if (isNaN(n) || n < 1 || n > totalSlots || !slotPoses[n - 1]) continue;

        if (isMe) {
            if (n === 1) {
                let vx = slotPoses[1].x - slotPoses[0].x;
                let vy = slotPoses[1].y - slotPoses[0].y;
                angle = atan2(vy, vx)+PI/2;
            } else if (n === totalSlots) {
                let vx = slotPoses[n - 1].x - slotPoses[n - 2].x;
                let vy = slotPoses[n - 1].y - slotPoses[n - 2].y;
                angle = atan2(vy, vx)+PI/2;
            } else if (slotPoses[n]) {
                let v1x = slotPoses[n - 1].x - slotPoses[n - 2].x;
                let v1y = slotPoses[n - 1].y - slotPoses[n - 2].y;
                let v2x = slotPoses[n - 1].x - slotPoses[n].x;
                let v2y = slotPoses[n - 1].y - slotPoses[n].y;
                let len1 = Math.hypot(v1x, v1y);
                let len2 = Math.hypot(v2x, v2y);
                v1x /= len1; v1y /= len1;
                v2x /= len2; v2y /= len2;
                angle = atan2(v1y + v2y, v1x + v2x);
            }
        }

        if (isMe) {
            displayX[id] = camX;
            displayY[id] = camY;
        } else {
            if (userFloatPos[id] === undefined) {
                userFloatPos[id] = n;
            } else {
                userFloatPos[id] = lerp(userFloatPos[id], n, 0.25);
                if (Math.abs(n - userFloatPos[id]) < 0.05) userFloatPos[id] = n;
            }
            let pos = getSlotPosFloat(userFloatPos[id]);
            displayX[id] = pos.x;
            displayY[id] = pos.y;
        }

        let x = displayX[id];
        let y = displayY[id];
        let size = isMe ? 30 : 20;

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

class BranchDroplet {
    constructor(startX, startY, direction, dataPoints = null, memoData = null,
                slotCenter = null, maxRadius = null, existingEnds = null) {
        this.startX = startX;
        this.startY = startY;
        this.stepSize = random(10,20);
        this.baseRange = PI / 3; // 初始 60度
        this.direction = direction;
        this.memoData = memoData;
        this.slotCenter = slotCenter;
        this.maxRadius = maxRadius;
        this.existingEnds = existingEnds || [];
        this.minEndSpacing = 100;

        if (dataPoints) {
            this.points = [dataPoints[0]];
            this.fullPathToGrow = dataPoints;
            this.isFinished = false;
        } else {
            this.points = [{ x: startX, y: startY }];
            this.stepLimit = floor(8 + random() * 5);
            this.stepNum = 0;
            this.isFinished = false;
        }
    }

    update() {
        if (this.isFinished) return;
        if (this.fullPathToGrow) {
            if (this.points.length < this.fullPathToGrow.length) {
                this.points.push(this.fullPathToGrow[this.points.length]);
            } else {
                this.isFinished = true;
            }
            return;
        }
        if (this.stepNum >= this.stepLimit) { this.isFinished = true; return; }

        let lastP = this.points[this.points.length - 1];
        let isLastStep = (this.stepNum + 1 === this.stepLimit);
        
        // 8步之后角度变大，增强避障和折返能力
        let currentRange = (this.stepNum >= 8) ? PI / 1.5 : this.baseRange;

        let nextX, nextY;
        let success = false;

        for (let attempt = 0; attempt < 50; attempt++) {
            let ranAngle = random(0, currentRange) - currentRange / 2 + this.direction;
            nextX = lastP.x + cos(ranAngle) * this.stepSize;
            nextY = lastP.y + sin(ranAngle) * this.stepSize;

            if (this.slotCenter && this.maxRadius != null) {
                let ddx = nextX - this.slotCenter.x;
                let ddy = nextY - this.slotCenter.y;
                if (ddx * ddx + ddy * ddy > this.maxRadius * this.maxRadius) continue;
            }

            if (isLastStep && this.existingEnds.length > 0) {
                let tooClose = false;
                for (let e of this.existingEnds) {
                    let ddx = nextX - e.x;
                    let ddy = nextY - e.y;
                    if (ddx * ddx + ddy * ddy < this.minEndSpacing * this.minEndSpacing) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;
            }
            success = true;
            break;
        }

        if (!success) { this.isFinished = true; return; }
        this.points.push({ x: nextX, y: nextY });
        this.stepNum++;
    }

    display() {
        noFill();
        let onMySlot = false;
        let inStage = false;

        if (this.memoData) {
            let branchSlot = this.memoData.slot;
            if (branchSlot === myPos) {
                onMySlot = true;
            } else {
                let myInfo = getSlotInfo(myPos);
                if (branchSlot >= myInfo.stageSlotStart && branchSlot <= myInfo.stageSlotEnd) {
                    inStage = true;
                }
            }
        }

        if (onMySlot) {
            stroke(96, 165, 250); // 最深蓝
        } else if (inStage) {
            stroke(160, 210, 255); // 同阶段浅蓝
        } else {
            stroke(225, 240, 255); // 极淡
        }

        strokeWeight(2);
        beginShape();
        for (let p of this.points) {
            vertex(p.x, p.y);
        }
        endShape();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    rebuildBranches();
}