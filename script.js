/**
 * GYMPRO ELITE V10.4
 * Logic optimized for iOS persistence and correct timer handling
 */

// --- GLOBAL STATE ---
let state = {
    week: 1, type: '', rm: 100, exIdx: 0, setIdx: 0, 
    log: [], currentEx: null, currentExName: '',
    historyStack: ['ui-week'],
    timerInterval: null, timerTarget: 0, timerStartTimestamp: null,
    isArmPhase: false, isFreestyle: false, currentMuscle: '',
    completedExInSession: [],
    workoutStartTime: null,
    lastLoggedSet: null 
};

let audioContext;
let wakeLock = null;

// --- DATABASE ---
const unilateralExercises = ["Dumbbell Peck Fly", "Lateral Raises", "Single Leg Curl", "Dumbbell Bicep Curls", "Cable Fly", "Concentration Curls"];

const exerciseDatabase = [
    { name: "Overhead Press (Main)", muscles: ["כתפיים"], isCalc: true, baseRM: 77.5, rmRange: [65, 90], manualRange: {base: 50, min: 40, max: 80, step: 2.5} },
    { name: "Lateral Raises", muscles: ["כתפיים"], sets: [{w: 12.5, r: 13}, {w: 12.5, r: 13}, {w: 12.5, r: 11}], step: 0.5 },
    { name: "Face Pulls", muscles: ["כתפיים"], sets: [{w: 40, r: 13}, {w: 40, r: 13}, {w: 40, r: 15}], step: 2.5 },
    { name: "Barbell Shrugs", muscles: ["כתפיים"], sets: [{w: 140, r: 11}, {w: 140, r: 11}, {w: 140, r: 11}], step: 5 },
    { name: "Bench Press (Main)", muscles: ["חזה"], isCalc: true, baseRM: 122.5, rmRange: [110, 160], manualRange: {base: 85, min: 60, max: 140, step: 2.5} },
    { name: "Incline Bench Press", muscles: ["חזה"], sets: [{w: 65, r: 9}, {w: 65, r: 9}, {w: 65, r: 9}], step: 2.5 },
    { name: "Dumbbell Peck Fly", muscles: ["חזה"], sets: [{w: 14, r: 11}, {w: 14, r: 11}, {w: 14, r: 11}], step: 2 },
    { name: "Machine Peck Fly", muscles: ["חזה"], sets: [{w: 45, r: 11}, {w: 45, r: 11}, {w: 45, r: 11}], step: 1 },
    { name: "Cable Fly", muscles: ["חזה"], sets: [{w: 12.5, r: 11}, {w: 12.5, r: 11}, {w: 12.5, r: 11}], step: 2.5 },
    { name: "Leg Press", muscles: ["רגליים"], sets: [{w: 280, r: 8}, {w: 300, r: 8}, {w: 300, r: 7}], step: 5 },
    { name: "Squat", muscles: ["רגליים"], sets: [{w: 100, r: 8}, {w: 100, r: 8}, {w: 100, r: 8}], step: 2.5, minW: 60, maxW: 180 },
    { name: "Deadlift", muscles: ["רגליים"], sets: [{w: 100, r: 5}, {w: 100, r: 5}, {w: 100, r: 5}], step: 2.5, minW: 60, maxW: 180 },
    { name: "Romanian Deadlift", muscles: ["רגליים"], sets: [{w: 100, r: 8}, {w: 100, r: 8}, {w: 100, r: 8}], step: 2.5, minW: 60, maxW: 180 },
    { name: "Single Leg Curl", muscles: ["רגליים"], sets: [{w: 25, r: 8}, {w: 30, r: 6}, {w: 25, r: 8}], step: 2.5 },
    { name: "Lying Leg Curl (Double)", muscles: ["רגליים"], sets: [{w: 50, r: 8}, {w: 60, r: 6}, {w: 50, r: 8}], step: 5 },
    { name: "Seated Calf Raise", muscles: ["רגליים"], sets: [{w: 70, r: 10}, {w: 70, r: 10}, {w: 70, r: 12}], step: 5 },
    { name: "Standing Calf Raise", muscles: ["רגליים"], sets: [{w: 110, r: 10}, {w: 110, r: 10}, {w: 110, r: 12}], step: 10 },
    { name: "Lat Pulldown", muscles: ["גב"], sets: [{w: 75, r: 10}, {w: 75, r: 10}, {w: 75, r: 11}], step: 2.5 },
    { name: "Pull Ups", muscles: ["גב"], isBW: true, sets: [{w: 0, r: 8}, {w: 0, r: 8}, {w: 0, r: 8}] },
    { name: "Cable Row", muscles: ["גב"], sets: [{w: 65, r: 10}, {w: 65, r: 10}, {w: 65, r: 12}], step: 2.5 },
    { name: "Machine Row", muscles: ["גב"], sets: [{w: 50, r: 10}, {w: 50, r: 10}, {w: 50, r: 12}], step: 5 },
    { name: "Straight Arm Pulldown", muscles: ["גב"], sets: [{w: 30, r: 10}, {w: 30, r: 12}, {w: 30, r: 12}], step: 2.5 },
    { name: "Back Extension", muscles: ["גב"], sets: [{w: 0, r: 12}, {w: 0, r: 12}, {w: 0, r: 12}], step: 5, minW: 0, maxW: 50, isBW: true }
];

