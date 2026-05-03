function preload() {
    loadJSON("mapData.json", data => {
        applyMapData(data);
        rebuildBranches(); 
    });
}

let canvas;
let branchDroplets = [];
let highlightAncestry = {}; 

const usernameKEY = "user-name";
const userPosKEY = "user-pos";

let username = localStorage.getItem(usernameKEY);
let myPos = parseInt(localStorage.getItem(userPosKEY));

function getOrCreateUserId() {
    let userID = localStorage.getItem("user-id");
    if (!userID) {
        userID = crypto.randomUUID();
        localStorage.setItem("user-id", userID);
    }
    return userID;
}
let myUserId = getOrCreateUserId();

//socket io communication setup
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

let users = { [myUserId]: myInfo };

socket.on("connect", () => socket.emit("identify", myInfo));
socket.on("please-re-identify", () => socket.emit("identify", myInfo));

socket.on("all-users", function (allUsers) {
    for (let p of allUsers) {
        if (p.userId !== myUserId) users[p.userId] = p;
    }
});

socket.on("user-joined", function (p) {
    if (p.userId !== myUserId) users[p.userId] = p;
});

socket.on("user-left", function (data) {
    delete users[data.userId];
    delete userFloatPos[data.userId];
});

socket.on("user-moved", function (data) {
    if (data.userId !== myUserId && users[data.userId]) {
        users[data.userId].pos = data.pos;
    }
});

//memo structure: { id, slot, authorId, authorName, text, branchPoints: [{dx, dy}, ...] }
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
    if (typeof slotPoses === 'undefined' || slotPoses.length === 0) {
        return; 
    }

    branchDroplets = [];
    slotIconPositions = {};
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

    branchDroplets.push(b);
}

//compose view
let composeOverlay = document.querySelector("#composeOverlay");
let composeText = document.querySelector("#composeText");
let cancelBtn = document.querySelector("#cancelBtn");
let addBtn = document.querySelector("#addBtn");

function openCompose() {
    composeText.value = "";
    composeOverlay.classList.remove("hidden");
    composeText.focus();
}

function closeCompose() {
    composeOverlay.classList.add("hidden");
    composeText.blur();
}

[cancelBtn, addBtn].forEach(btn => {
    btn.addEventListener("touchend", function(e) {
        e.stopPropagation();
        e.preventDefault();
        btn.click();
    });
});

[composeOverlay, cancelBtn, addBtn].forEach(el => {
    el.addEventListener("touchstart", e => e.stopPropagation());
});

composeText.addEventListener("touchend", function (e) {
    e.stopPropagation();
    composeText.focus();
});
composeText.addEventListener("click", function (e) {
    e.stopPropagation();
    composeText.focus();
});

composeText.addEventListener("blur", function () {
    window.scrollTo(0, 0); 
    document.body.scrollTop = 0; 
});

composeText.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        e.preventDefault(); 
        composeText.blur(); 
    }
});

composeOverlay.addEventListener("touchmove", function (e) {
    if (e.target !== composeText) {
        e.preventDefault(); 
    }
}, { passive: false });

cancelBtn.addEventListener("click", closeCompose);

