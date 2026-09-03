// ESTUDOS — pomodoro, XP/nivel, trofeus e confete.

// ESTUDOS
function renderEstudos() {
  loadStudyXP();
  updateTimerDisplay();
  updateTimerRing();
  updateSessionDots();
  renderTrophies();
}

// Timer inline edit
function startInlineEdit() {
  if(timerRunning) return;
  var disp = document.getElementById('timer-display');
  var inp = document.getElementById('timer-inline-input');
  inp.value = disp.textContent;
  disp.style.display = 'none';
  inp.style.display = 'block';
  inp.focus();
  inp.select();
  document.getElementById('timer-label').textContent = 'Digite mm:ss e pressione Enter';
}

function applyInlineEdit() {
  var inp = document.getElementById('timer-inline-input');
  var val = inp.value.trim();
  var parts = val.split(':');
  var mins = 0, secs = 0;
  if(parts.length === 2) {
    mins = parseInt(parts[0]) || 0;
    secs = parseInt(parts[1]) || 0;
  } else {
    mins = parseInt(val) || 0;
  }
  var total = mins * 60 + secs;
  if(total > 0) {
    timerTotal = total;
    timerRemaining = total;
    document.querySelectorAll('.timer-preset-btn').forEach(function(b){b.classList.remove('active');});
  }
  cancelInlineEdit();
  updateTimerDisplay();
  updateTimerRing();
  if(total > 0) toast('⏱ Timer: ' + pad(mins) + ':' + pad(secs));
}

function cancelInlineEdit() {
  document.getElementById('timer-display').style.display = 'block';
  document.getElementById('timer-inline-input').style.display = 'none';
  document.getElementById('timer-label').textContent = timerRunning ? 'Estudando...' : 'Clique no tempo para editar';
}

// ─── TROPHY SYSTEM ───────────────────────────────────────