const armExercises = {
    biceps: [
        { name: "Dumbbell Bicep Curls", sets: [{w: 12, r: 8}], step: 0.5 },
        { name: "Barbell Bicep Curls", sets: [{w: 25, r: 8}], step: 1 },
        { name: "Concentration Curls", sets: [{w: 10, r: 10}], step: 0.5 }
    ],
    triceps: [
        { name: "Triceps Pushdown", sets: [{w: 35, r: 8}], step: 2.5 },
        { name: "Lying Triceps Extension", sets: [{w: 25, r: 8}], step: 2.5 }
    ]
};

const workouts = {
    'A': ["Overhead Press (Main)", "Barbell Shrugs", "Lateral Raises", "Face Pulls", "Incline Bench Press"],
    'B': ["Leg Press", "Single Leg Curl", "Lat Pulldown", "Cable Row", "Seated Calf Raise", "Straight Arm Pulldown"],
    'C': ["Bench Press (Main)", "Incline Bench Press", "Dumbbell Peck Fly", "Lateral Raises", "Face Pulls"]
};

// --- SYSTEM & AUDIO ---

function haptic(type = 'light') {
    if (!("vibrate" in navigator)) return;
    try {
        if (type === 'light') navigator.vibrate(15); 
        else if (type === 'medium') navigator.vibrate(40);
        else if (type === 'success') navigator.vibrate([50, 50, 50]);
        else if (type === 'warning') navigator.vibrate([30, 50, 30]);
    } catch(e) {}
}

function playBeep(times = 1) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    
    const now = audioContext.currentTime;
    for (let i = 0; i < times; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + i * 0.6);
        gain.gain.setValueAtTime(0.2, now + i * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.6 + 0.3);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now + i * 0.6);
        osc.stop(now + i * 0.6 + 0.3);
    }
}

async function initAudio() {
    haptic('medium');
    playBeep(1);
    const btn = document.getElementById('audio-init-btn');
    btn.innerHTML = `<div class="card-icon">✅</div><div class="card-text">מצב אימון פעיל</div>`;
    btn.style.background = "var(--success-gradient)";
    
    try { 
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen'); 
        }
    } catch (err) { console.log("Wake Lock not supported"); }
}

function navigate(id) {
    haptic('light');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    if (state.historyStack[state.historyStack.length - 1] !== id) state.historyStack.push(id);
    document.getElementById('global-back').style.visibility = (id === 'ui-week') ? 'hidden' : 'visible';
    
    // UI Cleanup
    if(id !== 'ui-main') {
        // If leaving main, we don't necessarily kill the timer, 
        // but if we navigate randomly, maybe we should? 
        // Strategy: Keep timer running in background unless we explicitly stop it.
    }
}