function pickBranchStart(slotCenter) {
    let potentialStartPoints = [];
    for (let b of branchDroplets) {
        if (b.memoData && b.memoData.slot === myPos && b.points.length >= 3) {
            for (let i = 1; i < b.points.length - 1; i++) {
                potentialStartPoints.push(b.points[i]);
            }
        }
    }

    if (potentialStartPoints.length > 0 && Math.random() < 0.7) {
        return potentialStartPoints[Math.floor(Math.random() * potentialStartPoints.length)];
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
    
    let existingEnds = [];
    for (let b of branchDroplets) {
        if (b.memoData && b.memoData.slot === myPos && b.points.length > 0) {
            existingEnds.push(b.points[b.points.length - 1]);
        }
    }

    let angle = 0;
    let n = myPos;
    if (n === 1) {
        let vx = slotPoses[1].x - slotPoses[0].x;
        let vy = slotPoses[1].y - slotPoses[0].y;
        angle = atan2(vy, vx) + PI/3;
    } else if (n === totalSlots) {
        let vx = slotPoses[n - 1].x - slotPoses[n - 2].x;
        let vy = slotPoses[n - 1].y - slotPoses[n - 2].y;
        angle = atan2(vy, vx) + PI/6;
    } else if (slotPoses[n]) {
        let v1x = slotPoses[n - 1].x - slotPoses[n - 2].x;
        let v1y = slotPoses[n - 1].y - slotPoses[n - 2].y;
        let v2x = slotPoses[n - 1].x - slotPoses[n].x;
        let v2y = slotPoses[n - 1].y - slotPoses[n].y;
        let len1 = Math.hypot(v1x, v1y);
        let len2 = Math.hypot(v2x, v2y);
        angle = atan2((v1y/len1) + (v2y/len2), (v1x/len1) + (v2x/len2));
    }

    let tempB = new BranchDroplet(
        startPoint.x, startPoint.y, angle,
        null, null,
        { x: slotCenterX, y: slotCenterY },
        180, 180, existingEnds
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

//read view
let readOverlay = document.querySelector("#readOverlay");
let readAuthor = document.querySelector("#readAuthor");
let readText = document.querySelector("#readText");
let prevMemoBtn = document.querySelector("#prevMemoBtn");
let nextMemoBtn = document.querySelector("#nextMemoBtn");
let readCounter = document.querySelector("#readCounter");

let currentReadMemos = [];
let currentReadIndex = 0;
let currentHighlightMemoId = null;

let iconOpacity = 0;
let lastIconSlot = -1;
let slotIconPositions = {}; 
let slotChangeTime = 0;
let currentIconDispPos = null; 

function openReadCarousel(memosList) {
    currentReadMemos = memosList;
    currentReadIndex = memosList.length - 1; 
    updateReadContent();
    readOverlay.classList.remove("hidden");
}

function updateReadContent() {
    if (currentReadMemos.length === 0) return;
    let memo = currentReadMemos[currentReadIndex];
    
    readAuthor.innerText = "— " + memo.authorName;
    readText.innerText = memo.text;
    readCounter.innerText = (currentReadIndex + 1) + " / " + currentReadMemos.length;
    
    let shouldHide = currentReadMemos.length <= 1;
    prevMemoBtn.classList.toggle("invisible", shouldHide);
    nextMemoBtn.classList.toggle("invisible", shouldHide);

    currentHighlightMemoId = memo.id; 
}

function closeRead() {
    readOverlay.classList.add("hidden");
    currentHighlightMemoId = null; 
}

// read overlay event blockers
let readBubble = document.querySelector(".read-bubble");
readBubble.addEventListener("click", e => e.stopPropagation());
readBubble.addEventListener("touchend", e => e.stopPropagation());

readOverlay.addEventListener("touchstart", e => e.stopPropagation());

readOverlay.addEventListener("touchmove", function (e) {
    if (e.target !== readText) { 
        e.preventDefault();
    }
}, { passive: false });

readOverlay.addEventListener("touchend", function (e) {
    e.stopPropagation();
    e.preventDefault();
    closeRead();
});
readOverlay.addEventListener("click", function (e) {
    e.stopPropagation();
    closeRead();
});

prevMemoBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    if (currentReadMemos.length === 0) return;
    if (currentReadIndex > 0) {
        currentReadIndex--;
    } else {
        currentReadIndex = currentReadMemos.length - 1; 
    }
    updateReadContent();
});

nextMemoBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    if (currentReadMemos.length === 0) return;
    if (currentReadIndex < currentReadMemos.length - 1) {
        currentReadIndex++;
    } else {
        currentReadIndex = 0; 
    }
    updateReadContent();
});

[prevMemoBtn, nextMemoBtn].forEach(btn => {
    btn.addEventListener("touchend", function(e) {
        e.stopPropagation();
        e.preventDefault();
        btn.click();
    });
});

