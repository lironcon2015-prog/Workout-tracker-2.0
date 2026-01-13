// ==================== State Management ====================
let state = {
week: 1, type: ‘’, rm: 100, exIdx: 0, setIdx: 0,
log: [], currentEx: null, currentExName: ‘’,
historyStack: [‘ui-week’],
timerInterval: null, seconds: 0, startTime: null,
isArmPhase: false, isFreestyle: false, currentMuscle: ‘’,
completedExInSession: [],
workoutStartTime: null, workoutDurationMins: 0,
lastLoggedSet: null
};

let audioContext;
let wakeLock = null;

const unilateralExercises = [“Dumbbell Peck Fly”, “Lateral Raises”, “Single Leg Curl”, “Dumbbell Bicep Curls”, “Cable Fly”];

// ==================== Database ====================
const exerciseDatabase = [
{ name: “Overhead Press (Main)”, muscles: [“כתפיים”], isCalc: true, baseRM: 77.5, rmRange: [65, 90], manualRange: {base: 50, min: 40, max: 80, step: 2.5} },
{ name: “Lateral Raises”, muscles: [“כתפיים”], sets: [{w: 12.5, r: 13}, {w: 12.5, r: 13}, {w: 12.5, r: 11}], step: 0.5 },
{ name: “Face Pulls”, muscles: [“כתפיים”], sets: [{w: 40, r: 13}, {w: 40, r: 13}, {w: 40, r: 15}], step: 2.5 },
{ name: “Barbell Shrugs”, muscles: [“כתפיים”], sets: [{w: 140, r: 11}, {w: 140, r: 11}, {w: 140, r: 11}], step: 5 },
{ name: “Bench Press (Main)”, muscles: [“חזה”], isCalc: true, baseRM: 122.5, rmRange: [110, 160], manualRange: {base: 85, min: 60, max: 140, step: 2.5} },
{ name: “Incline Bench Press”, muscles: [“חזה”], sets: [{w: 65, r: 9}, {w: 65, r: 9}, {w: 65, r: 9}], step: 2.5 },
{ name: “Dumbbell Peck Fly”, muscles: [“חזה”], sets: [{w: 14, r: 11}, {w: 14, r: 11}, {w: 14, r: 11}], step: 2 },
{ name: “Machine Peck Fly”, muscles: [“חזה”], sets: [{w: 45, r: 11}, {w: 45, r: 11}, {w: 45, r: 11}], step: 1 },
{ name: “Cable Fly”, muscles: [“חזה”], sets: [{w: 12.5, r: 11}, {w: 12.5, r: 11}, {w: 12.5, r: 11}], step: 2.5 },
{ name: “Leg Press”, muscles: [“רגליים”], sets: [{w: 280, r: 8}, {w: 300, r: 8}, {w: 300, r: 7}], step: 5 },
{ name: “Squat”, muscles: [“רגליים”], sets: [{w: 100, r: 8}, {w: 100, r: 8}, {w: 100, r: 8}], step: 2.5, minW: 60, maxW: 180 },
{ name: “Deadlift”, muscles: [“רגליים”], sets: [{w: 100, r: 5}, {w: 100, r: 5}, {w: 100, r: 5}], step: 2.5, minW: 60, maxW: 180 },
{ name: “Romanian Deadlift”, muscles: [“רגליים”], sets: [{w: 100, r: 8}, {w: 100, r: 8}, {w: 100, r: 8}], step: 2.5, minW: 60, maxW: 180 },
{ name: “Single Leg Curl”, muscles: [“רגליים”], sets: [{w: 25, r: 8}, {w: 30, r: 6}, {w: 25, r: 8}], step: 2.5 },
{ name: “Lying Leg Curl (Double)”, muscles: [“רגליים”], sets: [{w: 50, r: 8}, {w: 60, r: 6}, {w: 50, r: 8}], step: 5 },
{ name: “Seated Calf Raise”, muscles: [“רגליים”], sets: [{w: 70, r: 10}, {w: 70, r: 10}, {w: 70, r: 12}], step: 5 },
{ name: “Standing Calf Raise”, muscles: [“רגליים”], sets: [{w: 110, r: 10}, {w: 110, r: 10}, {w: 110, r: 12}], step: 10 },
{ name: “Lat Pulldown”, muscles: [“גב”], sets: [{w: 75, r: 10}, {w: 75, r: 10}, {w: 75, r: 11}], step: 2.5 },
{ name: “Pull Ups”, muscles: [“גב”], isBW: true, sets: [{w: 0, r: 8}, {w: 0, r: 8}, {w: 0, r: 8}] },
{ name: “Cable Row”, muscles: [“גב”], sets: [{w: 65, r: 10}, {w: 65, r: 10}, {w: 65, r: 12}], step: 2.5 },
{ name: “Machine Row”, muscles: [“גב”], sets: [{w: 50, r: 10}, {w: 50, r: 10}, {w: 50, r: 12}], step: 5 },
{ name: “Straight Arm Pulldown”, muscles: [“גב”], sets: [{w: 30, r: 10}, {w: 30, r: 12}, {w: 30, r: 12}], step: 2.5 },
{ name: “Back Extension”, muscles: [“גב”], sets: [{w: 0, r: 12}, {w: 0, r: 12}, {w: 0, r: 12}], step: 5, minW: 0, maxW: 50, isBW: true }
];