function handleBackClick() {
    haptic('warning');
    if (state.historyStack.length <= 1) return;

    const currentScreen = state.historyStack.pop();
    const prevScreen = state.historyStack[state.historyStack.length - 1];

    // CASE: Undo last set (from Extra or Main)
    if (currentScreen === 'ui-extra' || (currentScreen === 'ui-main' && state.setIdx > 0)) {
        
        // Stop timer immediately if we are undoing
        stopRestTimer();
        
        // Logic: If in Extra, we just finished the exercise. We need to go back to Main and setIdx = last index.
        // If in Main and setIdx > 0, we decrement.
        
        if (currentScreen === 'ui-extra') {
             // We were at extra, so we finished the exercise. Go back to main.
             // We do NOT pop another history item because 'ui-main' is what we want.
             // But we popped 'ui-extra' already.
             
             // Restore the last logged set to be "current" again
             const poppedLog = state.log.pop(); 
             
             // Don't change screen yet, just set logic
        } else {
             // We are in Main, going back a set
             state.log.pop();
             state.setIdx--; 
        }
        
        // Recalculate last logged set based on remaining log
        state.lastLoggedSet = state.log.length > 0 ? state.log[state.log.length - 1] : null;
        
        // Check bounds
        if(state.setIdx < 0) state.setIdx = 0;

        // Force UI update
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('ui-main').classList.add('active');
        
        // Fix History: We want to be on 'ui-main', ensure it's at top of stack
        if (state.historyStack[state.historyStack.length-1] !== 'ui-main') {
             state.historyStack.push('ui-main');
        }

        initPickers();
        return;
    }

    // Standard Back
    navigate(prevScreen); 
    // Fix double push from navigate
    state.historyStack.pop(); 
}

// --- WORKOUT FLOW ---

function selectWeek(w) { state.week = w; navigate('ui-workout-type'); }

function selectWorkout(t) {
    state.type = t; state.exIdx = 0; state.log = []; 
    state.completedExInSession = []; state.isArmPhase = false; state.isFreestyle = false;
    state.workoutStartTime = Date.now();
    showConfirmScreen();
}

function startFreestyle() {
    state.type = 'Freestyle'; state.log = []; state.completedExInSession = [];
    state.isArmPhase = false; state.isFreestyle = true;
    state.workoutStartTime = Date.now();
    navigate('ui-muscle-select');
}

function showExerciseList(muscle) {
    state.currentMuscle = muscle;
    const options = document.getElementById('variation-options');
    options.innerHTML = "";
    document.getElementById('variation-title').innerText = `תרגילי ${muscle}`;
    
    // Filter out completed exercises for this session
    const filtered = exerciseDatabase.filter(ex => ex.muscles.includes(muscle) && !state.completedExInSession.includes(ex.name));
    
    filtered.forEach(ex => {
        const btn = document.createElement('button');
        btn.className = "menu-card";
        btn.innerHTML = `<span>${ex.name}</span><div class="arrow">➔</div>`;
        btn.onclick = () => {
            const dbRef = exerciseDatabase.find(d => d.name === ex.name);
            state.currentEx = JSON.parse(JSON.stringify(dbRef));
            state.currentExName = ex.name;
            if (state.currentEx.isCalc) {
                // Should not happen in freestyle usually, but if so, give defaults
                state.currentEx.sets = Array(3).fill({w: state.currentEx.manualRange.base, r: 8});
                state.currentEx.step = state.currentEx.manualRange.step;
            }
            startRecording();
        };
        options.appendChild(btn);
    });
    navigate('ui-variation');
}

function showConfirmScreen() {
    if(state.exIdx >= workouts[state.type].length) {
        navigate('ui-ask-arms');
        return;
    }
    const exName = workouts[state.type][state.exIdx];
    const exData = exerciseDatabase.find(e => e.name === exName);
    document.getElementById('confirm-ex-name').innerText = exData.name;
    navigate('ui-confirm');
}

function confirmExercise(doEx) {
    const exName = workouts[state.type][state.exIdx];
    const exData = exerciseDatabase.find(e => e.name === exName);
    if (!doEx) { 
        state.log.push({ skip: true, exName: exData.name }); 
        state.exIdx++; 
        checkFlow(); 
        return; 
    }
    state.currentEx = JSON.parse(JSON.stringify(exData));
    state.currentExName = exData.name;
    if (state.currentEx.isCalc) setupCalculatedEx();
    else startRecording();
}

function setupCalculatedEx() {
    document.getElementById('rm-title').innerText = `${state.currentExName} 1RM`;
    const p = document.getElementById('rm-picker'); p.innerHTML = "";
    for(let i = state.currentEx.rmRange[0]; i <= state.currentEx.rmRange[1]; i += 2.5) {
        let o = new Option(i + " kg", i); if(i === state.currentEx.baseRM) o.selected = true; p.add(o);
    }
    navigate('ui-1rm');
}

