let formeElm = document.querySelector("#nameForm");
let nameInput = document.querySelector("#newName");
let yearSelect = document.querySelector("#yearSelect");
let semesterSelect = document.querySelector("#semesterSelect");

let usernameKEY = "user-name";
let userPosKEY = "user-pos";
let userYearKEY = "user-year";
let userSemesterKEY = "user-semester";

const graduatedSlot = 1000;

// semesterSelect has 4 options; the last one changes based on year
// sem value codes:
//   0 = sem 1/2
//   1 = break 1/2
//   2 = sem 2/2
//   3 = break 2/2 (or "Graduated" if Senior)

function rebuildSemesterOptions() {
    let year = yearSelect.value;
    let prevValue = semesterSelect.value;

    semesterSelect.innerHTML = "";

    let placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.innerText = "where in the year";
    semesterSelect.appendChild(placeholder);

    let options = [
        { val: "0", label: "sem 1/2" },
        { val: "1", label: "break 1/2" },
        { val: "2", label: "sem 2/2" },
    ];
    if (year === "3") {
        options.push({ val: "3", label: "Graduated" });
    } else {
        options.push({ val: "3", label: "break 2/2" });
    }

    for (let opt of options) {
        let el = document.createElement("option");
        el.value = opt.val;
        el.innerText = opt.label;
        semesterSelect.appendChild(el);
    }

    if (prevValue !== "") {
        semesterSelect.value = prevValue;
    }
}

yearSelect.addEventListener("change", function () {
    rebuildSemesterOptions();
    if (typeof refreshPreview === "function") refreshPreview();
});

semesterSelect.addEventListener("change", function () {
    if (typeof refreshPreview === "function") refreshPreview();
});

// Pre-fill from localStorage
let existingName = localStorage.getItem(usernameKEY);
if (existingName) nameInput.value = existingName;

let existingYear = localStorage.getItem(userYearKEY);
if (existingYear !== null) yearSelect.value = existingYear;

rebuildSemesterOptions();

let existingSemester = localStorage.getItem(userSemesterKEY);
if (existingSemester !== null) semesterSelect.value = existingSemester;

if (typeof refreshPreview === "function") refreshPreview();

// Restore on bfcache
window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
        let n = localStorage.getItem(usernameKEY);
        if (n) nameInput.value = n;

        let y = localStorage.getItem(userYearKEY);
        if (y !== null) yearSelect.value = y;

        rebuildSemesterOptions();

        let s = localStorage.getItem(userSemesterKEY);
        if (s !== null) semesterSelect.value = s;

        if (typeof refreshPreview === "function") refreshPreview();
    }
});

// --- date -> period helpers ---
function computeSemPeriod() {
    let now = new Date();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let y = now.getFullYear();
    let today = new Date(y, month - 1, day);

    function daysBetween(d1, d2) {
        let ms = d2.getTime() - d1.getTime();
        return Math.floor(ms / (1000 * 60 * 60 * 24));
    }

    let fallStart = new Date(y, 8, 1);
    let fallEnd = new Date(y, 11, 19);
    if (today >= fallStart && today <= fallEnd) {
        return daysBetween(fallStart, today) + 1;
    }

    let springStart = new Date(y, 0, 20);
    let springEnd = new Date(y, 4, 9);
    if (today >= springStart && today <= springEnd) {
        return daysBetween(springStart, today) + 1;
    }

    return 110;
}

function computeBreakPeriod() {
    let now = new Date();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let y = now.getFullYear();
    let today = new Date(y, month - 1, day);

    function daysBetween(d1, d2) {
        let ms = d2.getTime() - d1.getTime();
        return Math.floor(ms / (1000 * 60 * 60 * 24));
    }

    function scale(dayInBreak, totalDays) {
        let period = Math.ceil((dayInBreak / totalDays) * 17);
        if (period < 1) period = 1;
        if (period > 17) period = 17;
        return period;
    }

    let winterStart, winterEnd;
    if (month === 12) {
        winterStart = new Date(y, 11, 20);
        winterEnd = new Date(y + 1, 0, 19);
    } else {
        winterStart = new Date(y - 1, 11, 20);
        winterEnd = new Date(y, 0, 19);
    }
    if (today >= winterStart && today <= winterEnd) {
        let dayIn = daysBetween(winterStart, today) + 1;
        return scale(dayIn, 31);
    }

    let summerStart = new Date(y, 4, 10);
    let summerEnd = new Date(y, 7, 31);
    if (today >= summerStart && today <= summerEnd) {
        let dayIn = daysBetween(summerStart, today) + 1;
        return scale(dayIn, 114);
    }

    return 9;
}

function computeSlot(year, sem) {
    if (year === 3 && sem === 3) return graduatedSlot;

    let yearOffset = year * 254;
    let segOffset, period;
    if (sem === 0) {
        segOffset = 0;
        period = computeSemPeriod();
    } else if (sem === 1) {
        segOffset = 110;
        period = computeBreakPeriod();
    } else if (sem === 2) {
        segOffset = 127;
        period = computeSemPeriod();
    } else {
        segOffset = 237;
        period = computeBreakPeriod();
    }

    return yearOffset + segOffset + period;
}

formeElm.addEventListener("submit", newNameSubmitted);

function newNameSubmitted(event) {
    event.preventDefault();

    let name = nameInput.value.trim();
    let yearVal = yearSelect.value;
    let semVal = semesterSelect.value;

    if (!name) {
        alert("please enter a name");
        return;
    }
    if (yearVal === "" || semVal === "") {
        alert("please pick year and where you are in the year");
        return;
    }

    let year = parseInt(yearVal);
    let sem = parseInt(semVal);
    let slot = computeSlot(year, sem);

    console.log("name:", name, "year:", year, "sem:", sem, "slot:", slot);

    localStorage.setItem(usernameKEY, name);
    localStorage.setItem(userYearKEY, yearVal);
    localStorage.setItem(userSemesterKEY, semVal);
    localStorage.setItem(userPosKEY, slot);

    goToMain();
}

function goToMain() {
    window.location.href = "main.html";
}