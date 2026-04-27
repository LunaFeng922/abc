const TOTAL_SLOTS = 1000;
const SLOTS_PER_SCREEN = 30;
const Y_SPAN = TOTAL_SLOTS / SLOTS_PER_SCREEN;

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];

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
        stageName = "Break";       stageStart = 1;  stageEnd = 17;  stageWeight = 4;
    } else {
        if (period <= 15)        { stageName = "Start";     stageStart = 1;  stageEnd = 15;  stageWeight = 4.5;  }
        else if (period <= 44)   { stageName = "Start-Mid"; stageStart = 16; stageEnd = 44;  stageWeight = 5;  }
        else if (period <= 64)   { stageName = "Mid";       stageStart = 45; stageEnd = 64;  stageWeight = 5.5;  }
        else if (period <= 85)   { stageName = "Mid-Final"; stageStart = 65; stageEnd = 85;  stageWeight = 5;  }
        else                     { stageName = "Final";     stageStart = 86; stageEnd = 110; stageWeight = 6; }
    }

    let yearOffset = yearIdx * 254;
    let segOffset;
    if (segIdx === 0) segOffset = 0;
    else if (segIdx === 1) segOffset = 110;
    else if (segIdx === 2) segOffset = 127;
    else segOffset = 237;

    return {
        graduated: false,
        yearName: YEARS[yearIdx],
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
    let baseStep = Y_SPAN / TOTAL_SLOTS;

    let cursorX = 0.5;
    let cursorY = 0.1;

    let prevYearIdx = -1;

    // how much each layer can twist the direction (in degrees, ±range)
    let YEAR_ANGLE_RANGE  = 15;
    let SEG_ANGLE_RANGE   = 30;
    let STAGE_ANGLE_RANGE = 60;

    for (let i = 0; i < TOTAL_SLOTS; i++) {
        let slot = i + 1;
        let info = getSlotInfo(slot);

        if (info.graduated) {
            cursorY += baseStep * 5;
            poses.push({ x: cursorX, y: cursorY });
            continue;
        }

        let buckets = getSlotBuckets(slot);

        // each layer contributes a direction twist
        let yearSeed   = buckets.yearIdx * 100 + 1;
        let segSeed    = buckets.yearIdx * 10 + buckets.segIdx + 200;
        let stageSeed  = buckets.stageKey;

        let yearAngle  = (seededRandom(yearSeed)  - 0.5) * 2 * YEAR_ANGLE_RANGE;
        let segAngle   = (seededRandom(segSeed)   - 0.5) * 2 * SEG_ANGLE_RANGE;
        let stageAngle = (seededRandom(stageSeed) - 0.5) * 2 * STAGE_ANGLE_RANGE;

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

    poses[TOTAL_SLOTS - 1].y += 2;

    return poses;
}

let slotPoses = generateSlotPoses();