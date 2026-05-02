function preload() {
    loadJSON("mapData.json", function (data) {
        applyMapData(data);
    });
}

let previewCanvas;
let previewBounds;

let currentSlot = 1;
let targetSlot = 1;

function setup() {
    let container = document.querySelector("#preview-canvas-container");
    previewCanvas = createCanvas(container.offsetWidth, container.offsetHeight);
    previewCanvas.parent("preview-canvas-container");
    
    previewBounds = {
        minX: worldBounds.minX,
        maxX: worldBounds.maxX,
        minY: worldBounds.minY,
        maxY: worldBounds.maxY
    };

    targetSlot = getDesiredSlot();
    currentSlot = targetSlot;
}

function mapToPreview(p) {
    let { minX, maxX, minY, maxY } = previewBounds;
    let pathW = maxX - minX;
    let pathH = maxY - minY;

    let pad = 10;
    let availW = width - pad * 2;
    let availH = height - pad * 2;
    let scale = Math.min(availW / pathW, availH / pathH);

    let drawnW = pathW * scale;
    let drawnH = pathH * scale;
    let offsetX = pad + (availW - drawnW) / 2;
    let offsetY = pad + (availH - drawnH) / 2;

    return {
        x: offsetX + (p.x - minX) * scale,
        y: offsetY + (p.y - minY) * scale
    };
}

function getDesiredSlot() {
    let yearVal = document.querySelector("#yearSelect").value;
    let semVal = document.querySelector("#semesterSelect").value;

    if (yearVal === "") return 1;
    let year = parseInt(yearVal);

    if (semVal === "") return year * 254 + 1;
    let sem = parseInt(semVal);
    return computeSlot(year, sem);
}

function getInterpolatedPos(floatSlot) {
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

function draw() {
    clear();

    // path
    noFill();
    stroke(180, 220, 255);
    for (let i = 0; i < slotPoses.length - 1; i++) {
        let info = getSlotInfo(i + 1);
        strokeWeight(info.stageWeight * 0.4);

        let a = mapToPreview(slotPoses[i]);
        let b = mapToPreview(slotPoses[i + 1]);
        line(a.x, a.y, b.x, b.y);
    }

    // lerp toward target
    currentSlot = lerp(currentSlot, targetSlot, 0.1);
    if (Math.abs(targetSlot - currentSlot) < 0.5) {
        currentSlot = targetSlot;
        noLoop();
    }

    // dot
    let pos = getInterpolatedPos(currentSlot);
    let px = mapToPreview(pos);
    noStroke();
    fill(255, 140, 0);
    circle(px.x, px.y, 5);
}

function refreshPreview() {
    targetSlot = getDesiredSlot();
    loop();
}

function windowResized() {
    let container = document.querySelector("#preview-canvas-container");
    resizeCanvas(container.offsetWidth, container.offsetHeight);
    redraw();
}