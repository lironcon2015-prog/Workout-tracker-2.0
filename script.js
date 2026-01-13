// ==================== State Management ====================
let state = {
week: 1,
type: ‘’,
rm: 100,
exIdx: 0,
setIdx: 0,
log: [],
currentEx: null,
currentExName: ‘’,
historyStack: [‘ui-week’],
timerInterval: null,
seconds: 0,
startTime: null,
isArmPhase: false,
isFreestyle: false,
currentMuscle: ‘’,
completedExInSession: [],
workoutStartTime: null,
workoutDurationMins: 0,
lastLoggedSet: null,
armGroup: ‘biceps’
};

let audioContext;
let wakeLock = null;

// ==================== Database ====================
const unilateralExercises = [
“Dumbbell Peck Fly”,
“Lateral Raises”,
“Single Leg Curl”,
“Dumbbell Bicep Curls”,
“Cable Fly”
];

const exerciseDatabase = [
// Shoulders
{
name: “Overhead Press (Main)”,
muscles: [“כתפיים”],
isCalc: true,
baseRM: 77.5,
rmRange: [65, 90],
manualRange: {base: 50, min: 40, max: 80, step: 2.5}
},
{
name: “Lateral Raises”,
muscles: [“כתפיים”],
sets: [{w: 12.5, r: 13}, {w: 12.5, r: 13}, {w: 12.5, r: 11}],
step: 0.5
},
{
name: “Face Pulls”,
muscles: [“כתפיים”],
sets: [{w: 40, r: 13}, {w: 40, r: 13}, {w: 40, r: 15}],
step: 2.5
},
{
name: “Barbell Shrugs”,
muscles: [“כתפיים”],
sets: [{w: 140, r: 11}, {w: 140, r: 11}, {w: 140, r: 11}],
step: 5
},

```
// Chest
{ 
    name: "Bench Press (Main)", 
    muscles: ["חזה"], 
    isCalc: true, 
    baseRM: 122.5, 
    rmRange: [110, 160], 
    manualRange: {base: 85, min: 60, max: 140, step: 2.5} 
},
{ 
    name: "Incline Bench Press", 
    muscles: ["חזה"], 
    sets: [{w: 65, r: 9}, {w: 65, r: 9}, {w: 65, r: 9}], 
    step: 2.5 
},
{ 
    name: "Dumbbell Peck Fly", 
    muscles: ["חזה"], 
    sets: [{w: 14, r: 11}, {w: 14, r: 11}, {w: 14, r: 11}], 
    step: 2 
},
{ 
    name: "Machine Peck Fly", 
    muscles: ["חזה"], 
    sets: [{w: 45, r: 11}, {w: 45, r: 11}, {w: 45, r: 11}], 
    step: 1 
},
{ 
    name: "Cable Fly", 
    muscles: ["חזה"], 
    sets: [{w: 12.5, r: 11}, {w: 12.5, r: 11}, {w: 12.5, r: 11}], 
    step: 2.5 
},

// Legs
{ 
    name: "Leg Press", 
    muscles: ["רגליים"], 
    sets: [{w: 280, r: 8}, {w: 300, r: 8}, {w: 300, r: 7}], 
    step: 5 
},
{ 
    name: "Squat", 
    muscles: ["רגליים"], 
    sets: [{w: 100, r: 8}, {w: 100, r: 8}, {w: 100, r: 8}], 
    step: 2.5, 
    minW: 60, 
    maxW: 180 
},
{ 
    name: "Deadlift", 
    muscles: ["רגליים"], 
    sets: [{w: 100, r: 5}, {w: 100, r: 5}, {w: 100, r: 5}], 
    step: 2.5, 
    minW: 60, 
    maxW: 180 
},
{ 
    name: "Romanian Deadlift", 
    muscles: ["רגליים"], 
    sets: [{w: 100, r: 8}, {w: 100, r: 8}, {w: 100, r: 8}], 
    step: 2.5, 
    minW: 60, 
    maxW: 180 
},
{ 
    name: "Single Leg Curl", 
    muscles: ["רגליים"], 
    sets: [{w: 25, r: 8}, {w: 30, r: 6}, {w: 25, r: 8}], 
    step: 2.5 
},
{ 
    name: "Lying Leg Curl (Double)", 
    muscles: ["רגליים"], 
    sets: [{w: 50, r: 8}, {w: 60, r: 6}, {w: 50, r: 8}], 
    step: 5 
},
{ 
    name: "Seated Calf Raise", 
    muscles: ["רגליים"], 
    sets: [{w: 70, r: 10}, {w: 70, r: 10}, {w: 70, r: 12}], 
    step: 5 
},
{ 
    name: "Standing Calf Raise", 
    muscles: ["רגליים"], 
    sets: [{w: 110, r: 10}, {w: 110, r: 10}, {w: 110, r: 12}], 
    step: 10 
},

// Back
{ 
    name: "Lat Pulldown", 
    muscles: ["גב"], 
    sets: [{w: 75, r: 10}, {w: 75, r: 10}, {w: 75, r: 11}], 
    step: 2.5 
},
{ 
    name: "Pull Ups", 
    muscles: ["גב"], 
    isBW: true, 
    sets: [{w: 0, r: 8}, {w: 0, r: 8}, {w: 0, r: 8}] 
},
{ 
    name: "Cable Row", 
    muscles: ["גב"], 
    sets: [{w: 65, r: 10}, {w: 65, r: 10}, {w: 65, r: 12}], 
    step: 2.5 
},
{ 
    name: "Machine Row", 
    muscles: ["גב"], 
    sets: [{w: 50, r: 10}, {w: 50, r: 10}, {w: 50, r: 12}], 
    step: 5 
},
{ 
    name: "Straight Arm Pulldown", 
    muscles: ["גב"], 
    sets: [{w: 30, r: 10}, {w: 30, r: 12}, {w: 30, r: 12}], 
    step: 2.5 
},
{ 
    name: "Back Extension", 
    muscles: ["גב"], 
    sets: [{w: 0, r: 12}, {w: 0, r: 12}, {w: 0, r: 12}], 
    step: 5, 
    minW: 0, 
    maxW: 50, 
    isBW: true 
}
```

];

