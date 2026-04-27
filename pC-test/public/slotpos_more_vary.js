function getSlotBuckets(slot) {
    let idx = slot - 1;
    let yearIdx = Math.floor(idx / 254);
    let within = idx % 254;

    let segIdx;
    if (within < 110) {
        segIdx = 0;
    } else if (within < 127) {
        segIdx = 1;
    } else if (within < 237) {
        segIdx = 2;
    } else {
        segIdx = 3;
    }

    let info = getSlotInfo(slot);
    let stageKey = info.stageSlotStart;   // unique per stage instance

    return { yearIdx, segIdx, stageKey };
}

// Layered x offset: year moves the slot a lot, segment less, stage even less,
// jitter is the smallest wiggle.
function computeX(slot, i) {
    let info = getSlotInfo(slot);
    if (info.graduated) {
        return 0.5;
    }

    let buckets = getSlotBuckets(slot);
    let yearSeed  = buckets.yearIdx * 100 + 1;
    let segSeed   = buckets.yearIdx * 10 + buckets.segIdx + 200;
    let stageSeed = buckets.stageKey;

    let yearOff  = (seededRandom(yearSeed)  - 0.5) * 0.6;   // ±0.30
    let segOff   = (seededRandom(segSeed)   - 0.5) * 0.5;   // ±0.25
    let stageOff = (seededRandom(stageSeed) - 0.5) * 0.3;   // ±0.15
    let jitter   = (seededRandom(i + 5000)  - 0.5) * 0.1;   // ±0.05

    return 0.5 + yearOff + segOff + stageOff + jitter;
}

// Extra y gap when we cross a year / segment / stage boundary from slot-1 to slot.
function boundaryBump(slot, baseStep) {
    if (slot <= 1) return 0;

    let prevInfo = getSlotInfo(slot - 1);
    let currInfo = getSlotInfo(slot);
    if (prevInfo.graduated || currInfo.graduated) return 0;

    let prev = getSlotBuckets(slot - 1);
    let curr = getSlotBuckets(slot);

    if (prev.yearIdx !== curr.yearIdx) {
        return baseStep * 3;      // new year: big gap
    }
    if (prev.segIdx !== curr.segIdx) {
        return baseStep * 1.5;    // new sem/break
    }
    if (prev.stageKey !== curr.stageKey) {
        return baseStep * 0.6;    // new stage
    }
    return 0;
}

function generateSlotPoses() {
    let poses = [];
    let baseStep = ySpan / totalSlots;
    let y = 0.1;

    for (let i = 0; i < totalSlots; i++) {
        let slot = i + 1;

        // advance y: base step + per-slot jitter + boundary bump
        let jitterY = seededRandom(i + 1) * baseStep * 1.6;
        y += baseStep * 0.2 + jitterY + boundaryBump(slot, baseStep);

        let x = computeX(slot, i);
        poses.push({ x: x, y: y });
    }
    return poses;
}