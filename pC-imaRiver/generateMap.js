const fs = require("fs");
const path = require("path");

const totalSlots = 1000;
const years = ["Freshman", "Sophomore", "Junior", "Senior"];

const WORLD_SCALE_X = 400;
const WORLD_SCALE_Y = 800;

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function getSlotInfo(slot) {
    if (slot === 1000) return { graduated: true };
    let idx = slot - 1;
    let yearIdx = Math.floor(idx / 254);
    let within = idx % 254;
    let segIdx, period, isBreak;
    if (within < 110)        { segIdx = 0; period = within + 1;          isBreak = false; }
    else if (within < 127)   { segIdx = 1; period = within - 110 + 1;    isBreak = true; }
    else if (within < 237)   { segIdx = 2; period = within - 127 + 1;    isBreak = false; }
    else                     { segIdx = 3; period = within - 237 + 1;    isBreak = true; }

    let stageStart, stageEnd;
    if (isBreak) { stageStart = 1; stageEnd = 17; }
    else {
        if (period <= 15)        { stageStart = 1;  stageEnd = 15;  }
        else if (period <= 44)   { stageStart = 16; stageEnd = 44;  }
        else if (period <= 64)   { stageStart = 45; stageEnd = 64;  }
        else if (period <= 85)   { stageStart = 65; stageEnd = 85;  }
        else                     { stageStart = 86; stageEnd = 110; }
    }
    let yearOffset = yearIdx * 254;
    let segOffset;
    if (segIdx === 0) segOffset = 0;
    else if (segIdx === 1) segOffset = 110;
    else if (segIdx === 2) segOffset = 127;
    else segOffset = 237;
    return {
        graduated: false,
        stageSlotStart: yearOffset + segOffset + stageStart,
    };
}

function getSlotBuckets(slot) {
    let idx = slot - 1;
    let yearIdx = Math.floor(idx / 254);
    let within = idx % 254;
    let segIdx;
    if (within < 110) segIdx = 0;
    else if (within < 127) segIdx = 1;
    else if (within < 237) segIdx = 2;
    else segIdx = 3;
    let info = getSlotInfo(slot);
    return { yearIdx, segIdx, stageKey: info.stageSlotStart };
}

function generateSlotPoses() {
    let poses = [];
    let baseStep = 1 / 30;
    let cursorX = 0.5;
    let cursorY = 0.1;
    let prevYearIdx = -1;

    for (let i = 0; i < totalSlots; i++) {
        let slot = i + 1;
        let info = getSlotInfo(slot);

        if (info.graduated) {
            cursorY += baseStep * 5;
            poses.push({ x: cursorX, y: cursorY });
            continue;
        }

        let buckets = getSlotBuckets(slot);
        let yearseed   = buckets.yearIdx * 100 + 1;
        let segSeed    = buckets.yearIdx * 10 + buckets.segIdx + 200;
        let stageSeed  = buckets.stageKey;

        let yearAngle  = (seededRandom(yearseed)  - 0.5) * 2 * 15;
        let segAngle   = (seededRandom(segSeed)   - 0.5) * 2 * 30;
        let stageAngle = (seededRandom(stageSeed) - 0.5) * 2 * 60;

        let angleRad = ((yearAngle + segAngle + stageAngle) * Math.PI) / 180;
        let stepDx = Math.sin(angleRad);
        let stepDy = Math.cos(angleRad);
        let stepLen = baseStep * (0.8 + seededRandom(i + 1) * 0.4);

        cursorX += stepDx * stepLen;
        cursorY += stepDy * stepLen;

        if (buckets.yearIdx !== prevYearIdx && prevYearIdx !== -1) {
            cursorY += baseStep * 3;
        }
        prevYearIdx = buckets.yearIdx;

        let perpDx = -stepDy;
        let perpDy = stepDx;
        let jitter = (seededRandom(i + 5000) - 0.5) * 0.04;

        poses.push({
            x: cursorX + perpDx * jitter,
            y: cursorY + perpDy * jitter
        });
    }

    return poses;
}

function generateExtension(anchorPose, awayDir) {
    let pts = [];
    let stepY = 0.5 / 5;
    for (let i = 1; i <= 5; i++) {
        let wanderX = (seededRandom(i + 7000 + awayDir) - 0.5) * 0.06;
        let wanderY = (seededRandom(i + 7500 + awayDir) - 0.5) * 0.04;
        pts.push({
            x: anchorPose.x + wanderX,
            y: anchorPose.y + awayDir * (stepY * i + wanderY)
        });
    }
    return pts;
}

let slotPosesNorm = generateSlotPoses();
let extensionStartNorm = generateExtension(slotPosesNorm[0], -1).reverse();
let extensionEndNorm = generateExtension(slotPosesNorm[slotPosesNorm.length - 1], 1);

// 把归一化坐标乘以各自的 SCALE，变成绝对像素坐标
let slots = [];
for (let i = 0; i < slotPosesNorm.length; i++) {
    slots.push({
        index: i + 1,
        x: slotPosesNorm[i].x * WORLD_SCALE_X,
        y: slotPosesNorm[i].y * WORLD_SCALE_Y,
        memos: []
    });
}

let extensionStart = extensionStartNorm.map(p => ({
    x: p.x * WORLD_SCALE_X,
    y: p.y * WORLD_SCALE_Y
}));
let extensionEnd = extensionEndNorm.map(p => ({
    x: p.x * WORLD_SCALE_X,
    y: p.y * WORLD_SCALE_Y
}));

// 算 bounds
let allPts = [
    ...slots.map(s => ({ x: s.x, y: s.y })),
    ...extensionStart,
    ...extensionEnd
];
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (let p of allPts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
}

let mapData = {
    worldScaleX: WORLD_SCALE_X,
    worldScaleY: WORLD_SCALE_Y,
    bounds: { minX, maxX, minY, maxY },
    slots: slots,
    extensionStart: extensionStart,
    extensionEnd: extensionEnd
};

fs.writeFileSync(
    path.join(__dirname, "public", "mapData.json"),
    JSON.stringify(mapData, null, 2),
    "utf8"
);

console.log("mapData.json generated:",
    slots.length, "slots,",
    extensionStart.length, "+", extensionEnd.length, "extension points,",
    "bounds:", mapData.bounds);