const armExercises = {
biceps: [
{
name: “Dumbbell Bicep Curls”,
sets: [{w: 12, r: 8}],
step: 0.5,
minW: 8,
maxW: 25
},
{
name: “Barbell Bicep Curls”,
sets: [{w: 25, r: 8}],
step: 1,
minW: 15,
maxW: 40
},
{
name: “Reverse Bicep Curls”,
sets: [{w: 15, r: 8}],
step: 1,
minW: 10,
maxW: 25
}
],
triceps: [
{
name: “Triceps Pushdown”,
sets: [{w: 35, r: 8}],
step: 2.5,
minW: 25,
maxW: 50
},
{
name: “Lying Triceps Extension (French Press)”,
sets: [{w: 35, r: 8}],
step: 2.5,
minW: 25,
maxW: 50
}
]
};

const workouts = {
‘A’: [
“Overhead Press (Main)”,
“Barbell Shrugs”,
“Lateral Raises”,
“Face Pulls”,
“Incline Bench Press”
],
‘B’: [
“Leg Press”,
“Single Leg Curl”,
“Lat Pulldown”,
“Cable Row”,
“Seated Calf Raise”,
“Straight Arm Pulldown”
],
‘C’: [
“Bench Press (Main)”,
“Incline Bench Press”,
“Dumbbell Peck Fly”,
“Lateral Raises”,
“Face Pulls”
]
};

const workoutDisplayNames = {
‘A’: ‘כתפיים’,
‘B’: ‘רגליים וגב’,
‘C’: ‘חזה’,
‘Freestyle’: ‘פריסטייל’
};

// ==================== Audio & Wake Lock ====================
function playBeep(times = 1) {
if (!audioContext) {
const AudioCtx = window.AudioContext || window.webkitAudioContext;
audioContext = new AudioCtx();
}
if (audioContext.state === ‘suspended’) {
audioContext.resume();
}

```
for (let i = 0; i < times; i++) {
    setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.4);
    }, i * 500);
}
```

}