var TROPHIES = [
  {
    id: 'viajante',
    name: 'Viajante do Tempo',
    desc: 'Primeiros passos na jornada do conhecimento',
    xpRequired: 50,
    color: '#AAC4F5',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#AAC4F5"/>
          <stop offset="100%" style="stop-color:#8CA9FF"/>
        </linearGradient>
        <filter id="glow1"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <!-- Hourglass body -->
      <path d="M30 15 L70 15 L55 50 L70 85 L30 85 L45 50 Z" fill="url(#g1)" opacity="0.9" filter="url(#glow1)" rx="4"/>
      <rect x="26" y="12" width="48" height="8" rx="4" fill="#AAC4F5" opacity="0.8"/>
      <rect x="26" y="80" width="48" height="8" rx="4" fill="#AAC4F5" opacity="0.8"/>
      <ellipse cx="50" cy="50" rx="8" ry="8" fill="white" opacity="0.6"/>
      <circle cx="50" cy="50" r="4" fill="#fff" opacity="0.9"/>
      <!-- Glass shine -->
      <path d="M34 18 L44 48" stroke="white" stroke-width="2" opacity="0.3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'curioso',
    name: 'Mente Curiosa',
    desc: 'A curiosidade é o motor do aprendizado',
    xpRequired: 100,
    color: '#818cf8',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#AAC4F5"/>
          <stop offset="100%" style="stop-color:#1C2547"/>
        </linearGradient>
        <filter id="glow2"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <!-- Brain -->
      <ellipse cx="50" cy="46" rx="28" ry="24" fill="url(#g2)" opacity="0.9" filter="url(#glow2)"/>
      <path d="M30 38 Q35 28 45 32 Q50 24 58 30 Q68 26 70 38 Q78 42 72 52 Q76 60 68 64 Q60 72 50 68 Q40 72 32 64 Q24 60 28 52 Q22 42 30 38Z" fill="url(#g2)" opacity="0.95"/>
      <!-- Folds -->
      <path d="M38 36 Q44 32 50 36 Q56 32 62 36" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M34 48 Q40 44 46 48 Q52 44 58 48 Q64 44 68 48" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M36 58 Q44 54 52 58 Q60 54 66 58" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <!-- Stem -->
      <rect x="46" y="68" width="8" height="10" rx="4" fill="#AAC4F5" opacity="0.8"/>
      <!-- Base -->
      <ellipse cx="50" cy="80" rx="16" ry="5" fill="#8CA9FF" opacity="0.7"/>
      <!-- Shine -->
      <ellipse cx="42" cy="40" rx="6" ry="4" fill="white" opacity="0.2" transform="rotate(-20 42 40)"/>
    </svg>`
  },
  {
    id: 'genio',
    name: 'Gênio Moderno',
    desc: 'Einstein ficaria orgulhoso',
    xpRequired: 200,
    color: '#f0abfc',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#F6A9A4"/>
          <stop offset="100%" style="stop-color:#8CA9FF"/>
        </linearGradient>
        <filter id="glow3"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <!-- Light bulb -->
      <path d="M50 18 C34 18 25 30 25 42 C25 52 31 60 38 65 L38 72 L62 72 L62 65 C69 60 75 52 75 42 C75 30 66 18 50 18Z" fill="url(#g3)" opacity="0.9" filter="url(#glow3)"/>
      <!-- Filament -->
      <path d="M42 58 Q46 50 50 54 Q54 50 58 58" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
      <line x1="50" y1="54" x2="50" y2="46" stroke="white" stroke-width="1.5" opacity="0.7"/>
      <!-- Screw base -->
      <rect x="38" y="72" width="24" height="5" rx="2" fill="#AAC4F5" opacity="0.9"/>
      <rect x="40" y="77" width="20" height="4" rx="2" fill="#6d28d9" opacity="0.9"/>
      <rect x="42" y="81" width="16" height="4" rx="2" fill="#5b21b6" opacity="0.9"/>
      <!-- Shine -->
      <ellipse cx="40" cy="32" rx="7" ry="5" fill="white" opacity="0.25" transform="rotate(-20 40 32)"/>
      <!-- Stars -->
      <circle cx="20" cy="28" r="2" fill="#f0abfc" opacity="0.8"/>
      <circle cx="80" cy="25" r="2.5" fill="#AAC4F5" opacity="0.7"/>
      <circle cx="15" cy="48" r="1.5" fill="#AAC4F5" opacity="0.6"/>
    </svg>`
  },
  {
    id: 'viciado',
    name: 'Viciado em Estudos',
    desc: 'O conhecimento é seu vício mais saudável',
    xpRequired: 350,
    color: '#34d399',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#A7DDA0"/>
          <stop offset="100%" style="stop-color:#1C2547"/>
        </linearGradient>
        <filter id="glow4"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <!-- Book stack -->
      <rect x="22" y="62" width="56" height="12" rx="4" fill="url(#g4)" opacity="0.95" filter="url(#glow4)"/>
      <rect x="25" y="48" width="50" height="14" rx="4" fill="#AAC4F5" opacity="0.9"/>
      <rect x="28" y="35" width="44" height="14" rx="4" fill="#9d5cf0" opacity="0.85"/>
      <rect x="31" y="23" width="38" height="13" rx="4" fill="#AAC4F5" opacity="0.8"/>
      <!-- Spine lines -->
      <line x1="30" y1="62" x2="30" y2="74" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <line x1="33" y1="48" x2="33" y2="62" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      <line x1="36" y1="35" x2="36" y2="49" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <line x1="39" y1="23" x2="39" y2="36" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
      <!-- Page lines -->
      <line x1="38" y1="27" x2="64" y2="27" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="3,2"/>
      <line x1="38" y1="31" x2="60" y2="31" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="3,2"/>
      <!-- Shine -->
      <rect x="68" y="63" width="6" height="10" rx="3" fill="white" opacity="0.2"/>
      <!-- Base -->
      <ellipse cx="50" cy="76" rx="24" ry="5" fill="#2d1060" opacity="0.5"/>
    </svg>`
  },
  {
    id: 'mestre',
    name: 'Mestre Iluminado',
    desc: 'Você transcendeu — o conhecimento flui por você',
    xpRequired: 500,
    color: '#fbbf24',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD166"/>
          <stop offset="50%" style="stop-color:#AAC4F5"/>
          <stop offset="100%" style="stop-color:#8CA9FF"/>
        </linearGradient>
        <filter id="glow5"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <!-- Trophy cup -->
      <path d="M35 20 L65 20 L60 55 Q56 65 50 67 Q44 65 40 55 Z" fill="url(#g5)" opacity="0.95" filter="url(#glow5)"/>
      <!-- Handles -->
      <path d="M35 25 Q20 28 22 40 Q24 50 35 48" stroke="url(#g5)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M65 25 Q80 28 78 40 Q76 50 65 48" stroke="url(#g5)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- Stem -->
      <rect x="44" y="67" width="12" height="10" rx="4" fill="#AAC4F5" opacity="0.9"/>
      <!-- Base -->
      <rect x="32" y="77" width="36" height="8" rx="4" fill="#8CA9FF" opacity="0.9"/>
      <!-- Star inside cup -->
      <polygon points="50,28 52.5,34 59,34 54,38 56,45 50,41 44,45 46,38 41,34 47.5,34" fill="white" opacity="0.4"/>
      <!-- Stars around -->
      <circle cx="22" cy="20" r="2.5" fill="#FFD166" opacity="0.9"/>
      <circle cx="78" cy="18" r="2" fill="#FFD166" opacity="0.8"/>
      <circle cx="18" cy="38" r="1.5" fill="#AAC4F5" opacity="0.7"/>
      <circle cx="82" cy="38" r="2" fill="#AAC4F5" opacity="0.7"/>
      <circle cx="50" cy="12" r="3" fill="#FFD166" opacity="0.9"/>
      <!-- Shine -->
      <ellipse cx="44" cy="30" rx="5" ry="7" fill="white" opacity="0.2" transform="rotate(-15 44 30)"/>
    </svg>`
  }
];

