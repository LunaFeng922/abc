const totalSlots = 1000;

const years = ["Freshman", "Sophomore", "Junior", "Senior"];

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function getSlotInfo(slot) {
    if (slot === 1000) {
        return { graduated: true };
    }

    let idx = slot - 1;
    let yearIdx = Math.floor(idx / 254);
    let within = idx % 254;

    let segIdx;
    let period;
    let isBreak;

    if (within < 110) {
        segIdx = 0;
        period = within + 1;
        isBreak = false;
    } else if (within < 127) {
        segIdx = 1;
        period = within - 110 + 1;
        isBreak = true;
    } else if (within < 237) {
        segIdx = 2;
        period = within - 127 + 1;
        isBreak = false;
    } else {
        segIdx = 3;
        period = within - 237 + 1;
        isBreak = true;
    }

    let semLabel;
    if (segIdx === 0 || segIdx === 1) {
        semLabel = "1/2";
    } else {
        semLabel = "2/2";
    }

let stageName;
    let stageStart, stageEnd;
    let stageWeight;
    if (isBreak) {
        stageName = "Break";       stageStart = 1;  stageEnd = 17;  stageWeight = 2;
    } else {
        if (period <= 15)        { stageName = "Start";     stageStart = 1;  stageEnd = 15;  stageWeight = 2.5;  }
        else if (period <= 44)   { stageName = "Start-Mid"; stageStart = 16; stageEnd = 44;  stageWeight = 3;  }
        else if (period <= 64)   { stageName = "Mid";       stageStart = 45; stageEnd = 64;  stageWeight = 3.5;  }
        else if (period <= 85)   { stageName = "Mid-Final"; stageStart = 65; stageEnd = 85;  stageWeight = 3;  }
        else                     { stageName = "Final";     stageStart = 86; stageEnd = 110; stageWeight = 4; }
    }

    let yearOffset = yearIdx * 254;
    let segOffset;
    if (segIdx === 0) segOffset = 0;
    else if (segIdx === 1) segOffset = 110;
    else if (segIdx === 2) segOffset = 127;
    else segOffset = 237;

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
    let baseStep = 1/30;

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

        // each layer contributes a direction twist
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

        // year boundary nudge
        if (buckets.yearIdx !== prevYearIdx && prevYearIdx !== -1) {
            cursorY += baseStep * 3;
        }
        prevYearIdx = buckets.yearIdx;

        // perpendicular jitter
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

let slotPoses = generateSlotPoses();

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

let extensionStart = generateExtension(slotPoses[0], -1).reverse();
let extensionEnd = generateExtension(slotPoses[slotPoses.length - 1], 1);