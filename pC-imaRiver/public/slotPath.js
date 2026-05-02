const totalSlots = 1000;

const years = ["Freshman", "Sophomore", "Junior", "Senior"];

function getSlotInfo(slot) {
    if (slot === 1000) {
        return {
            graduated: true,
            yearName: "Senior",
            semLabel: "2/2",
            stageName: "Graduated",
            stageWeight: 5,
            stageSlotStart: 975,
            stageSlotEnd: 1000
        };
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

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

let slotPoses = [];
let extensionStart = [];
let extensionEnd = [];
let worldBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

function applyMapData(data) {
    slotPoses = data.slots.map(s => ({ x: s.x, y: s.y }));
    extensionStart = data.extensionStart.map(p => ({ x: p.x, y: p.y }));
    extensionEnd = data.extensionEnd.map(p => ({ x: p.x, y: p.y }));
    if (data.bounds) worldBounds = data.bounds;
}