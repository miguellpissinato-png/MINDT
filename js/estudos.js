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

// ─── CORES DO TICOLINO ──────────────────────────────────
// Substituem os antigos trofeus: cada marco de XP de estudo libera uma cor
// nova para o Ticolino (paletas em TICO_CORES, js/helpers.js). As funcoes
// mantem os nomes de antes (renderTrophies, checkTrophyUnlock...) porque
// sao chamadas de varios pontos do app.

var corEmVista = null;   // cor mostrada no destaque (a clicada na grade)

function renderTrophies() {
  var grid = document.getElementById('trophies-grid');
  if(!grid) return;
  var emUso = minhaCorTico();
  if(!corEmVista) corEmVista = emUso;
  var liberadas = TICO_CORES.filter(function(c){ return studyXP >= c.xp; }).length;

  var hCounter = document.getElementById('trophy-counter-text');
  if(hCounter) hCounter.textContent = liberadas + ' / ' + TICO_CORES.length;
  var xpEl = document.getElementById('cores-xp');
  if(xpEl) xpEl.textContent = studyXP + ' XP de estudo';

  // Destaque: a cor em vista, grande, com o que fazer com ela.
  var c = ticoCor(corEmVista);
  var livre = studyXP >= c.xp, usando = c.id === emUso;
  var dest = document.getElementById('cores-destaque');
  if(dest){
    dest.innerHTML =
      '<div class="cores-destaque-tico">' + ticolino('feliz', 120, false, c.id) + '</div>'
      + '<div class="cores-destaque-txt">'
        + '<div class="cores-destaque-nome">' + esc(c.nome) + '</div>'
        + '<div class="cores-destaque-sub">' + (c.xp === 0 ? 'A cor de sempre do Ticolino.'
            : livre ? 'Liberada com ' + c.xp + ' XP de estudo.'
            : 'Faltam ' + (c.xp - studyXP) + ' XP de estudo para liberar.') + '</div>'
        + (usando ? '<div class="cores-em-uso">✓ Em uso</div>'
            : livre ? '<button type="button" class="btn btn-primary" onclick="usarCorTico(\'' + c.id + '\')">Usar esta cor</button>'
            : '<div class="cores-falta"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' + c.xp + ' XP</div>')
      + '</div>';
  }

  grid.innerHTML = TICO_CORES.map(function(t) {
    var ok = studyXP >= t.xp, uso = t.id === emUso, vista = t.id === corEmVista;
    return '<button type="button" class="cor-card' + (ok ? '' : ' trancada') + (vista ? ' em-vista' : '') + '"'
      + ' aria-pressed="' + vista + '" onclick="verCorTico(\'' + t.id + '\')">'
      + (uso ? '<span class="cor-check" aria-label="Em uso">✓</span>' : '')
      + '<span class="cor-tico">' + ticolino('feliz', 64, false, t.id) + '</span>'
      + '<span class="cor-nome">' + esc(t.nome) + '</span>'
      + '<span class="cor-estado">' + (uso ? 'Em uso' : ok ? 'Liberada'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' + t.xp + ' XP') + '</span>'
      + '</button>';
  }).join('');
}

function verCorTico(id){ corEmVista = id; renderTrophies(); }

function usarCorTico(id){
  var c = ticoCor(id);
  if(studyXP < c.xp) return;
  if(!state.perfil) state.perfil = {};
  state.perfil.cor = c.id;
  saveState();
  renderTrophies();
  updateXPDisplay();                       // rosto do menu lateral
  if(typeof renderHome === 'function') renderHome();
  if(typeof publicarPerfil === 'function') publicarPerfil();
  toast('🐹 Ticolino agora está ' + c.nome.toLowerCase() + '!');
}

// ── Cor nova liberada? ──
// O aviso sai UMA vez na vida por cor. Antes ele saia toda vez que o XP
// cruzava o marco: desmarcar um item da Home tira XP, marcar de novo
// devolve, e a mesma cor era "liberada" de novo a cada vai e volta.
// A lista das ja anunciadas mora no estado (sincroniza entre aparelhos).
// Quem ainda nao tem a lista ganha uma com as cores que o XP de antes ja
// liberava — elas ja eram dela, nao sao novidade.
function coresAnunciadas(xpAntes) {
  if(!Array.isArray(state.coresAnunciadas)) {
    state.coresAnunciadas = TICO_CORES.filter(function(c){ return c.xp > 0 && xpAntes >= c.xp; })
      .map(function(c){ return c.id; });
  }
  return state.coresAnunciadas;
}

function checkTrophyUnlock(previousXP) {
  var nova = null, vistas = coresAnunciadas(previousXP);
  TICO_CORES.forEach(function(c) {
    if(c.xp > 0 && studyXP >= c.xp && vistas.indexOf(c.id) === -1) {
      vistas.push(c.id);
      nova = c;
    }
  });
  if(nova) {
    // O valor e guardado AGORA, nao lido depois do atraso: duas cores
    // liberadas em sequencia nao podem disputar a mesma variavel.
    setTimeout(function() { showTrophyPopup(nova); }, 1200);
  }
}

function showTrophyPopup(cor) {
  if(!cor) return;
  var overlay = document.getElementById('trophy-popup-overlay');
  var nameEl = document.getElementById('popup-trophy-name');
  var modelEl = document.getElementById('popup-trophy-model');
  if(!overlay || !nameEl || !modelEl) return;
  nameEl.textContent = cor.nome;
  modelEl.innerHTML = ticolino('feliz', 120, false, cor.id);
  corEmVista = cor.id;
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
  renderTrophies();
  var section = document.querySelector('.estudos-trophy-section');
  if(section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  var colors = ['#E3CA96','#F5A03D','#6CB2E5','#54AB7A','#E3B341','#D28756','#8EEBCC'];
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
    defs.innerHTML = '<linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#FF9420"/><stop offset="100%" style="stop-color:#D06A00"/></linearGradient>';
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
  coresAnunciadas(studyXP);   // cria a lista ja com o que esta liberado
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
  // O limite e 1 SEGUNDO, nao 1 minuto — os dois campos somam. Prometer
  // "pelo menos 1 minuto" faria a mensagem mentir sobre a propria regra.
  if (total < 1) { toast('⚠️ Preencha os minutos ou os segundos do timer.'); return; }
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
  if (typeof registrarEstudo === 'function') registrarEstudo(Math.round(timerTotal / 60));
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
  // O XP em dobro do Ticolino Max vale para tudo que da XP: pomodoro,
  // itens do dia e treinos. Dobrar aqui, na porta unica, evita ter que
  // lembrar de dobrar em cada um deles.
  if (typeof xpEmDobro === 'function' && xpEmDobro()) amount = amount * 2;
  var previousXP = studyXP;
  studyXP += amount;
  // Passa tambem pelo historico: o studyXP e so o acumulado da vida toda, e
  // o Resumo de atividades precisa saber quanto entrou em cada dia.
  if (typeof registrarXP === 'function') registrarXP(amount);
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

  // Cartao de nivel no pe do menu lateral (design system).
  var nn = document.getElementById('nav-nivel-nome');
  if (nn) {
    nn.textContent = (state.perfil && state.perfil.name) || T('voce');
    var nx2 = document.getElementById('nav-nivel-xp');
    if (nx2) nx2.textContent = T('level') + ' ' + studyLevel + ' · ' + studyXP + ' XP';
    var nf = document.getElementById('nav-nivel-fill');
    if (nf) nf.style.width = pct + '%';
    var nr = document.getElementById('nav-nivel-rosto');
    if (nr) nr.innerHTML = ticolino('feliz', 34, true);
  }
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
