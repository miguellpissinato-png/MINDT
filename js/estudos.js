// ESTUDOS — pomodoro, XP/nivel, loja de cores e confete.

// ESTUDOS
function renderEstudos() {
  loadStudyXP();
  updateTimerDisplay();
  updateTimerRing();
  updateSessionDots();
  pintarBotoesTimer();
  // Plano da semana e a materia do timer (js/estudos-plano.js).
  if(typeof renderPlanoEstudos === 'function') renderPlanoEstudos();
}

// Botoes e Ticolino do timer (Design System 2). O Ticolino mostra o estado:
// focado estudando, tranquilo parado, orgulhoso quando a sessao termina.
function pintarBotoesTimer(rotulo, humor){
  var ini = document.getElementById('timer-start-btn'), pau = document.getElementById('timer-pause-btn');
  if(ini) ini.innerHTML = ico('play', 18, 2.4) + (rotulo || (timerRemaining < timerTotal && timerRemaining > 0 ? 'Continuar' : 'Iniciar sessão'));
  if(pau) pau.innerHTML = ico('pause', 18, 2.4) + 'Pausar';
  var t = document.getElementById('est-tico');
  if(t) t.innerHTML = ticolino(humor || (timerRunning ? 'focado' : 'tranquilo'), 72);
}
function marcarPreset(el){
  document.querySelectorAll('.timer-preset-btn').forEach(function(b){
    var on = b === el;
    b.classList.toggle('active', on);
    if(b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
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
  document.getElementById('timer-label').textContent = 'Digite mm:ss e Enter';
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
    marcarPreset(null);
  }
  cancelInlineEdit();
  updateTimerDisplay();
  updateTimerRing();
  if(total > 0) toast('⏱ Timer: ' + pad(mins) + ':' + pad(secs));
}

function cancelInlineEdit() {
  document.getElementById('timer-display').style.display = 'block';
  document.getElementById('timer-inline-input').style.display = 'none';
  document.getElementById('timer-label').textContent = timerRunning ? 'Estudando…' : 'Toque para editar';
}

// ─── CORES DO TICOLINO (loja) e PACOTES DE NOZES ─────────
// Os marcos de XP deixaram de liberar cores: agora dao pacotes de nozes
// (js/nozes.js), e as cores sao compradas com nozes. Quem ja tinha uma cor
// pelo XP antigo continua com ela (o servidor guardou). As funcoes mantem
// os nomes de antes (renderTrophies, checkTrophyUnlock) porque sao
// chamadas de varios pontos do app.

var corEmVista = null;   // cor mostrada no destaque (a clicada na grade)

// soPintar: repinta sem pedir nada ao servidor (quem chama ja carregou).
function renderTrophies(soPintar) {
  if(!soPintar && typeof carregarNozes === 'function') carregarNozes();
  if(typeof renderPacotes === 'function' && !soPintar) renderPacotes();
  var grid = document.getElementById('trophies-grid');
  if(!grid) return;
  var emUso = minhaCorTico();
  if(!corEmVista) corEmVista = emUso;
  var saldo = (typeof NOZ !== 'undefined' && NOZ.saldo != null) ? NOZ.saldo : null;
  var cadeado = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  // Destaque: a cor em vista, grande, com o que fazer com ela.
  var c = ticoCor(corEmVista);
  var minha = corTenho(c.id), usando = c.id === emUso;
  var dest = document.getElementById('cores-destaque');
  var prox = document.getElementById('cores-proxima');
  if(prox){
    var aComprar = TICO_CORES.filter(function(t){ return t.preco && !corTenho(t.id); });
    prox.textContent = aComprar.length ? 'próxima: ' + nozTxt(aComprar[0].preco) : 'todas são suas';
  }
  if(dest){
    var falta = saldo == null ? 0 : Math.max(0, c.preco - saldo);
    dest.innerHTML =
      '<div class="cores-destaque-tico">' + ticolino('feliz', 72, false, c.id) + '</div>'
      + '<div class="cores-destaque-txt">'
        + '<div class="cores-destaque-nome">' + esc(c.nome) + '</div>'
        + '<div class="cores-destaque-sub">' + (!c.preco ? 'A cor de sempre do Ticolino.'
            : minha ? 'Essa cor é sua.'
            : 'Custa ' + nozTxt(c.preco) + (falta ? '. Faltam ' + nozTxt(falta) + '.' : '.')) + '</div>'
        + (usando ? '<div class="cores-em-uso">' + ico('check', 16, 2.4) + 'Em uso</div>'
            : minha ? '<button type="button" class="md-btn md-btn--primary md-btn--sm" onclick="usarCorTico(\'' + c.id + '\')">Usar esta cor</button>'
            : falta ? '<div class="cores-falta">' + cadeado + 'Junte mais ' + nozTxt(falta) + '</div>'
            : '<button type="button" class="md-btn md-btn--primary md-btn--sm" onclick="comprarCor(\'' + c.id + '\')">'
              + 'Comprar por ' + nozTxt(c.preco) + '</button>')
      + '</div>';
  }

  // A fileira de cores: o rosto do Ticolino em cada cor; as que faltam
  // comprar levam um cadeado no canto.
  grid.innerHTML = TICO_CORES.map(function(t) {
    var ok = corTenho(t.id), uso = t.id === emUso, vista = t.id === corEmVista;
    return '<button type="button" class="cor-card' + (ok ? '' : ' trancada') + (vista ? ' em-vista' : '') + (uso ? ' em-uso' : '') + '"'
      + ' aria-pressed="' + vista + '" onclick="verCorTico(\'' + t.id + '\')"'
      + ' aria-label="' + esc(t.nome) + (uso ? ', em uso' : ok ? ', sua' : ', ' + nozTxt(t.preco)) + '">'
      + '<span class="cor-tico">' + ticolino('feliz', 34, true, t.id) + '</span>'
      + (ok ? '' : '<span class="cor-cadeado">' + cadeado + '</span>')
      + '</button>';
  }).join('');
}

function verCorTico(id){ corEmVista = id; renderTrophies(true); }

function usarCorTico(id){
  var c = ticoCor(id);
  if(!corTenho(c.id)) return;
  if(!state.perfil) state.perfil = {};
  state.perfil.cor = c.id;
  corEmVista = c.id;
  saveState();
  renderTrophies(true);
  updateXPDisplay();                       // rosto do menu lateral
  if(typeof renderHome === 'function') renderHome();
  if(typeof publicarPerfil === 'function') publicarPerfil(true);
  toast('🐹 Ticolino agora está ' + c.nome.toLowerCase() + '!');
}

// Todo ganho de XP passa por aqui: confere se um pacote de nozes ficou pronto.
function checkTrophyUnlock() {
  if(typeof nozConferirPronto === 'function') nozConferirPronto();
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
  marcarPreset(el);
  timerTotal = minutes * 60;
  timerRemaining = timerTotal;
  document.getElementById('custom-timer-wrap').style.display = 'none';
  updateTimerDisplay();
  updateTimerRing();
  pintarBotoesTimer();
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
  marcarPreset(document.querySelector('.est-preset-ed'));
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
  document.getElementById('timer-label').textContent = 'Estudando…';
  pintarBotoesTimer();
  ligarTituloDaAba();
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
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-label').textContent = 'Pausado';
  pintarBotoesTimer('Continuar', 'pausa');
  pintarTituloDaAba();
  updateTimerDisplay();
  updateTimerRing();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRemaining = timerTotal;
  document.getElementById('timer-start-btn').style.display = 'inline-flex';
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-label').textContent = 'Pronto para começar';
  updateTimerDisplay();
  updateTimerRing();
  pintarBotoesTimer('Iniciar sessão');
  pintarTituloDaAba();
}

function timerFinished() {
  document.getElementById('timer-start-btn').style.display = 'inline-flex';
  document.getElementById('timer-pause-btn').style.display = 'none';
  document.getElementById('timer-label').textContent = 'Sessão concluída!';
  pintarBotoesTimer('Iniciar sessão', 'orgulhoso');
  pintarTituloDaAba();
  timerRemaining = 0;
  updateTimerDisplay();
  updateTimerRing();
  playAlertSound();
  var pagos = pomodorosPagosHoje(), ganhou = 0, aviso = '';
  if (timerTotal < POMODORO_MIN_XP) aviso = ' Sessões a partir de 10 min valem XP.';
  else if (pagos.n >= POMODORO_XP_POR_DIA) aviso = ' O XP de pomodoro de hoje já chegou no limite.';
  else { pagos.n++; ganhou = addXP(5); }
  // Sessao de verdade (10 min ou mais) fecha o item "Estudos" do dia.
  var doItem = (timerTotal >= POMODORO_MIN_XP && typeof marcarItemPorAtividade === 'function') ? marcarItemPorAtividade('estudo') : 0;
  if (doItem) { ganhou += doItem; aviso += ' Item de estudos do dia concluído.'; }
  if (typeof registrarEstudo === 'function') registrarEstudo(Math.round(timerTotal / 60));
  // Sessao de verdade com materia escolhida conta no plano da semana.
  if (timerTotal >= POMODORO_MIN_XP && typeof registrarSessaoMateria === 'function') registrarSessaoMateria(Math.round(timerTotal / 60));
  todaySessions++;
  state.studyXP = studyXP;
  state.todaySessions = todaySessions;
  state.sessionDate = new Date().toDateString();
  saveState();
  updateSessionDots();
  if (typeof renderPlanoEstudos === 'function') renderPlanoEstudos();
  toast('🎉 Sessão concluída!' + (ganhou ? ' +' + ganhou + ' XP.' : '') + aviso);
  setTimeout(function() {
    if (timerRunning) return;
    timerRemaining = timerTotal;
    document.getElementById('timer-label').textContent = 'Pronto para começar';
    updateTimerDisplay();
    updateTimerRing();
    pintarBotoesTimer('Iniciar sessão');
  }, 3000);
}

function updateTimerDisplay() {
  var dispEl = document.getElementById('timer-display'); if(!dispEl) return;
  var m = Math.floor(timerRemaining / 60);
  var s = timerRemaining % 60;
  dispEl.textContent = pad(m) + ':' + pad(s);
}

function updateTimerRing() {
  var circumference = 578;   // 2 x pi x 92, o raio do anel
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

// Devolve quanto XP entrou de fato — quem paga guarda esse valor para, ao
// desfazer, tirar exatamente o mesmo (com exato=true, sem dobrar de novo).
function addXP(amount, exato) {
  // O XP em dobro do Ticolino Max vale para tudo que da XP: pomodoro,
  // itens do dia e treinos. Dobrar aqui, na porta unica, evita ter que
  // lembrar de dobrar em cada um deles.
  if (!exato && typeof xpEmDobro === 'function' && xpEmDobro()) amount = amount * 2;
  var previousXP = studyXP;
  studyXP = Math.max(0, studyXP + amount);
  amount = studyXP - previousXP;
  if (!amount) return 0;
  // Passa tambem pelo historico: o studyXP e so o acumulado da vida toda, e
  // o Resumo de atividades precisa saber quanto entrou em cada dia.
  if (typeof registrarXP === 'function') registrarXP(amount);
  updateXPDisplay();
  checkTrophyUnlock();
  if (typeof renderPacotes === 'function') renderPacotes();
  // persist XP
  if(state) {
    state.studyXP = studyXP;
    saveState();
  }
  return amount;
}

// Pomodoro so paga XP se a sessao tiver tamanho de estudo de verdade e ate
// um teto por dia. Sem isso, um timer de 1 segundo repetido virava XP
// infinito.
var POMODORO_MIN_XP = 10 * 60;     // segundos
var POMODORO_XP_POR_DIA = 12;      // sessoes que pagam XP (12 x 25 min = 5 h)
function pomodorosPagosHoje() {
  var hoje = new Date().toDateString();
  if (!state.xpPomodoro || state.xpPomodoro.data !== hoje) state.xpPomodoro = { data: hoje, n: 0 };
  return state.xpPomodoro;
}

function updateXPDisplay() {
  var xpPerLevel = 100;
  studyLevel = Math.floor(studyXP / xpPerLevel) + 1;
  var xpInLevel = studyXP % xpPerLevel;
  var pct = (xpInLevel / xpPerLevel) * 100;
  var el = document.getElementById('estudos-xp-display');
  if (el) el.textContent = studyXP.toLocaleString('pt-BR');
  var lv = document.getElementById('xp-level');
  if (lv) lv.textContent = studyLevel;
  var xh = document.getElementById('est-xp-hoje');
  if (xh) {
    var linha = (state.historico && typeof hojeStr === 'function') ? state.historico[hojeStr()] : null;
    xh.textContent = ((linha && linha.x) || 0).toLocaleString('pt-BR');
  }
  pintarLinhaEstudos();

  // Cartao de nivel no pe do menu lateral (design system).
  var nn = document.getElementById('nav-nivel-nome');
  if (nn) {
    nn.textContent = (state.perfil && state.perfil.name) || T('voce');
    var nx2 = document.getElementById('nav-nivel-xp');
    if (nx2) nx2.textContent = T('level') + ' ' + studyLevel + ' · ' + studyXP + ' XP';
    var nf = document.getElementById('nav-nivel-fill');
    if (nf) nf.style.width = pct + '%';
    if (typeof pintarRostoMenu === 'function') pintarRostoMenu();
    var nr = document.getElementById('nav-nivel-rosto');
    if (nr) nr.innerHTML = ticolino('feliz', 34, true);
  }
}

// Sessoes de hoje e quanto falta para o proximo nivel, numa linha so.
function pintarLinhaEstudos() {
  var el = document.getElementById('est-linha');
  if (!el) return;
  var falta = 100 - (studyXP % 100);
  el.textContent = (todaySessions ? todaySessions + (todaySessions === 1 ? ' sessão hoje' : ' sessões hoje') : 'Nenhuma sessão hoje')
    + ' · faltam ' + falta + ' XP para o nível ' + (studyLevel + 1);
}
function updateSessionDots() { pintarLinhaEstudos(); }