function save1RM() {
    state.rm = parseFloat(document.getElementById('rm-picker').value);
    const p = { 1: [0.65, 0.75, 0.85, 0.75, 0.65], 2: [0.70, 0.80, 0.90, 0.80, 0.70, 0.70], 3: [0.75, 0.85, 0.95, 0.85, 0.75, 0.75] };
    const reps = state.week === 1 ? [5, 5, 5, 8, 10] : (state.week === 2 ? [3, 3, 3, 8, 10, 10] : [5, 3, 1, 8, 10, 10]);
    state.currentEx.sets = p[state.week].map((pct, i) => ({ w: Math.round((state.rm * pct) / 2.5) * 2.5, r: reps[i] || 10 }));
    startRecording();
}

function startRecording() { 
    state.setIdx = 0; 
    state.lastLoggedSet = null; 
    stopRestTimer(); // Ensure fresh start
    navigate('ui-main'); 
    initPickers(); 
}

function initPickers() {
    // Safety check
    if (!state.currentEx || !state.currentEx.sets) return;

    const target = state.currentEx.sets[state.setIdx];
    document.getElementById('ex-display-name').innerText = state.currentExName;
    document.getElementById('set-counter').innerText = `SET ${state.setIdx + 1}/${state.currentEx.sets.length}`;
    
    // History Pill
    const hist = document.getElementById('last-set-info');
    if (state.lastLoggedSet) {
        hist.innerText = `סט אחרון: ${state.lastLoggedSet.w}kg x ${state.lastLoggedSet.r} (RIR ${state.lastLoggedSet.rir})`;
        hist.style.display = 'block';
    } else hist.style.display = 'none';

    // Unilateral Badge
    document.getElementById('unilateral-note').style.display = unilateralExercises.some(u => state.currentExName.includes(u)) ? 'block' : 'none';
    
    // Timer Visibility Only (Logic handled in startRestTimer)
    const timerArea = document.getElementById('timer-area');
    if (state.timerStartTimestamp && state.setIdx > 0) {
        timerArea.classList.add('visible');
    } else {
        timerArea.classList.remove('visible');
    }

    // Weight Picker
    const wPick = document.getElementById('weight-picker'); wPick.innerHTML = "";
    const step = state.currentEx.step || 2.5;
    const currentW = target ? target.w : (state.lastLoggedSet ? state.lastLoggedSet.w : 0);
    // Range: -40 to +50 from current/target
    for(let i = Math.max(0, currentW - 40); i <= currentW + 50; i = parseFloat((i + step).toFixed(2))) {
        let o = new Option(parseFloat(i).toFixed(1).replace('.0','') + " kg", i); 
        if(Math.abs(i - currentW) < 0.1) o.selected = true; 
        wPick.add(o);
    }

    // Reps Picker
    const rPick = document.getElementById('reps-picker'); rPick.innerHTML = "";
    const currentR = target ? target.r : (state.lastLoggedSet ? state.lastLoggedSet.r : 8);
    for(let i = 1; i <= 30; i++) { 
        let o = new Option(i, i); 
        if(i === currentR) o.selected = true; 
        rPick.add(o); 
    }

    // RIR Picker
    const rirPick = document.getElementById('rir-picker'); rirPick.innerHTML = "";
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].forEach(v => {
        let o = new Option(v === 0 ? "Fail" : v, v); 
        if(v === 2) o.selected = true; 
        rirPick.add(o);
    });
}

// --- TIMER LOGIC (ROBUST) ---

function startRestTimer() {
    // 1. Determine Target Time
    const isBigLift = (state.exIdx === 0 && !state.isArmPhase && !state.isFreestyle);
    state.timerTarget = isBigLift ? 120 : 90;
    
    // 2. Set Start Time
    state.timerStartTimestamp = Date.now();
    
    // 3. UI Update
    document.getElementById('timer-area').classList.add('visible');
    
    // 4. Clear any old interval
    if (state.timerInterval) clearInterval(state.timerInterval);
    
    // 5. Start Interval
    updateTimerUI(); // Run once immediately
    state.timerInterval = setInterval(updateTimerUI, 100);
}

function updateTimerUI() {
    if (!state.timerStartTimestamp) return;

    const diff = Math.floor((Date.now() - state.timerStartTimestamp) / 1000);
    
    // Display
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    document.getElementById('rest-timer').innerText = `${mins}:${secs}`;

    // Circle Progress
    const circle = document.getElementById('timer-progress');
    const progress = Math.min(diff / state.timerTarget, 1);
    const offset = 283 - (progress * 283);
    circle.style.strokeDashoffset = offset;

    // Finish Check (Only beep once)
    if (diff === state.timerTarget) {
        playBeep(2);
        haptic('success');
    }
}

function stopRestTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    state.timerStartTimestamp = null;
    document.getElementById('timer-area').classList.remove('visible');
}

// --- ACTIONS ---

function finishSet() {
    haptic('light');
    const entry = { 
        exName: state.currentExName, 
        w: parseFloat(document.getElementById('weight-picker').value), 
        r: parseInt(document.getElementById('reps-picker').value), 
        rir: document.getElementById('rir-picker').value 
    };
    
    state.log.push(entry); 
    state.lastLoggedSet = entry;

    if (state.setIdx < state.currentEx.sets.length - 1) { 
        state.setIdx++; 
        startRestTimer(); // Only start timer here!
        initPickers(); 
    } else { 
        haptic('medium'); 
        stopRestTimer();
        navigate('ui-extra'); 
    }
}

function handleExtra(isBonus) {
    if(isBonus) { 
        state.setIdx++; 
        // Clone last set target
        if(state.currentEx.sets.length > 0) {
            state.currentEx.sets.push({...state.currentEx.sets[state.currentEx.sets.length-1]}); 
        } else {
            state.currentEx.sets.push({w: 10, r: 10});
        }
        startRestTimer();
        navigate('ui-main');
        initPickers(); 
    } else {
        state.completedExInSession.push(state.currentExName);
        if (state.isArmPhase) showArmSelection();
        else if (state.isFreestyle) showExerciseList(state.currentMuscle);
        else { 
            state.exIdx++; 
            checkFlow(); 
        }
    }
}

function checkFlow() {
    if (state.exIdx < workouts[state.type].length) showConfirmScreen();
    else navigate('ui-ask-arms');
}

function startArmWorkout() { state.isArmPhase = true; state.armGroup = 'biceps'; showArmSelection(); }

function showArmSelection() {
    const list = armExercises[state.armGroup];
    const remaining = list.filter(ex => !state.completedExInSession.includes(ex.name));
    
    if (remaining.length === 0) {
        if (state.armGroup === 'biceps') { state.armGroup = 'triceps'; showArmSelection(); }
        else finish(); 
        return;
    }
    
    document.getElementById('arm-selection-title').innerText = state.armGroup === 'biceps' ? "בחר בייספס" : "בחר טרייספס";
    const opts = document.getElementById('arm-options'); opts.innerHTML = "";
    
    remaining.forEach(ex => {
        const btn = document.createElement('button'); btn.className = "menu-card"; btn.innerText = ex.name;
        btn.onclick = () => { 
            state.currentEx = JSON.parse(JSON.stringify(ex)); state.currentExName = ex.name;
            state.currentEx.sets = [ex.sets[0], ex.sets[0], ex.sets[0]]; 
            startRecording();
        };
        opts.appendChild(btn);
    });
    
    const skipBtn = document.getElementById('btn-skip-arm-group');
    skipBtn.innerText = state.armGroup === 'biceps' ? "דלג לטרייספס" : "סיים אימון";
    skipBtn.onclick = () => { if (state.armGroup === 'biceps') { state.armGroup = 'triceps'; showArmSelection(); } else finish(); };
    navigate('ui-arm-selection');
}

function finish() {
    haptic('success');
    state.workoutDurationMins = Math.floor((Date.now() - state.workoutStartTime) / 60000);
    navigate('ui-summary');
    
    let summaryText = `GYMPRO ELITE LOG\nWeek: ${state.week} | Time: ${state.workoutDurationMins}m\n\n`;
    let grouped = {};
    
    state.log.forEach(e => {
        if(!grouped[e.exName]) grouped[e.exName] = { sets: [] };
        if(!e.skip) grouped[e.exName].sets.push(`${e.w}kg x ${e.r} @RIR${e.rir}`);
    });
    
    for (let ex in grouped) { 
        if(grouped[ex].sets.length > 0)
            summaryText += `${ex}:\n${grouped[ex].sets.join('\n')}\n\n`; 
    }
    
    document.getElementById('summary-area').innerText = summaryText.trim();
}

function copyResult() {
    const text = document.getElementById('summary-area').innerText;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => { haptic('light'); alert("הסיכום הועתק בהצלחה!"); })
            .catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";  // avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        haptic('light');
        alert("הסיכום הועתק!");
    } catch (err) {
        alert("שגיאה בהעתקה, נסה ידנית.");
    }
    document.body.removeChild(textArea);
}