const armExercises = {
biceps: [
{ name: “Dumbbell Bicep Curls”, sets: [{w: 12, r: 8}], step: 0.5, minW: 8, maxW: 25 },
{ name: “Barbell Bicep Curls”, sets: [{w: 25, r: 8}], step: 1, minW: 15, maxW: 40 },
{ name: “Reverse Bicep Curls”, sets: [{w: 15, r: 8}], step: 1, minW: 10, maxW: 25 }
],
triceps: [
{ name: “Triceps Pushdown”, sets: [{w: 35, r: 8}], step: 2.5, minW: 25, maxW: 50 },
{ name: “Lying Triceps Extension (French Press)”, sets: [{w: 35, r: 8}], step: 2.5, minW: 25, maxW: 50 }
]
};

const workouts = {
‘A’: [“Overhead Press (Main)”, “Barbell Shrugs”, “Lateral Raises”, “Face Pulls”, “Incline Bench Press”],
‘B’: [“Leg Press”, “Single Leg Curl”, “Lat Pulldown”, “Cable Row”, “Seated Calf Raise”, “Straight Arm Pulldown”],
‘C’: [“Bench Press (Main)”, “Incline Bench Press”, “Dumbbell Peck Fly”, “Lateral Raises”, “Face Pulls”]
};

const workoutDisplayNames = { ‘A’: ‘כתפיים’, ‘B’: ‘רגליים וגב’, ‘C’: ‘חזה’, ‘Freestyle’: ‘פריסטייל’ };

// ==================== Audio Functions ====================
function playBeep(times = 1) {
if (!audioContext) { const AudioCtx = window.AudioContext || window.webkitAudioContext; audioContext = new AudioCtx(); }
if (audioContext.state === ‘suspended’) audioContext.resume();
for (let i = 0; i < times; i++) {
setTimeout(() => {
const o = audioContext.createOscillator(); const g = audioContext.createGain();
o.type = ‘sine’; o.frequency.setValueAtTime(880, audioContext.currentTime);
g.gain.setValueAtTime(0.3, audioContext.currentTime);
g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
o.connect(g); g.connect(audioContext.destination);
o.start(); o.stop(audioContext.currentTime + 0.4);
}, i * 500);
}
}

