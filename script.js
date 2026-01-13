/**
 * GYMPRO ELITE V10.5 - Logic & Database
 */

let state = {
    week: 1, type: '', rm: 100, exIdx: 0, setIdx: 0, 
    log: [], currentEx: null, currentExName: '',
    historyStack: ['ui-init'],
    timerInterval: null, seconds: 0, startTime: null,
    isArmPhase: false, isFreestyle: false, currentMuscle: '',
    completedExInSession: [],
    workoutStartTime: null, lastLoggedSet: null 
};

let audioContext;

const unilateralExercises = ["Dumbbell Peck Fly", "Lateral Raises", "Single Leg Curl", "Dumbbell Bicep Curls", "Cable Fly", "Concentration Curls"];

const exerciseDatabase = [
    { name: "Overhead Press (Main)", muscles: ["כתפיים"], isCalc: true, baseRM: 77.5, rmRange: [65, 90], manualRange: {base: 50, min: 40, max: 80, step: 2.5} },
    { name: "Lateral Raises", muscles: ["כתפיים"], sets: [{w: 12.5, r: 13}, {w: 12.5, r: 13}, {w: 12.5, r: 11}], step: 0.5 },
    { name: "Bench Press (Main)", muscles: ["חזה"], isCalc: true, baseRM: 122.5, rmRange: [110, 160], manualRange: {base: 85, min: 60, max: 140, step: 2.5} },
    { name: "Leg Press", muscles: ["רגליים"], sets: [{w: 280, r: 8}, {w: 300, r: 8}, {w: 300, r: 7}], step: 5 },
    { name: "Lat Pulldown", muscles: ["גב"], sets: [{w: 75, r: 10}, {w: 75, r: 10}, {w: 75, r: 11}], step: 2.5 },
    { name: "Machine Row", muscles: ["גב"], sets: [{w: 50, r: 10}, {w: 50, r: 12}], step: 5 }
];

const armExercises = {
    biceps: [{ name: "Dumbbell Bicep Curls", sets: [{w: 12, r: 10}], step: 0.5 }],
    triceps: [{ name: "Triceps Pushdown", sets: [{w: 30, r: 10}], step: 2.5 }]
};

const workouts = {
    'A': ["Overhead Press (Main)", "Lateral Raises"],
    'B': ["Leg Press", "Lat Pulldown"],
    'C': ["Bench Press (Main)", "Machine Row"]
};

// --- CORE ---
function haptic(type = 'light') {
    if (!("vibrate" in navigator)) return;
    const p = { light: 15, medium: 30, success: [40, 50, 40], warning: [20, 20] };
    navigator.vibrate(p[type] || 15);
}

function playBeep() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.connect(g); g.connect(audioContext.destination);
    o.frequency.value = 880; g.gain.value = 0.1;
    o.start(); o.stop(audioContext.currentTime + 0.3);
}

async function initAudio() {
    haptic('medium'); playBeep();
    document.getElementById('audio-init-btn').style.background = "var(--ios-green)";
    document.getElementById('audio-init-btn').innerHTML = "<span>✅ מצב סאונד ורטט פעיל</span>";
    if ('wakeLock' in navigator) await navigator.wakeLock.request('screen');
}

// --- NAVIGATION ---
function navigate(id) {
    haptic('light');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const titles = { 'ui-week': 'שבוע', 'ui-workout-type': 'סוג אימון', 'ui-main': 'אימון פעיל', 'ui-summary': 'סיום' };
    document.getElementById('screen-title').innerText = titles[id] || 'GYMPRO';
    
    if (id !== 'ui-main') stopRestTimer();
    if (state.historyStack[state.historyStack.length - 1] !== id) state.historyStack.push(id);
    document.getElementById('global-back').style.visibility = (id === 'ui-init' || id === 'ui-week') ? 'hidden' : 'visible';
}

function handleBackClick() {
    haptic('warning');
    if (state.historyStack.length <= 1) return;
    const current = state.historyStack.pop();

    if (current === 'ui-extra' || (current === 'ui-main' && state.setIdx > 0)) {
        state.log.pop();
        state.setIdx = Math.max(0, state.setIdx - 1);
        state.lastLoggedSet = state.log[state.log.length - 1] || null;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('ui-main').classList.add('active');
        initPickers();
        return;
    }
    navigate(state.historyStack.pop());
}

// --- TIMER ---
function resetAndStartTimer() {
    stopRestTimer();
    state.seconds = 0;
    state.startTime = Date.now();
    const target = (state.exIdx === 0 && !state.isArmPhase) ? 120 : 90;
    
    const circle = document.getElementById('timer-progress');
    const text = document.getElementById('rest-timer');
    const circ = 502.4;

    text.innerText = "00:00";
    circle.style.strokeDashoffset = circ;

    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        if (elapsed !== state.seconds) {
            state.seconds = elapsed;
            const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const s = (elapsed % 60).toString().padStart(2, '0');
            text.innerText = `${m}:${s}`;
            circle.style.strokeDashoffset = circ - (Math.min(elapsed / target, 1) * circ);
            if (elapsed === target) { playBeep(); haptic('success'); }
        }
    }, 100);
}

function stopRestTimer() { 
    if (state.timerInterval) clearInterval(state.timerInterval); 
    state.timerInterval = null; 
}

// --- WORKOUT FLOW ---
function selectWeek(w) { state.week = w; navigate('ui-workout-type'); }

function selectWorkout(t) { 
    state.type = t; state.exIdx = 0; state.log = []; 
    state.workoutStartTime = Date.now();
    showConfirmScreen();
}