async function initAudio() {
playBeep(1);
const btn = document.getElementById(‘audio-init-btn’);
btn.innerText = ‘✓ מצב אימון פעיל’;
btn.style.background = ‘linear-gradient(135deg, #11998e 0%, #38ef7d 100%)’;
btn.classList.add(‘active’);

```
try {
    if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
    }
} catch (err) {
    console.log('Wake lock error:', err);
}
```

}

// ==================== Timer ====================
function resetAndStartTimer() {
stopRestTimer();
state.seconds = 0;
const target = (state.exIdx === 0 && !state.isArmPhase && !state.isFreestyle) ? 120 : 90;
state.startTime = Date.now();

```
const timerDisplay = document.getElementById('rest-timer');
const timerCircle = document.getElementById('timer-circle');
const circumference = 2 * Math.PI * 90; // r = 90

timerDisplay.innerText = "00:00";
if (timerCircle) {
    timerCircle.style.strokeDasharray = circumference;
    timerCircle.style.strokeDashoffset = circumference;
}

state.timerInterval = setInterval(() => {
    state.seconds = Math.floor((Date.now() - state.startTime) / 1000);
    const minutes = Math.floor(state.seconds / 60).toString().padStart(2, '0');
    const seconds = (state.seconds % 60).toString().padStart(2, '0');
    timerDisplay.innerText = `${minutes}:${seconds}`;
    
    const progress = Math.min(state.seconds / target, 1);
    const offset = circumference - (progress * circumference);
    if (timerCircle) {
        timerCircle.style.strokeDashoffset = offset;
    }
    
    if (state.seconds === target) {
        playBeep(2);
    }
}, 1000);
```

}

function stopRestTimer() {
if (state.timerInterval) {
clearInterval(state.timerInterval);
}
state.timerInterval = null;
}

// ==================== Navigation ====================
function navigate(screenId) {
document.querySelectorAll(’.screen’).forEach(screen => {
screen.classList.remove(‘active’);
});

```
document.getElementById(screenId).classList.add('active');

if (screenId !== 'ui-main') {
    stopRestTimer();
}

if (state.historyStack[state.historyStack.length - 1] !== screenId) {
    state.historyStack.push(screenId);
}

const backBtn = document.getElementById('global-back');
backBtn.style.visibility = (screenId === 'ui-week') ? 'hidden' : 'visible';
```

}

function handleBackClick() {
if (state.historyStack.length <= 1) return;

```
const currentScreen = state.historyStack.pop();

if (currentScreen === 'ui-main' && state.setIdx > 0) {
    state.log.pop();
    state.setIdx--;
    initPickers();
    state.historyStack.push('ui-main');
    if (state.setIdx > 0) {
        resetAndStartTimer();
    }
    return;
}

const prevScreen = state.historyStack.pop();
navigate(prevScreen);

if (prevScreen === 'ui-main' && state.setIdx > 0) {
    resetAndStartTimer();
}
```

}

// ==================== Week Selection ====================
function selectWeek(week) {
state.week = week;
navigate(‘ui-workout-type’);
}

// ==================== Workout Selection ====================
function selectWorkout(type) {
state.type = type;
state.exIdx = 0;
state.log = [];
state.completedExInSession = [];
state.isArmPhase = false;
state.isFreestyle = false;
state.workoutStartTime = Date.now();
showConfirmScreen();
}

function startFreestyle() {
state.type = ‘Freestyle’;
state.log = [];
state.completedExInSession = [];
state.isArmPhase = false;
state.isFreestyle = true;
state.workoutStartTime = Date.now();
navigate(‘ui-muscle-select’);
}

// ==================== Exercise Selection ====================
function showExerciseList(muscle) {
state.currentMuscle = muscle;
const optionsContainer = document.getElementById(‘variation-options’);
optionsContainer.innerHTML = “”;

```
document.getElementById('variation-title').innerText = `תרגילי ${muscle}`;

const filteredExercises = exerciseDatabase.filter(ex =>
    ex.muscles.includes(muscle) && !state.completedExInSession.includes(ex.name)
);

filteredExercises.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = "exercise-item";
    btn.innerHTML = `
        <span>${ex.name}</span>
        <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
    `;
    btn.onclick = () => {
        const dbRef = exerciseDatabase.find(d => d.name === ex.name);
        state.currentEx = JSON.parse(JSON.stringify(dbRef));
        state.currentExName = ex.name;
        
        if (state.currentEx.isCalc && state.isFreestyle) {
            state.currentEx.sets = Array(3).fill({
                w: state.currentEx.manualRange.base,
                r: 8
            });
            state.currentEx.step = state.currentEx.manualRange.step;
            state.currentEx.minW = state.currentEx.manualRange.min;
            state.currentEx.maxW = state.currentEx.manualRange.max;
            startRecording();
        } else {
            startRecording();
        }
    };
    optionsContainer.appendChild(btn);
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

function confirmExercise(doExercise) {
const exName = workouts[state.type][state.exIdx];
const exData = exerciseDatabase.find(e => e.name === exName);

```
if (!doExercise) {
    state.log.push({
        skip: true,
        exName: exData.name
    });
    state.exIdx++;
    checkFlow();
    return;
}

state.currentEx = JSON.parse(JSON.stringify(exData));
state.currentExName = exData.name;

if (state.currentEx.isCalc) {
    setupCalculatedExercise();
} else {
    startRecording();
}
```

}

// ==================== 1RM Calculation ====================
function setupCalculatedExercise() {
document.getElementById(‘rm-title’).innerText = `${state.currentEx.name.split(' ')[0]} 1RM`;

```
const picker = document.getElementById('rm-picker');
picker.innerHTML = "";

for (let i = state.currentEx.rmRange[0]; i <= state.currentEx.rmRange[1]; i += 2.5) {
    const option = new Option(i + " kg", i);
    if (i === state.currentEx.baseRM) {
        option.selected = true;
    }
    picker.add(option);
}

navigate('ui-1rm');
```

}

function save1RM() {
state.rm = parseFloat(document.getElementById(‘rm-picker’).value);

```
const percentages = {
    1: [0.65, 0.75, 0.85, 0.75, 0.65],
    2: [0.70, 0.80, 0.90, 0.80, 0.70, 0.70],
    3: [0.75, 0.85, 0.95, 0.85, 0.75, 0.75]
};

const reps = state.week === 1 ? [5, 5, 5, 8, 10] :
              (state.week === 2 ? [3, 3, 3, 8, 10, 10] : [5, 3, 1, 8, 10, 10]);

state.currentEx.sets = percentages[state.week].map((pct, idx) => ({
    w: Math.round((state.rm * pct) / 2.5) * 2.5,
    r: reps[idx] || 10
}));

startRecording();
```

}

// ==================== Recording Sets ====================
function startRecording() {
state.setIdx = 0;
state.lastLoggedSet = null;
stopRestTimer();
navigate(‘ui-main’);
initPickers();
}

function initPickers() {
const targetSet = state.currentEx.sets[state.setIdx];

```
document.getElementById('ex-display-name').innerText = state.currentExName;
document.getElementById('set-counter').innerText = 
    `SET ${state.setIdx + 1}/${state.currentEx.sets.length}`;

// History display
const histDiv = document.getElementById('last-set-info');
if (state.lastLoggedSet) {
    histDiv.innerText = 
        `סט קודם: ${state.lastLoggedSet.w}kg × ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
    histDiv.style.display = 'block';
} else {
    histDiv.style.display = 'none';
}

// Timer visibility
const timerArea = document.getElementById('timer-area');
if (state.setIdx > 0) {
    timerArea.style.visibility = 'visible';
    resetAndStartTimer();
} else {
    timerArea.style.visibility = 'hidden';
    stopRestTimer();
}

// Unilateral warning
const isUnilateral = unilateralExercises.some(u => state.currentExName.includes(u));
document.getElementById('unilateral-note').style.display = isUnilateral ? 'flex' : 'none';

// Weight picker
const weightPicker = document.getElementById('weight-picker');
weightPicker.innerHTML = "";

const step = state.currentEx.step || 2.5;
const currentW = targetSet ? targetSet.w : (state.lastLoggedSet ? state.lastLoggedSet.w : 0);
const minW = state.currentEx.minW !== undefined ? state.currentEx.minW : Math.max(0, currentW - 40);
const maxW = state.currentEx.maxW !== undefined ? state.currentEx.maxW : currentW + 40;

for (let i = minW; i <= maxW; i = parseFloat((i + step).toFixed(2))) {
    const option = new Option(i + " kg", i);
    if (i === currentW) {
        option.selected = true;
    }
    weightPicker.add(option);
}

// Reps picker
const repsPicker = document.getElementById('reps-picker');
repsPicker.innerHTML = "";

const currentR = targetSet ? targetSet.r : (state.lastLoggedSet ? state.lastLoggedSet.r : 8);
for (let i = 1; i <= 25; i++) {
    const option = new Option(i, i);
    if (i === currentR) {
        option.selected = true;
    }
    repsPicker.add(option);
}

// RIR picker
const rirPicker = document.getElementById('rir-picker');
rirPicker.innerHTML = "";

const rirValues = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
rirValues.forEach(val => {
    const option = new Option(val === 0 ? "0 (Fail)" : val, val);
    if (val === 2) {
        option.selected = true;
    }
    rirPicker.add(option);
});
```

}

function nextStep() {
const isUnilateral = unilateralExercises.some(u => state.currentExName.includes(u));

```
const entry = {
    exName: state.currentExName + (isUnilateral ? " (חד צדדי)" : ""),
    w: parseFloat(document.getElementById('weight-picker').value),
    r: parseInt(document.getElementById('reps-picker').value),
    rir: document.getElementById('rir-picker').value
};

state.log.push(entry);
state.lastLoggedSet = entry;

if (state.setIdx < state.currentEx.sets.length - 1) {
    state.setIdx++;
    initPickers();
} else {
    navigate('ui-extra');
}
```

}

function handleExtra(isBonus) {
if (isBonus) {
state.setIdx++;
state.currentEx.sets.push({…state.currentEx.sets[state.setIdx - 1]});
initPickers();
navigate(‘ui-main’);
} else {
state.completedExInSession.push(state.currentExName);

```
    if (state.isArmPhase) {
        showArmSelection();
    } else if (state.isFreestyle) {
        showExerciseList(state.currentMuscle);
    } else {
        state.exIdx++;
        checkFlow();
    }
}
```

}

function checkFlow() {
if (state.exIdx < workouts[state.type].length) {
showConfirmScreen();
} else {
navigate(‘ui-ask-arms’);
}
}

// ==================== Arms Workout ====================
function startArmWorkout() {
state.isArmPhase = true;
state.armGroup = ‘biceps’;
showArmSelection();
}

function showArmSelection() {
const exerciseList = armExercises[state.armGroup];
const remainingExercises = exerciseList.filter(ex =>
!state.completedExInSession.includes(ex.name)
);

```
if (remainingExercises.length === 0) {
    if (state.armGroup === 'biceps') {
        state.armGroup = 'triceps';
        showArmSelection();
    } else {
        finish();
    }
    return;
}

const title = state.armGroup === 'biceps' ? "בחר בייספס" : "בחר טרייספס";
document.getElementById('arm-selection-title').innerText = title;

const optionsContainer = document.getElementById('arm-options');
optionsContainer.innerHTML = "";

remainingExercises.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = "exercise-item";
    btn.innerHTML = `
        <span>${ex.name}</span>
        <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
    `;
    btn.onclick = () => {
        state.currentEx = JSON.parse(JSON.stringify(ex));
        state.currentExName = ex.name;
        state.currentEx.sets = [ex.sets[0], ex.sets[0], ex.sets[0]];
        startRecording();
    };
    optionsContainer.appendChild(btn);
});

const skipBtn = document.getElementById('btn-skip-arm-group');
skipBtn.className = "btn-secondary";
skipBtn.innerText = state.armGroup === 'biceps' ? "⏭ דלג לטרייספס" : "🏁 סיים אימון";
skipBtn.onclick = () => {
    if (state.armGroup === 'biceps') {
        state.armGroup = 'triceps';
        showArmSelection();
    } else {
        finish();
    }
};

navigate('ui-arm-selection');
```

}

// ==================== Summary ====================
function finish() {
state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
navigate(‘ui-summary’);

```
let summaryText = `סיכום אימון ${workoutDisplayNames[state.type] || ''}\n`;
summaryText += `שבוע ${state.week} | משך: ${state.workoutDurationMins} דקות\n\n`;

const grouped = {};
state.log.forEach(entry => {
    if (!grouped[entry.exName]) {
        grouped[entry.exName] = {
            sets: [],
            volume: 0,
            skipped: entry.skip
        };
    }
    
    if (!entry.skip) {
        grouped[entry.exName].sets.push(`${entry.w}kg × ${entry.r} (RIR ${entry.rir})`);
        grouped[entry.exName].volume += (entry.w * entry.r);
    }
});

for (let exerciseName in grouped) {
    summaryText += `${exerciseName}:\n`;
    if (grouped[exerciseName].skipped) {
        summaryText += 'לא בוצע\n';
    } else {
        summaryText += grouped[exerciseName].sets.join('\n');
        summaryText += `\nנפח: ${grouped[exerciseName].volume}kg\n`;
    }
    summaryText += '\n';
}

document.getElementById('summary-area').innerText = summaryText.trim();
```

}

function copyResult() {
const text = document.getElementById(‘summary-area’).innerText;
const textarea = document.createElement(“textarea”);
textarea.value = text;
document.body.appendChild(textarea);
textarea.select();

```
try {
    document.execCommand('copy');
    alert("הסיכום הועתק ללוח");
} catch (err) {
    console.error('Copy failed:', err);
```