//touch events
let touchStartY = 0;
let swipeAnchorY = 0;
const swipeUnit = 24;

function touchStarted() {
    if (!composeOverlay.classList.contains("hidden") || !readOverlay.classList.contains("hidden")) {
        return; 
    }

    let ty;
    if (touches.length > 0) {
        ty = touches[0].y;
    } else {
        ty = mouseY;
    }
    touchStartY = ty;
    swipeAnchorY = ty;
    return false;
}

function touchMoved() {
    if (!composeOverlay.classList.contains("hidden") || !readOverlay.classList.contains("hidden")) {
        return; 
    }

    let ty;
    if (touches.length > 0) {
        ty = touches[0].y;
    } else {
        ty = mouseY;
    }
    let dy = ty - swipeAnchorY;

    if (Math.abs(dy) >= swipeUnit) {
        let steps;
        if (dy < 0) {
            steps = Math.floor(-dy / swipeUnit);
        } else {
            steps = -Math.floor(dy / swipeUnit);
        }
        if (steps !== 0) {
            changeMyPos(myPos + steps);
            swipeAnchorY = ty;
        }
    }
    return false;
}

function touchEnded() {
    if (!composeOverlay.classList.contains("hidden") || !readOverlay.classList.contains("hidden")) {
        return; 
    }

    let viewCenterX = getCanvasCenterX();
    let viewCenterY = getCanvasCenterY();
    let worldEndX = mouseX - width / 2 + viewCenterX;
    let worldEndY = mouseY - height / 2 + viewCenterY;
    
    let dy = mouseY - touchStartY;
    let totalMove = Math.abs(dy);

    if (totalMove < 15) {
        let currentSlotMemos = memos.filter(m => m.slot === myPos);
        let clickedIcon = false;

        if (window.currentBranchIconPos && currentSlotMemos.length > 0) {
            let dIcon = dist(worldEndX, worldEndY, window.currentBranchIconPos.x, window.currentBranchIconPos.y);
            if (dIcon < 30) { 
                openReadCarousel(currentSlotMemos);
                clickedIcon = true;
            }
        }

        if (!clickedIcon) {
            let myWorldX = displayX[myUserId];
            let myWorldY = displayY[myUserId];
            if (myWorldX !== undefined && myWorldY !== undefined) {
                if (dist(worldEndX, worldEndY, myWorldX, myWorldY) < 60) {
                    openCompose();
                }
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

// canvas move
let myFloatPos = null;
let userFloatPos = {};   
let canvasFocusX = null;
let canvasFocusY = null;
let displayX = {};
let displayY = {};

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

function updateCanvasCenter() {
    if (!slotPoses[myPos - 1]) return;

    if (myFloatPos === null) {
        myFloatPos = myPos;
    } else {
        myFloatPos = lerp(myFloatPos, myPos, 0.25);
        if (Math.abs(myPos - myFloatPos) < 0.05) myFloatPos = myPos;
    }

    let pos = getSlotPosFloat(myFloatPos);
    canvasFocusX = pos.x;
    canvasFocusY = pos.y;
}

function getCanvasCenterX() {
    if (canvasFocusX !== null) {
        return canvasFocusX;
    } else {
        return 0;
    }
}

function getCanvasCenterY() {
    if (canvasFocusY !== null) {
        return canvasFocusY;
    } else {
        return 0;
    }
}

//p5 setup and draw
function setup() {
    canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent("p5-canvas-container");
    textFont("sans-serif");
}

function draw() {
    background(255);

    updateCanvasCenter();
    let viewCenterX = getCanvasCenterX();
    let viewCenterY = getCanvasCenterY();
    let offsetX = width / 2 - viewCenterX;
    let offsetY = height / 2 - viewCenterY;

    // ancestry tracing
    highlightAncestry = {};
    if (currentHighlightMemoId !== null) {
        let hb = branchDroplets.find(b => b.memoData && b.memoData.id === currentHighlightMemoId);
        if (hb && hb.points && hb.points.length > 0) {
            highlightAncestry[hb.memoData.id] = hb.points.length - 1;
            
            let slotCenter = slotPoses[hb.memoData.slot - 1];
            if (slotCenter) {
                let currP = hb.points[0];
                let loopCount = 0;
                
                while (dist(currP.x, currP.y, slotCenter.x, slotCenter.y) > 2.0 && loopCount < 100) {
                    loopCount++;
                    let foundParent = false;
                    for (let potentialParent of branchDroplets) {
                        if (!potentialParent.memoData || potentialParent.memoData.slot !== hb.memoData.slot) continue;
                        if (highlightAncestry[potentialParent.memoData.id] !== undefined) continue; 
                        
                        for (let i = 0; i < potentialParent.points.length; i++) {
                            if (dist(potentialParent.points[i].x, potentialParent.points[i].y, currP.x, currP.y) < 2.0) {
                                highlightAncestry[potentialParent.memoData.id] = i; 
                                currP = potentialParent.points[0];
                                foundParent = true;
                                break;
                            }
                        }
                        if (foundParent) break;
                    }
                    if (!foundParent) break; 
                }
            }
        }
    }

    push();
    translate(offsetX, offsetY);

    for (let b of branchDroplets) b.update();

    for (let b of branchDroplets) {
        if (b.memoData && b.memoData.slot !== myPos) b.displayBase(false);
    }
    for (let b of branchDroplets) {
        if (b.memoData && b.memoData.slot === myPos) b.displayBase(false);
    }

    let viewTop = viewCenterY - height / 2;
    let viewBottom = viewCenterY + height / 2;
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

    drawRiverSystem(false, firstVisible, lastVisible, stageStartIdx, stageEndIdx);

    for (let b of branchDroplets) {
        if (b.memoData) b.displayHighlight();
    }

    let sumX = 0, sumY = 0;
    let farthestDist = -1;
    let branchCount = 0;
    let allFinished = true;
    let slotCenterForIcon = slotPoses[myPos - 1];

    for (let b of branchDroplets) {
        if (b.memoData && b.memoData.slot === myPos && b.points.length > 0) {
            if (!b.isFinished) allFinished = false;
            branchCount++;
            let lastP = b.points[b.points.length - 1];
            sumX += lastP.x;
            sumY += lastP.y;
            if (slotCenterForIcon) {
                let d = dist(slotCenterForIcon.x, slotCenterForIcon.y, lastP.x, lastP.y);
                if (d > farthestDist) farthestDist = d;
            }
        }
    }

    if (branchCount > 0) {
        if (allFinished && slotCenterForIcon && farthestDist > 0) {
            let centroidX = sumX / branchCount;
            let centroidY = sumY / branchCount;

            let dx = centroidX - slotCenterForIcon.x;
            let dy = centroidY - slotCenterForIcon.y;
            let centroidDist = dist(slotCenterForIcon.x, slotCenterForIcon.y, centroidX, centroidY);

            let targetIconX, targetIconY;
            if (centroidDist > 0) {
                targetIconX = slotCenterForIcon.x + (dx / centroidDist) * farthestDist;
                targetIconY = slotCenterForIcon.y + (dy / centroidDist) * farthestDist;
            } else {
                targetIconX = slotCenterForIcon.x + farthestDist;
                targetIconY = slotCenterForIcon.y;
            }

            let padX = 14, padY = 40; 
            targetIconX = constrain(targetIconX, viewCenterX - width / 2 + padX, viewCenterX + width / 2 - padX);
            targetIconY = constrain(targetIconY, viewCenterY - height / 2 + padY, viewCenterY + height / 2 - padY);

            slotIconPositions[myPos] = { x: targetIconX, y: targetIconY };
        }

        let idealPos = slotIconPositions[myPos];

        if (lastIconSlot !== myPos) {
            iconOpacity = 0;
            slotChangeTime = millis();
            lastIconSlot = myPos;
            if (idealPos) {
                currentIconDispPos = { x: idealPos.x, y: idealPos.y };
            } else {
                currentIconDispPos = null;
            }
        } else {
            if (idealPos) {
                if (!currentIconDispPos) {
                    currentIconDispPos = { x: idealPos.x, y: idealPos.y };
                } else {
                    currentIconDispPos.x = lerp(currentIconDispPos.x, idealPos.x, 0.05);
                    currentIconDispPos.y = lerp(currentIconDispPos.y, idealPos.y, 0.05);
                }
            }
        }

        if (currentIconDispPos) {
            window.currentBranchIconPos = currentIconDispPos; 
            
            if (millis() - slotChangeTime > 1000) {
                iconOpacity = min(iconOpacity + 15, 255);
            }

            let isReading = (currentHighlightMemoId !== null);

            if (iconOpacity > 0 && !isReading) {
                push(); 
                translate(currentIconDispPos.x, currentIconDispPos.y);
                blendMode(DIFFERENCE);
                fill(250, 135, 0, iconOpacity);
                noStroke();
                triangle(0, 0, -5, 14, 5, 14);
                arc(0, 14, 10, 10, 0, PI, CHORD);
                pop(); 
            }
        }
    } else {
        lastIconSlot = -1;
        iconOpacity = 0;
        window.currentBranchIconPos = null;
        currentIconDispPos = null;
    }

    for (let id in users) {
        let isMe = (id === myUserId);
        let p = users[id];
        let n = parseInt(p.pos);
        if (isNaN(n) || n < 1 || n > totalSlots || !slotPoses[n - 1]) continue;

        if (isMe) {
            displayX[id] = viewCenterX;
            displayY[id] = viewCenterY;
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
        let size;
        if (isMe) {
            size = 30;
        } else {
            size = 20;
        }

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
            stroke(255, 200);
            strokeJoin(ROUND);
            strokeWeight(2);
            fill(120);
            textSize(14);
            if (myCurrentSlotInfo.graduated) {
                textAlign(LEFT, CENTER);
                text("Graduated", x + 40, y);
            } else {
                textAlign(RIGHT, CENTER);
                text(`${myCurrentSlotInfo.yearName} ${myCurrentSlotInfo.semLabel}`, x - 40, y);
                textAlign(LEFT, CENTER);
                text(myCurrentSlotInfo.stageName, x + 40, y);
            }
        }
    }
    pop();

    let isReadOpen = !readOverlay.classList.contains("hidden");
    let isComposeOpen = !composeOverlay.classList.contains("hidden");

    if (isReadOpen || isComposeOpen) {
        push();
        drawingContext.save();
        drawingContext.beginPath();
        drawingContext.arc(width / 2, height / 2, 140, 0, Math.PI * 2);
        drawingContext.clip();

        noStroke();
        fill(96, 165, 250); 
        circle(width / 2, height / 2, 280);

        translate(offsetX, offsetY);
        drawRiverSystem(true, firstVisible, lastVisible, stageStartIdx, stageEndIdx);

        for (let b of branchDroplets) if (b.memoData) b.displayBase(true);
        for (let b of branchDroplets) if (b.memoData) b.displayHighlight();

        drawingContext.restore();
        pop();
    }
}

function drawRiverSystem(isOverlay, firstVisible, lastVisible, stageStartIdx, stageEndIdx) {
    if (isOverlay) {
        stroke(99, 167, 250);
    } else {
        stroke(225, 240, 255);
    }
    
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

    for (let i = firstVisible; i < lastVisible; i++) {
        let slotA = i + 1;
        let slotB = i + 2;
        let inStage = (slotA >= stageStartIdx + 1 && slotB <= stageEndIdx + 1);

        if (isOverlay) {
            if (inStage) {
                stroke(color(106, 172, 250));
            } else {
                stroke(color(99, 167, 250));
            }
        } else {
            if (inStage) {
                stroke(color(160, 210, 255));
            } else {
                stroke(color(225, 240, 255));
            }
        }

        let infoA = getSlotInfo(slotA);
        let infoB = getSlotInfo(slotB);
        let weight = (infoA.stageWeight + infoB.stageWeight) / 2;
        let wiggle = (seededRandom(i + 8000) - 0.5) * 0.2;
        
        strokeWeight(weight + wiggle);
        line(slotPoses[i].x, slotPoses[i].y, slotPoses[i + 1].x, slotPoses[i + 1].y);
    }
}

class BranchDroplet {
    constructor(startX, startY, direction, dataPoints = null, memoData = null,
                slotCenter = null, maxX = null, maxY = null, existingEnds = null) {
        this.startX = startX;
        this.startY = startY;
        this.stepSize = random(10, 15);
        this.baseRange = PI / 3; 
        this.direction = direction;
        this.memoData = memoData;
        this.slotCenter = slotCenter;
        this.maxX = maxX;
        this.maxY = maxY;
        if (existingEnds) {
            this.existingEnds = existingEnds;
        } else {
            this.existingEnds = [];
        }
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
        
        if (this.stepNum >= this.stepLimit) { 
            this.isFinished = true; 
            return; 
        }

        let lastP = this.points[this.points.length - 1];
        let isLastStep = (this.stepNum + 1 === this.stepLimit);
        let currentRange;
        if (this.stepNum >= 8) {
            currentRange = PI / 1.5;
        } else {
            currentRange = this.baseRange;
        }
        let nextX, nextY;
        let success = false;

        for (let attempt = 0; attempt < 50; attempt++) {
            let ranAngle = random(0, currentRange) - currentRange / 2 + this.direction;
            nextX = lastP.x + cos(ranAngle) * this.stepSize;
            nextY = lastP.y + sin(ranAngle) * this.stepSize;

            if (this.slotCenter && this.maxX != null && this.maxY != null) {
                let ddx = nextX - this.slotCenter.x;
                let ddy = nextY - this.slotCenter.y;
                if (Math.abs(ddx) > this.maxX || Math.abs(ddy) > this.maxY) continue;
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

        if (!success) { 
            this.isFinished = true; 
            return; 
        }
        
        this.points.push({ x: nextX, y: nextY });
        this.stepNum++;
    }

    displayBase(isOverlay = false) {
        noFill();
        let onMySlot = false;
        let inStage = false;
        
        let branchSlot = this.memoData.slot;
        if (branchSlot === myPos) {
            onMySlot = true;
        } else {
            let mySlotInfo = getSlotInfo(myPos);
            if (branchSlot >= mySlotInfo.stageSlotStart && branchSlot <= mySlotInfo.stageSlotEnd) {
                inStage = true;
            }
        }

        if (isOverlay) {
            if (onMySlot) stroke(120, 180, 250);
            else if (inStage) stroke(106, 172, 250);
            else stroke(99, 167, 250);
        } else {
            if (onMySlot) stroke(96, 165, 250); 
            else if (inStage) stroke(160, 210, 255); 
            else stroke(225, 240, 255); 
        }

        let highlightIndex = highlightAncestry[this.memoData.id];

        strokeWeight(2);
        beginShape();
        if (highlightIndex !== undefined) {
            if (highlightIndex < this.points.length - 1) {
                for (let i = highlightIndex; i < this.points.length; i++) {
                    vertex(this.points[i].x, this.points[i].y);
                }
            }
        } else {
            for (let p of this.points) vertex(p.x, p.y);
        }
        endShape();
    }

    displayHighlight() {
        let highlightIndex = highlightAncestry[this.memoData.id];
        if (highlightIndex !== undefined) {
            noFill();
            stroke(10, 40, 180); 
            strokeWeight(2);
            beginShape();
            for (let i = 0; i <= highlightIndex; i++) {
                vertex(this.points[i].x, this.points[i].y);
            }
            endShape();
        }
    }
}

let lastWinWidth = window.innerWidth;

function windowResized() {
    if (window.innerWidth !== lastWinWidth) {
        resizeCanvas(windowWidth, windowHeight);
        rebuildBranches();
        lastWinWidth = window.innerWidth;
    }
}