var unlockedTrophies = [];
var pendingTrophyPopup = null;

// ── Render trophy grid ──
function renderTrophies() {
  var grid = document.getElementById('trophies-grid');
  if(!grid) return;

  var unlocked = TROPHIES.filter(function(t){ return studyXP >= t.xpRequired; });
  var total = TROPHIES.length;

  // Update counters
  var counter = document.getElementById('trophy-total-counter');
  if(counter) counter.textContent = unlocked.length + ' / ' + total + ' desbloqueados';
  var hCounter = document.getElementById('trophy-counter-text');
  if(hCounter) hCounter.textContent = unlocked.length + ' / ' + total;

  grid.innerHTML = TROPHIES.map(function(t) {
    var isUnlocked = studyXP >= t.xpRequired;
    var pct = Math.min(100, Math.round((studyXP / t.xpRequired) * 100));
    var xpLeft = Math.max(0, t.xpRequired - studyXP);

    return '<div class="trophy-card ' + (isUnlocked ? 'unlocked' : 'locked-card') + '" id="trophy-card-' + t.id + '">'
      + '<div class="trophy-model ' + (isUnlocked ? '' : 'locked') + '">' + t.svg + '</div>'
      + '<div class="trophy-name">' + esc(t.name) + '</div>'
      + '<div class="trophy-xp-wrap">'
        + '<div class="trophy-xp-bar-track">'
          + '<div class="trophy-xp-bar-fill" style="width:' + pct + '%"></div>'
        + '</div>'
        + '<div class="trophy-xp-label ' + (isUnlocked ? 'done' : '') + '">'
          + (isUnlocked ? '✓ Desbloqueado!' : xpLeft + ' XP restantes')
        + '</div>'
      + '</div>'
      + (!isUnlocked ? '<div class="trophy-lock-overlay">'
          + '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
          + '<div class="trophy-lock-text">Bloqueado</div>'
        + '</div>' : '')
      + '</div>';
  }).join('');
}

// ── Check for newly unlocked trophies ──
function checkTrophyUnlock(previousXP) {
  TROPHIES.forEach(function(t) {
    var wasLocked = previousXP < t.xpRequired;
    var nowUnlocked = studyXP >= t.xpRequired;
    if(wasLocked && nowUnlocked) {
      pendingTrophyPopup = t;
    }
  });
  if(pendingTrophyPopup) {
    setTimeout(function() {
      showTrophyPopup(pendingTrophyPopup);
      pendingTrophyPopup = null;
    }, 1200); // slight delay after timer finish celebration
  }
}

// ── Show trophy unlock popup ──
function showTrophyPopup(trophy) {
  var overlay = document.getElementById('trophy-popup-overlay');
  var nameEl = document.getElementById('popup-trophy-name');
  var modelEl = document.getElementById('popup-trophy-model');
  if(!overlay || !nameEl || !modelEl) return;

  nameEl.textContent = '"' + trophy.name + '"';
  modelEl.innerHTML = trophy.svg;

  // Reset animation
  overlay.classList.remove('show');
  void overlay.offsetWidth; // reflow
  overlay.classList.add('show');
  document.getElementById('confetti-canvas').style.display = 'block';
  launchConfetti();
}