function startFreestyle() {
    state.type = 'Freestyle'; state.isFreestyle = true;
    state.workoutStartTime = Date.now();
    navigate('ui-muscle-select');
}

function showConfirmScreen() {
    const exName = workouts[state.type][state.exIdx];
    document.getElementById('confirm-ex-name').innerText = exName;
    navigate('ui-confirm');
}

function confirmExercise(doEx) {
    if (!doEx) { state.exIdx++; checkFlow(); return; }
    const exName = workouts[state.type][state.exIdx];
    state.currentEx = JSON.parse(JSON.stringify(exerciseDatabase.find(e => e.name === exName)));
    state.currentExName = exName;
    if (state.currentEx.isCalc) setupCalculatedEx(); else startRecording();
}

function setupCalculatedEx() {
    const p = document.getElementById('rm-picker'); p.innerHTML = "";
    for(let i = state.currentEx.rmRange[0]; i <= state.currentEx.rmRange[1]; i += 2.5) {
        let o = new Option(i + " kg", i); if(i === state.currentEx.baseRM) o.selected = true; p.add(o);
    }
    navigate('ui-1rm');
}

function save1RM() {
    state.rm = parseFloat(document.getElementById('rm-picker').value);
    const p = { 1: [0.65, 0.75, 0.85], 2: [0.70, 0.80, 0.90], 3: [0.75, 0.85, 0.95] };
    state.currentEx.sets = p[state.week].map(pct => ({ w: Math.round((state.rm * pct) / 2.5) * 2.5, r: 5 }));
    startRecording();
}

function startRecording() { state.setIdx = 0; state.lastLoggedSet = null; navigate('ui-main'); initPickers(); }

function initPickers() {
    const target = state.currentEx.sets[state.setIdx] || {w: 20, r: 10};
    document.getElementById('ex-display-name').innerText = state.currentExName;
    document.getElementById('set-counter').innerText = `SET ${state.setIdx + 1}/${state.currentEx.sets.length}`;
    document.getElementById('unilateral-note').style.display = unilateralExercises.includes(state.currentExName) ? 'block' : 'none';

    if (state.setIdx > 0) { document.getElementById('timer-area').style.display = 'flex'; resetAndStartTimer(); }
    else { document.getElementById('timer-area').style.display = 'none'; stopRestTimer(); }

    const wPick = document.getElementById('weight-picker'); wPick.innerHTML = "";
    const baseW = target.w;
    for(let i = Math.max(0, baseW - 30); i <= baseW + 40; i += 2.5) {
        let o = new Option(i + "kg", i); if(i === baseW) o.selected = true; wPick.add(o);
    }
    const rPick = document.getElementById('reps-picker'); rPick.innerHTML = "";
    for(let i = 1; i <= 25; i++) {
        let o = new Option(i, i); if(i === target.r) o.selected = true; rPick.add(o);
    }
    const rirPick = document.getElementById('rir-picker'); rirPick.innerHTML = "";
    [0, 1, 2, 3].forEach(v => {
        let o = new Option("RIR " + v, v); if(v === 2) o.selected = true; rirPick.add(o);
    });
}

function nextStep() {
    haptic('light');
    const entry = { exName: state.currentExName, w: document.getElementById('weight-picker').value, r: document.getElementById('reps-picker').value, rir: document.getElementById('rir-picker').value };
    state.log.push(entry); state.lastLoggedSet = entry;
    if (state.setIdx < state.currentEx.sets.length - 1) { state.setIdx++; initPickers(); }
    else navigate('ui-extra');
}

function handleExtra(isBonus) {
    if (isBonus) { state.setIdx++; state.currentEx.sets.push({...state.currentEx.sets[state.setIdx-1]}); initPickers(); navigate('ui-main'); }
    else { state.completedExInSession.push(state.currentExName); if (state.isArmPhase) showArmSelection(); else if (state.isFreestyle) navigate('ui-muscle-select'); else { state.exIdx++; checkFlow(); } }
}

function checkFlow() {
    if (state.exIdx < workouts[state.type].length) showConfirmScreen(); else navigate('ui-ask-arms');
}

function startArmWorkout() { state.isArmPhase = true; state.armGroup = 'biceps'; showArmSelection(); }

function showArmSelection() {
    const list = armExercises[state.armGroup];
    const rem = list.filter(ex => !state.completedExInSession.includes(ex.name));
    if (rem.length === 0) { if (state.armGroup === 'biceps') { state.armGroup = 'triceps'; showArmSelection(); } else finish(); return; }
    document.getElementById('arm-selection-title').innerText = state.armGroup === 'biceps' ? "בחר בייספס" : "בחר טרייספס";
    const opts = document.getElementById('arm-options'); opts.innerHTML = "";
    rem.forEach(ex => {
        const b = document.createElement('div'); b.className = "list-item"; b.innerHTML = `<span>${ex.name}</span><span class="arrow">➔</span>`;
        b.onclick = () => { state.currentEx = JSON.parse(JSON.stringify(ex)); state.currentExName = ex.name; startRecording(); };
        opts.appendChild(b);
    });
    navigate('ui-arm-selection');
}

function finish() {
    navigate('ui-summary');
    let txt = `GYMPRO SUMMARY\n`;
    state.log.forEach(e => txt += `${e.exName}: ${e.w}kg x ${e.r} (RIR ${e.rir})\n`);
    document.getElementById('summary-area').innerText = txt;
}

function copyResult() {
    navigator.clipboard.writeText(document.getElementById('summary-area').innerText);
    alert("הועתק!"); location.reload();
}
