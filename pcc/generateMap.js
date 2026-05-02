const fs = require('fs');

const totalSlots = 1000;
const years = ["Freshman", "Sophomore", "Junior", "Senior"];

// --- 1. 复刻 seededRandom ---
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// --- 2. 复刻 getSlotInfo (包含所有权重和阶段名称) ---
function getSlotInfo(slot) {
    if (slot === 1000) return { graduated: true };
    let idx = slot - 1;
    let yearIdx = Math.floor(idx / 254);
    let within = idx % 254;

    let segIdx = (within < 110) ? 0 : (within < 127) ? 1 : (within < 237) ? 2 : 3;
    let isBreak = (segIdx === 1 || segIdx === 3);
    let semLabel = (segIdx === 0 || segIdx === 1) ? "1/2" : "2/2";

    let stageName, stageStart, stageEnd, stageWeight;
    let period = (segIdx === 0) ? within + 1 : (segIdx === 1) ? within - 110 + 1 : (segIdx === 2) ? within - 127 + 1 : within - 237 + 1;

    if (isBreak) {
        stageName = "Break"; stageStart = 1; stageEnd = 17; stageWeight = 2;
    } else {
        if (period <= 15) { stageName = "Start"; stageStart = 1; stageEnd = 15; stageWeight = 2.5; }
        else if (period <= 44) { stageName = "Start-Mid"; stageStart = 16; stageEnd = 44; stageWeight = 3; }
        else if (period <= 64) { stageName = "Mid"; stageStart = 45; stageEnd = 64; stageWeight = 3.5; }
        else if (period <= 85) { stageName = "Mid-Final"; stageStart = 65; stageEnd = 85; stageWeight = 3; }
        else { stageName = "Final"; stageStart = 86; stageEnd = 110; stageWeight = 4; }
    }

    let yearOffset = yearIdx * 254;
    let segOffset = [0, 110, 127, 237][segIdx];

    return {
        graduated: false,
        yearName: years[yearIdx],
        semLabel: semLabel,
        stageName: stageName,
        stageWeight: stageWeight,
        stageSlotStart: yearOffset + segOffset + stageStart,
        stageSlotEnd: yearOffset + segOffset + stageEnd
    };
}

// --- 3. 复刻坐标生成核心算法 ---
function generateWorld() {
    let slots = [];
    let baseStep = 1 / 30;
    let cursorX = 0.5;
    let cursorY = 0.1;
    let prevYearIdx = -1;

    for (let i = 0; i < totalSlots; i++) {
        let slot = i + 1;
        let info = getSlotInfo(slot);

        if (info.graduated) {
            cursorY += baseStep * 5;
            slots.push({ id: slot, x: 0.5, y: cursorY, meta: info, memos: [] });
            continue;
        }

        // 计算 Buckets
        let idx = i;
        let yearIdx = Math.floor(idx / 254);
        let within = idx % 254;
        let segIdx = (within < 110) ? 0 : (within < 127) ? 1 : (within < 237) ? 2 : 3;
        let stageKey = info.stageSlotStart;

        // 复刻 Angle 计算
        let yearseed = yearIdx * 100 + 1;
        let segSeed = yearIdx * 10 + segIdx + 200;
        let stageSeed = stageKey;

        let yearAngle = (seededRandom(yearseed) - 0.5) * 2 * 15;
        let segAngle = (seededRandom(segSeed) - 0.5) * 2 * 30;
        let stageAngle = (seededRandom(stageSeed) - 0.5) * 2 * 60;

        let angleRad = ((yearAngle + segAngle + stageAngle) * Math.PI) / 180;
        let stepDx = Math.sin(angleRad);
        let stepDy = Math.cos(angleRad);
        let stepLen = baseStep * (0.8 + seededRandom(i + 1) * 0.4);

        cursorX += stepDx * stepLen;
        cursorY += stepDy * stepLen;

        if (yearIdx !== prevYearIdx && prevYearIdx !== -1) cursorY += baseStep * 3;
        prevYearIdx = yearIdx;

        // 复刻 Perpendicular Jitter (垂直抖动)
        let perpDx = -stepDy;
        let perpDy = stepDx;
        let jitter = (seededRandom(i + 5000) - 0.5) * 0.04;

        slots.push({
            id: slot,
            x: parseFloat((cursorX + perpDx * jitter).toFixed(6)),
            y: parseFloat((cursorY + perpDy * jitter).toFixed(6)),
            meta: info,
            memos: []
        });
    }

    fs.writeFileSync('worldData.json', JSON.stringify({ slots }, null, 2));
    console.log("✅ 完美复刻版 worldData.json 已生成！");
}

generateWorld();