function closeTrophyPopup() {
  var overlay = document.getElementById('trophy-popup-overlay');
  if(overlay) overlay.classList.remove('show');
  var canvas = document.getElementById('confetti-canvas');
  if(canvas) { canvas.style.display = 'none'; stopConfetti(); }

  // Scroll to trophies section smoothly
  var section = document.querySelector('.estudos-trophy-section');
  if(section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Confetti ──
var confettiAnimId = null;
var confettiParticles = [];

function launchConfetti() {
  var canvas = document.getElementById('confetti-canvas');
  if(!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  var ctx = canvas.getContext('2d');
  var colors = ['#AAC4F5','#AAC4F5','#f0abfc','#818cf8','#fbbf24','#34d399','#fb7185'];
  confettiParticles = [];
  for(var i = 0; i < 120; i++) {
    confettiParticles.push({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.5,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      angle: Math.random() * 360,
      vAngle: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }
  if(confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti(ctx, canvas);
}

function animateConfetti(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var alive = false;
  confettiParticles.forEach(function(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.angle += p.vAngle;
    p.vy += 0.08; // gravity
    if(p.y < canvas.height + 20) alive = true;
    if(p.y > canvas.height * 0.7) p.opacity = Math.max(0, p.opacity - 0.015);
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle * Math.PI / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
    ctx.restore();
  });
  if(alive) {
    confettiAnimId = requestAnimationFrame(function(){ animateConfetti(ctx, canvas); });
  }
}

function stopConfetti() {
  if(confettiAnimId) { cancelAnimationFrame(confettiAnimId); confettiAnimId = null; }
  confettiParticles = [];
  var canvas = document.getElementById('confetti-canvas');
  if(canvas) { var ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); }
}

// ─── ESTUDOS ────────────────────────────────────────────

// SVG gradient for timer ring
document.addEventListener('DOMContentLoaded', function() {
  var svg = document.querySelector('.timer-ring');
  if (svg) {
    var defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = '<linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#8CA9FF"/><stop offset="100%" style="stop-color:#AAC4F5"/></linearGradient>';
    svg.insertBefore(defs, svg.firstChild);
  }
});

// ─── TIMER ───────────────────────────────────────────────
var timerTotal = 25 * 60;
var timerRemaining = 25 * 60;
var timerInterval = null;
var timerRunning = false;
var timerStartedAt = null;   // Date.now() when timer started
var timerBaseRemaining = 0;  // remaining at the moment start was pressed
var todaySessions = 0;
var studyXP = 0;
var studyLevel = 1;

// Load XP from state
function loadStudyXP() {
  if (state.studyXP !== undefined) studyXP = state.studyXP;
  if (state.todaySessions !== undefined) {
    var today = new Date().toDateString();
    if (state.sessionDate === today) todaySessions = state.todaySessions;
    else todaySessions = 0;
  }
  updateXPDisplay();
  updateSessionDots();
  renderTrophies();
}

function setTimerPreset(minutes, el) {
  if (timerRunning) return;
  document.querySelectorAll('.timer-preset-btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  timerTotal = minutes * 60;
  timerRemaining = timerTotal;
  document.getElementById('custom-timer-wrap').style.display = 'none';
  updateTimerDisplay();
  updateTimerRing();
}

function openCustomTimer() {
  var wrap = document.getElementById('custom-timer-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

function applyCustomTimer() {
  if (timerRunning) return;
  var mins = parseInt(document.getElementById('custom-minutes').value) || 0;
  var secs = parseInt(document.getElementById('custom-seconds').value) || 0;
  var total = mins * 60 + secs;
  if (total < 1) { toast('⚠️ Defina um tempo válido.'); return; }
  timerTotal = total;
  timerRemaining = total;
  document.querySelectorAll('.timer-preset-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('custom-timer-wrap').style.display = 'none';
  updateTimerDisplay();
  updateTimerRing();
  toast('⏱ Timer configurado!');
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerStartedAt = Date.now();
  timerBaseRemaining = timerRemaining;
  document.getElementById('timer-start-btn').style.display = 'none';
  document.getElementById('timer-pause-btn').style.display = 'inline-flex';
  document.getElementById('timer-label').textContent = 'Estudando...';
  timerInterval = setInterval(function() {
    var elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
    timerRemaining = Math.max(0, timerBaseRemaining - elapsed);
    updateTimerDisplay();
    updateTimerRing();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerFinished();
    }
  }, 500); // tick every 500ms for accuracy
}

function pauseTimer() {
  if (!timerRunning) return;
  // Capture exact remaining before clearing interval
  var elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
  timerRemaining = Math.max(0, timerBaseRemaining - elapsed);
  clearInterval(timerInterval);
  timerRunning = false;
  timerStartedAt = null;
  document.getElementById('timer-start-btn').style.display = 'inline-flex';
  document.getElementById('timer-start-btn').textContent = '▶ Continuar';
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-label').textContent = 'Pausado';
  updateTimerDisplay();
  updateTimerRing();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRemaining = timerTotal;
  document.getElementById('timer-start-btn').style.display = 'inline-flex';
  document.getElementById('timer-start-btn').textContent = '▶ Iniciar';
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-label').textContent = 'Pronto para começar';
  updateTimerDisplay();
  updateTimerRing();
}

function timerFinished() {
  document.getElementById('timer-start-btn').style.display = 'inline-flex';
  document.getElementById('timer-start-btn').textContent = '▶ Iniciar';
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-label').textContent = '✅ Sessão concluída!';
  timerRemaining = 0;
  updateTimerDisplay();
  updateTimerRing();
  playAlertSound();
  addXP(5);
  todaySessions++;
  state.studyXP = studyXP;
  state.todaySessions = todaySessions;
  state.sessionDate = new Date().toDateString();
  saveState();
  updateSessionDots();
  toast('🎉 Sessão concluída! +5 XP');
  setTimeout(function() {
    timerRemaining = timerTotal;
    document.getElementById('timer-label').textContent = 'Pronto para começar';
    updateTimerDisplay();
    updateTimerRing();
  }, 3000);
}

function updateTimerDisplay() {
  var dispEl = document.getElementById('timer-display'); if(!dispEl) return;
  var m = Math.floor(timerRemaining / 60);
  var s = timerRemaining % 60;
  dispEl.textContent = pad(m) + ':' + pad(s);
}

function updateTimerRing() {
  var circumference = 553;
  var ring = document.getElementById('timer-ring-fill'); if(!ring) return;
  var progress = timerRemaining / timerTotal;
  var offset = circumference * (1 - progress);
  ring.style.strokeDashoffset = offset;
}

function playAlertSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var notes = [523, 659, 784, 1047];
    notes.forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.4);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.4);
    });
  } catch(e) {}
}

function addXP(amount) {
  var previousXP = studyXP;
  studyXP += amount;
  updateXPDisplay();
  checkTrophyUnlock(previousXP);
  renderTrophies();
  // persist XP
  if(state) {
    state.studyXP = studyXP;
    saveState();
  }
}

function updateXPDisplay() {
  var xpPerLevel = 100;
  studyLevel = Math.floor(studyXP / xpPerLevel) + 1;
  var xpInLevel = studyXP % xpPerLevel;
  var pct = (xpInLevel / xpPerLevel) * 100;
  var el = document.getElementById('estudos-xp-display');
  if (el) el.textContent = studyXP + ' XP';
  var xl = document.getElementById('xp-total-label');
  if (xl) xl.textContent = studyXP + ' XP';
  var fill = document.getElementById('xp-bar-fill');
  if (fill) fill.style.width = pct + '%';
  var lv = document.getElementById('xp-level');
  if (lv) lv.textContent = studyLevel;
  var nx = document.getElementById('xp-next');
  if (nx) nx.textContent = xpPerLevel - xpInLevel;
}

function updateSessionDots() {
  var dots = document.getElementById('timer-sessions-dots');
  if (!dots) return;
  dots.innerHTML = '';
  for (var i = 0; i < todaySessions; i++) {
    var dot = document.createElement('div');
    dot.className = 'session-dot';
    dot.title = 'Sessão ' + (i + 1);
    dots.appendChild(dot);
  }
  if (todaySessions === 0) {
    dots.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Nenhuma sessão ainda</span>';
  }
}
