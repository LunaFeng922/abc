let previewCanvas;
let previewBounds;

function setup() {
    let container = document.querySelector("#preview-canvas-container");
    previewCanvas = createCanvas(container.offsetWidth, container.offsetHeight);
    previewCanvas.parent("preview-canvas-container");

    // compute the bounding box of the full path once
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let p of slotPoses) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    previewBounds = { minX, maxX, minY, maxY };

    noLoop();
    redraw();
}

// Map a slot pose to preview canvas pixel coords, preserving aspect ratio.
function mapToPreview(p) {
    let { minX, maxX, minY, maxY } = previewBounds;
    let pathW = maxX - minX;
    let pathH = maxY - minY;

    // fit to canvas with some padding, preserving aspect
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

function draw() {
    clear();

    noFill();
    stroke(180, 220, 255);
    for (let i = 0; i < slotPoses.length - 1; i++) {
        let info = getSlotInfo(i + 1);
       if (info.graduated) {
            baseWeight = 1;
        } else {
            baseWeight = info.stageWeight;
        }
        strokeWeight(baseWeight * 0.3);

        let a = mapToPreview(slotPoses[i]);
        let b = mapToPreview(slotPoses[i + 1]);
        line(a.x, a.y, b.x, b.y);
    }

    // dot at currently selected slot
    let slot = getCurrentSelectedSlot();
    if (slot !== null) {
        let p = slotPoses[slot - 1];
        let px = mapToPreview(p);
        noStroke();
        fill(255, 140, 0);
        circle(px.x, px.y, 10);
    }
}

function getCurrentSelectedSlot() {
    let yearVal = document.querySelector("#yearSelect").value;
    let semVal = document.querySelector("#semesterSelect").value;
    if (yearVal === "" || semVal === "") return null;
    return computeSlot(parseInt(yearVal), parseInt(semVal));
}

function refreshPreview() {
    redraw();
}

function windowResized() {
    let container = document.querySelector("#preview-canvas-container");
    resizeCanvas(container.offsetWidth, container.offsetHeight);
    redraw();
}