async function initAudio() {
playBeep(1);
document.getElementById(‘audio-init-btn’).innerHTML = ‘<span>✓ מצב אימון פעיל</span>’;
document.getElementById(‘audio-init-btn’).style.background = ‘linear-gradient(135deg, #11998e 0%, #38ef7d 100%)’;
try { if (‘wakeLock’ in navigator) wakeLock = await navigator.wakeLock.request(‘screen’); } catch (err) {}
}

// ==================== Timer ====================
function resetAndStartTimer() {
stopRestTimer();
state.seconds = 0;
const target = (state.exIdx === 0 && !state.isArmPhase && !state.isFreestyle) ? 120 : 90;
state.startTime = Date.now();
document.getElementById(‘rest-timer’).innerText = “00:00”;
const bar = document.getElementById(‘timer-bar’);
if(bar) bar.style.width = “0%”;
state.timerInterval = setInterval(() => {
state.seconds = Math.floor((Date.now() - state.startTime) / 1000);
const m = Math.floor(state.seconds / 60).toString().padStart(2, ‘0’);
const s = (state.seconds % 60).toString().padStart(2, ‘0’);
document.getElementById(‘rest-timer’).innerText = `${m}:${s}`;
const progress = Math.min((state.seconds / target) * 100, 100);
if(bar) bar.style.width = progress + “%”;
if (state.seconds === target) playBeep(2);
}, 1000);
}

function stopRestTimer() {
if (state.timerInterval) clearInterval(state.timerInterval);
state.timerInterval = null;
}

// ==================== Navigation ====================
function navigate(id) {
document.querySelectorAll(’.screen’).forEach(s => s.classList.remove(‘active’));
document.getElementById(id).classList.add(‘active’);
if (id !== ‘ui-main’) stopRestTimer();
if (state.historyStack[state.historyStack.length - 1] !== id) state.historyStack.push(id);
document.getElementById(‘global-back’).style.visibility = (id === ‘ui-week’) ? ‘hidden’ : ‘visible’;
}

function handleBackClick() {
if (state.historyStack.length <= 1) return;
const currentScreen = state.historyStack.pop();
if (currentScreen === ‘ui-main’ && state.setIdx > 0) {
state.log.pop();
state.setIdx–;
initPickers();
state.historyStack.push(‘ui-main’);
if(state.setIdx > 0) resetAndStartTimer();
return;
}
const prevScreen = state.historyStack.pop();
navigate(prevScreen);
if(prevScreen === ‘ui-main’ && state.setIdx > 0) resetAndStartTimer();
}

// ==================== Week & Workout Selection ====================
function selectWeek(w) { state.week = w; navigate(‘ui-workout-type’); }

function selectWorkout(t) {
state.type = t; state.exIdx = 0; state.log = [];
state.completedExInSession = []; state.isArmPhase = false; state.isFreestyle = false;
state.workoutStartTime = Date.now();
showConfirmScreen();
}

function startFreestyle() {
state.type = ‘Freestyle’; state.log = [];
state.completedExInSession = []; state.isArmPhase = false; state.isFreestyle = true;
state.workoutStartTime = Date.now();
navigate(‘ui-muscle-select’);
}

// ==================== Exercise Selection ====================
function showExerciseList(muscle) {
state.currentMuscle = muscle;
const options = document.getElementById(‘variation-options’);
options.innerHTML = “”;
document.getElementById(‘variation-title’).innerText = `תרגילי ${muscle}`;

```
const filtered = exerciseDatabase.filter(ex => 
    ex.muscles.includes(muscle) && !state.completedExInSession.includes(ex.name)
);

filtered.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = "exercise-item";
    btn.innerHTML = `<span>${ex.name}</span><span class="arrow">→</span>`;
    btn.onclick = () => {
        const dbRef = exerciseDatabase.find(d => d.name === ex.name);
        state.currentEx = JSON.parse(JSON.stringify(dbRef));
        state.currentExName = ex.name;
        
        if (state.currentEx.isCalc && state.isFreestyle) {
            state.currentEx.sets = Array(3).fill({w: state.currentEx.manualRange.base, r: 8});
            state.currentEx.step = state.currentEx.manualRange.step;
            state.currentEx.minW = state.currentEx.manualRange.min;
            state.currentEx.maxW = state.currentEx.manualRange.max;
            startRecording();
        } else {
            startRecording();
        }
    };
    options.appendChild(btn);
});
navigate('ui-variation');
```

}

function showConfirmScreen() {
const exName = workouts[state.type][state.exIdx];
const exData = exerciseDatabase.find(e => e.name === exName);
document.getElementById(‘confirm-ex-name’).innerText = exData.name;
navigate(‘ui-confirm’);
}

function confirmExercise(doEx) {
const exName = workouts[state.type][state.exIdx];
const exData = exerciseDatabase.find(e => e.name === exName);
if (!doEx) { state.log.push({ skip: true, exName: exData.name }); state.exIdx++; checkFlow(); return; }

```
state.currentEx = JSON.parse(JSON.stringify(exData));
state.currentExName = exData.name;

if (state.currentEx.isCalc) {
    setupCalculatedEx();
} else {
    startRecording();
}
```

}

// ==================== 1RM Setup ====================
function setupCalculatedEx() {
document.getElementById(‘rm-title’).innerText = `${state.currentEx.name.split(' ')[0]} 1RM`;
const p = document.getElementById(‘rm-picker’); p.innerHTML = “”;
for(let i = state.currentEx.rmRange[0]; i <= state.currentEx.rmRange[1]; i += 2.5) {
let o = new Option(i + “ kg”, i); if(i === state.currentEx.baseRM) o.selected = true; p.add(o);
}
navigate(‘ui-1rm’);
}

function save1RM() {
state.rm = parseFloat(document.getElementById(‘rm-picker’).value);
const p = { 1: [0.65, 0.75, 0.85, 0.75, 0.65], 2: [0.70, 0.80, 0.90, 0.80, 0.70, 0.70], 3: [0.75, 0.85, 0.95, 0.85, 0.75, 0.75] };
const reps = state.week === 1 ? [5, 5, 5, 8, 10] : (state.week === 2 ? [3, 3, 3, 8, 10, 10] : [5, 3, 1, 8, 10, 10]);
state.currentEx.sets = p[state.week].map((pct, i) => ({ w: Math.round((state.rm * pct) / 2.5) * 2.5, r: reps[i] || 10 }));
startRecording();
}

// ==================== Recording Sets ====================
function startRecording() {
state.setIdx = 0; state.lastLoggedSet = null;
stopRestTimer(); navigate(‘ui-main’); initPickers();
}

function initPickers() {
const target = state.currentEx.sets[state.setIdx];
document.getElementById(‘ex-display-name’).innerText = state.currentExName;
document.getElementById(‘set-counter’).innerText = `SET ${state.setIdx + 1}/${state.currentEx.sets.length}`;

```
const histDiv = document.getElementById('last-set-info');
if (state.lastLoggedSet) {
    histDiv.innerText = `סט קודם: ${state.lastLoggedSet.w}kg x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
    histDiv.style.display = 'block';
} else { histDiv.style.display = 'none'; }

const timerArea = document.getElementById('timer-area');
if (state.setIdx > 0) { timerArea.style.visibility = 'visible'; resetAndStartTimer(); } 
else { timerArea.style.visibility = 'hidden'; stopRestTimer(); }

const isUni = unilateralExercises.some(u => state.currentExName.includes(u));
document.getElementById('unilateral-note').style.display = isUni ? 'flex' : 'none';

const wPick = document.getElementById('weight-picker'); wPick.innerHTML = "";
const step = state.currentEx.step || 2.5;
const currentW = target ? target.w : (state.lastLoggedSet ? state.lastLoggedSet.w : 0);
const minW = state.currentEx.minW !== undefined ? state.currentEx.minW : Math.max(0, currentW - 40);
const maxW = state.currentEx.maxW !== undefined ? state.currentEx.maxW : currentW + 40;
for(let i = minW; i <= maxW; i = parseFloat((i + step).toFixed(2))) {
    let o = new Option(i + " kg", i); if(i === currentW) o.selected = true; wPick.add(o);
}
const rPick = document.getElementById('reps-picker'); rPick.innerHTML = "";
const currentR = target ? target.r : (state.lastLoggedSet ? state.lastLoggedSet.r : 8);
for(let i = 1; i <= 25; i++) { let o = new Option(i, i); if(i === currentR) o.selected = true; rPick.add(o); }
const rirPick = document.getElementById('rir-picker'); rirPick.innerHTML = "";
[0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].forEach(v => {
    let o = new Option(v === 0 ? "0 (Fail)" : v, v); if(v === 2) o.selected = true; rirPick.add(o);
});
```

}

function nextStep() {
const isUni = unilateralExercises.some(u => state.currentExName.includes(u));
const entry = {
exName: state.currentExName + (isUni ? “ (חד צדדי)” : “”),
w: parseFloat(document.getElementById(‘weight-picker’).value),
r: parseInt(document.getElementById(‘reps-picker’).value),
rir: document.getElementById(‘rir-picker’).value
};
state.log.push(entry);
state.lastLoggedSet = entry;
if (state.setIdx < state.currentEx.sets.length - 1) { state.setIdx++; initPickers(); }
else { navigate(‘ui-extra’); }
}

function handleExtra(isBonus) {
if(isBonus) {
state.setIdx++;
state.currentEx.sets.push({…state.currentEx.sets[state.setIdx-1]});
initPickers(); navigate(‘ui-main’);
} else {
state.completedExInSession.push(state.currentExName);
if (state.isArmPhase) showArmSelection();
else if (state.isFreestyle) showExerciseList(state.currentMuscle);
else { state.exIdx++; checkFlow(); }
}
}

function checkFlow() {
if (state.exIdx < workouts[state.type].length) showConfirmScreen();
else navigate(‘ui-ask-arms’);
}

// ==================== Arms Workout ====================
function startArmWorkout() { state.isArmPhase = true; state.armGroup = ‘biceps’; showArmSelection(); }

function showArmSelection() {
const list = armExercises[state.armGroup];
const remaining = list.filter(ex => !state.completedExInSession.includes(ex.name));

```
if (remaining.length === 0) {
    if (state.armGroup === 'biceps') { state.armGroup = 'triceps'; showArmSelection(); }
    else finish(); return;
}
document.getElementById('arm-selection-title').innerText = state.armGroup === 'biceps' ? "בחר בייספס" : "בחר טרייספס";
const opts = document.getElementById('arm-options'); opts.innerHTML = "";
remaining.forEach(ex => {
    const btn = document.createElement('button'); btn.className = "exercise-item"; 
    btn.innerHTML = `<span>${ex.name}</span><span class="arrow">→</span>`;
    btn.onclick = () => { 
        state.currentEx = JSON.parse(JSON.stringify(ex)); state.currentExName = ex.name;
        state.currentEx.sets = [ex.sets[0], ex.sets[0], ex.sets[0]]; startRecording();
    };
    opts.appendChild(btn);
});
const skipBtn = document.getElementById('btn-skip-arm-group');
skipBtn.innerText = state.armGroup === 'biceps' ? "⏭ דלג לטרייספס" : "🏁 סיים אימון";
skipBtn.onclick = () => { if (state.armGroup === 'biceps') { state.armGroup = 'triceps'; showArmSelection(); } else finish(); };
navigate('ui-arm-selection');
```

}

// ==================== Summary ====================
function finish() {
state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
navigate(‘ui-summary’);
let summaryText = `סיכום אימון ${workoutDisplayNames[state.type] || ''}\nשבוע ${state.week} | משך: ${state.workoutDurationMins} דקות\n\n`;
let grouped = {};
state.log.forEach(e => {
if(!grouped[e.exName]) grouped[e.exName] = { sets: [], vol: 0, skipped: e.skip };
if(!e.skip) {
grouped[e.exName].sets.push(`${e.w}kg x ${e.r} (RIR ${e.rir})`);
grouped[e.exName].vol += (e.w * e.r);
}
});
for (let ex in grouped) {
summaryText += `${ex}:\n${grouped[ex].skipped ? 'לא בוצע\n' : grouped[ex].sets.join('\n') + `\nנפח: ${grouped[ex].vol}kg\n`}\n`;
}
document.getElementById(‘summary-area’).innerText = summaryText.trim();
}

function copyResult() {
const text = document.getElementById(‘summary-area’).innerText;
const el = document.createElement(“textarea”); el.value = text; document.body.appendChild(el); el.select();
try { document.execCommand(‘copy’); alert(“הסיכום הועתק”); } catch (e) {}
document.body.removeChild(el); location.reload();
}

window.addEventListener(‘beforeunload’, (e) => {
if (state.log.length > 0 && !document.getElementById(‘ui-summary’).classList.contains(‘active’)) {
e.preventDefault(); e.returnValue = ‘’;
}
});
