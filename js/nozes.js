// NOZES — o saldo, os pacotes de nozes (que substituem os marcos de XP) e a
// loja de cores do Ticolino.
//
// COMO FUNCIONA
// Cada pacote pede o dobro de XP do anterior (50, 100, 200, 400...) e vale
// 50 nozes a mais (50, 100, 150...). A imagem sobe de patamar a cada pacote:
// punhado, pote, cesta, amontoado, caminhao, navio e, dai em diante, a
// fabrica. O XP conta a partir do dia em que os pacotes chegaram.
//
// Quem decide e o SERVIDOR (supabase/migrations/20261009120000_*): o app
// so pergunta se ha pacote pronto (meus_pacotes), pede para coletar
// (coletar_pacote) e para comprar cor (comprar_cor). Daqui so sai tela.
//
// Depende de: sb, currentUser, state (config.js), esc/toast/ticolino/
// TICO_CORES/ticoCor (helpers.js), studyXP/saveState, launchConfetti
// (estudos.js), goToPage (nav.js).

var NOZ = {
  saldo: null,       // nozes na carteira (null = ainda nao carregou)
  pac: null,         // resposta de meus_pacotes()
  cores: null,       // cores compradas (lista de ids)
  carregando: null,
  ultimaCarga: 0,
  avisadoNivel: -1,  // o pop-up de "pacote pronto" sai uma vez por pacote
  coletando: false
};

var NOZ_PATAMARES = [
  { nome: 'Um punhado de nozes', curto: 'Punhado' },
  { nome: 'Um pote de vidro cheio', curto: 'Pote de vidro' },
  { nome: 'Uma cesta de nozes', curto: 'Cesta' },
  { nome: 'Um amontoado de nozes', curto: 'Amontoado' },
  { nome: 'Um caminhão de nozes', curto: 'Caminhão' },
  { nome: 'Um navio cargueiro', curto: 'Navio' },
  { nome: 'A fábrica de nozes', curto: 'Fábrica' }
];
var NOZ_ICONE = '<svg class="noz-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4.5 0 8 3 8 7H4c0-4 3.5-7 8-7z"/><path d="M5 10c0 6 3 11 7 11s7-5 7-11"/><path d="M12 3v2"/></svg>';

// As contas do servidor, repetidas aqui so para desenhar a trilha.
function nozMarco(n){ return 50 * (Math.pow(2, n + 1) - 1); }   // XP acumulado para o pacote n
function nozValor(n){ return 50 * (n + 1); }
function nozPatamar(n){ return Math.min(n, 6); }
function nozTxt(q){ q = Number(q) || 0; return q.toLocaleString('pt-BR') + (q === 1 ? ' noz' : ' nozes'); }

// ── Carga ───────────────────────────────────────────────────────────────
function carregarNozes(forcar){
  if(typeof currentUser === 'undefined' || !currentUser || typeof sb === 'undefined') return Promise.resolve();
  if(NOZ.carregando) return NOZ.carregando;
  if(!forcar && Date.now() - NOZ.ultimaCarga < 30000) return Promise.resolve();
  NOZ.ultimaCarga = Date.now();   // conta a tentativa: sem rede, nao insiste a cada XP
  NOZ.carregando = (async function(){
    try {
      var r = await Promise.all([
        sb.rpc('meus_pacotes'),
        sb.from('cores_compradas').select('cor').eq('user_id', currentUser.id)
      ]);
      if(r[0].error) throw r[0].error;
      NOZ.pac = r[0].data;
      NOZ.saldo = NOZ.pac ? NOZ.pac.saldo : NOZ.saldo;
      if(!r[1].error){
        NOZ.cores = (r[1].data || []).map(function(x){ return x.cor; });
        // Copia para abrir o app ja com a cor certa, antes desta carga.
        if(state) state.coresCompradas = NOZ.cores.slice();
      }
    } catch(e) {
      console.warn('nozes: carga falhou', e);
    } finally {
      NOZ.carregando = null;
    }
    pintarNozes();
    nozConferirPronto();
  })();
  return NOZ.carregando;
}

// Saldo mudou (presente, aposta, pacote, compra): todo contador repinta.
function nozDefinirSaldo(s){
  if(s == null) return;
  NOZ.saldo = Math.max(0, Number(s) || 0);
  if(NOZ.pac) NOZ.pac.saldo = NOZ.saldo;
  if(typeof AMZ !== 'undefined') AMZ.saldo = NOZ.saldo;
  pintarNozes();
}

function pintarNozes(){
  var txt = NOZ.saldo == null ? '—' : Number(NOZ.saldo).toLocaleString('pt-BR');
  document.querySelectorAll('.noz-saldo-num').forEach(function(el){ el.textContent = txt; });
  document.querySelectorAll('.noz-saldo-rot').forEach(function(el){ el.textContent = NOZ.saldo === 1 ? 'noz' : 'nozes'; });
  if(document.getElementById('pac-destaque')) renderPacotes();
  if(document.getElementById('trophies-grid') && typeof renderTrophies === 'function') renderTrophies(true);
}

// ── Pacote pronto? ──────────────────────────────────────────────────────
// Conta feita com o XP deste aparelho (o servidor confere ao coletar).
function nozGanhoLocal(){
  if(!NOZ.pac) return 0;
  var xp = (typeof studyXP === 'number') ? studyXP : 0;
  return Math.max(Number(NOZ.pac.ganho) || 0, xp - (Number(NOZ.pac.xp_base) || 0));
}
function nozProntoLocal(){
  return !!NOZ.pac && nozGanhoLocal() >= nozMarco(NOZ.pac.nivel);
}
// Chamado depois de todo ganho de XP (addXP -> checkTrophyUnlock).
function nozConferirPronto(){
  if(!NOZ.pac || NOZ.coletando || !nozProntoLocal()) return;
  if(document.getElementById('pac-destaque')) renderPacotes();
  if(NOZ.avisadoNivel === NOZ.pac.nivel) return;
  NOZ.avisadoNivel = NOZ.pac.nivel;
  setTimeout(function(){ nozAbrirPacote(); }, 900);
}

// ── Pop-up do pacote ────────────────────────────────────────────────────
function nozPopup(){
  var el = document.getElementById('pacote-overlay');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'pacote-overlay';
  el.className = 'pacote-overlay';
  el.hidden = true;
  el.innerHTML = '<div class="pacote-pop" role="dialog" aria-modal="true" aria-labelledby="pacote-titulo">'
    + '<div class="pacote-palco" id="pacote-palco"></div>'
    + '<div class="pacote-rotulo" id="pacote-rotulo"></div>'
    + '<h3 class="pacote-titulo" id="pacote-titulo"></h3>'
    + '<div class="pacote-valor" id="pacote-valor"></div>'
    + '<p class="pacote-nota" id="pacote-nota"></p>'
    + '<button type="button" class="btn btn-primary pacote-bt" id="pacote-bt"></button>'
    + '<button type="button" class="pacote-depois" id="pacote-depois" onclick="nozFecharPacote()">Depois</button>'
    + '</div>';
  el.addEventListener('click', function(e){ if(e.target === el) nozFecharPacote(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !el.hidden) nozFecharPacote(); });
  document.body.appendChild(el);
  return el;
}

function nozAbrirPacote(){
  if(!NOZ.pac || !nozProntoLocal()) return;
  var n = NOZ.pac.nivel, p = nozPatamar(n), el = nozPopup();
  document.getElementById('pacote-palco').innerHTML = nozArte(p, { grande: true });
  document.getElementById('pacote-rotulo').textContent = n > 6 ? 'A fábrica produziu mais nozes' : (n ? 'Novo patamar' : 'Seu primeiro pacote');
  document.getElementById('pacote-titulo').textContent = n > 6 ? 'Mais um lote da fábrica' : NOZ_PATAMARES[p].nome;
  document.getElementById('pacote-valor').innerHTML = NOZ_ICONE + '<span>' + nozTxt(nozValor(n)) + '</span>';
  document.getElementById('pacote-nota').textContent = 'Você juntou ' + nozMarco(n).toLocaleString('pt-BR') + ' XP desde que os pacotes chegaram.';
  var bt = document.getElementById('pacote-bt');
  bt.disabled = false;
  bt.textContent = 'Coletar ' + nozTxt(nozValor(n));
  bt.onclick = nozColetar;
  document.getElementById('pacote-depois').hidden = false;
  el.classList.remove('coletado');
  el.hidden = false;
  requestAnimationFrame(function(){ el.classList.add('aberto'); bt.focus(); });
}

function nozFecharPacote(){
  var el = document.getElementById('pacote-overlay');
  if(!el || el.hidden) return;
  el.classList.remove('aberto');
  el.hidden = true;
  if(typeof stopConfetti === 'function'){
    var c = document.getElementById('confetti-canvas');
    if(c){ c.style.display = 'none'; stopConfetti(); }
  }
  if(document.getElementById('pac-destaque')) renderPacotes();
}

async function nozColetar(){
  if(NOZ.coletando) return;
  NOZ.coletando = true;
  var bt = document.getElementById('pacote-bt');
  if(bt){ bt.disabled = true; bt.textContent = 'Abrindo…'; }
  try {
    // O servidor le o XP do que esta salvo: grava antes de pedir.
    if(typeof saveState === 'function') { try { await saveState(); } catch(e) {} }
    var r = await sb.rpc('coletar_pacote');
    if(r.error) throw r.error;
    var d = r.data || {};
    NOZ.pac = d;
    nozDefinirSaldo(d.saldo);
    if(d.r !== 'ok'){
      var falta = Math.max(0, (Number(d.marco) || 0) - (Number(d.ganho) || 0));
      nozFecharPacote();
      toast(falta ? '🌰 Quase lá: faltam ' + falta + ' XP para este pacote (o limite é de 200 XP por dia).'
                  : '🌰 Esse pacote já foi coletado.');
      return;
    }
    nozCelebrar(d);
  } catch(e) {
    console.warn('nozes: coletar falhou', e);
    if(bt){ bt.disabled = false; bt.textContent = 'Tentar de novo'; }
    toast('⚠️ Sem conexão com o servidor. Tente de novo em instantes.');
  } finally {
    NOZ.coletando = false;
  }
}

// Depois de coletar: a animacao do patamar, confete e o numero subindo.
function nozCelebrar(d){
  var el = nozPopup(), p = Number(d.coletado_patamar) || 0;
  var palco = document.getElementById('pacote-palco');
  palco.innerHTML = nozArte(p, { grande: true, anima: !menosMovimentoNoz() });
  el.classList.add('coletado', 'aberto');
  el.hidden = false;
  document.getElementById('pacote-titulo').textContent = Number(d.coletado_nivel) > 6 ? 'Mais um lote da fábrica' : NOZ_PATAMARES[p].nome;
  document.getElementById('pacote-rotulo').textContent = 'Uhull! Pacote coletado';
  document.getElementById('pacote-valor').innerHTML = NOZ_ICONE + '<span>+' + nozTxt(d.coletado_nozes) + '</span>';
  document.getElementById('pacote-nota').textContent = 'Agora você tem ' + nozTxt(d.saldo) + '. O próximo pacote pede '
    + (nozMarco(d.nivel) - nozMarco(d.nivel - 1)).toLocaleString('pt-BR') + ' XP.';
  document.getElementById('pacote-depois').hidden = true;
  var bt = document.getElementById('pacote-bt');
  bt.disabled = false;
  if(d.pronto){
    bt.textContent = 'Abrir o próximo pacote';
    bt.onclick = function(){ NOZ.avisadoNivel = NOZ.pac.nivel; nozAbrirPacote(); };
  } else {
    bt.textContent = 'Oba!';
    bt.onclick = nozFecharPacote;
  }
  bt.focus();
  var c = document.getElementById('confetti-canvas');
  if(c && typeof launchConfetti === 'function' && !menosMovimentoNoz()){ c.style.display = 'block'; launchConfetti(); }
}

function menosMovimentoNoz(){
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// ── Estudos: o pacote da vez e a trilha dos patamares ───────────────────
function renderPacotes(){
  var dest = document.getElementById('pac-destaque'), trilha = document.getElementById('pac-trilha');
  if(!dest || !trilha) return;
  if(!NOZ.pac){
    dest.innerHTML = '<p class="pac-carregando">Carregando seus pacotes…</p>';
    trilha.innerHTML = '';
    carregarNozes();
    return;
  }
  var n = NOZ.pac.nivel, p = nozPatamar(n);
  var ant = n ? nozMarco(n - 1) : 0, marco = nozMarco(n), passo = marco - ant;
  var ganho = nozGanhoLocal(), feito = Math.max(0, Math.min(passo, ganho - ant));
  var pronto = ganho >= marco, pct = Math.round(feito / passo * 100);

  dest.innerHTML = '<div class="pac-arte">' + nozArte(p) + '</div>'
    + '<div class="pac-info">'
      + '<div class="pac-rot">' + (pronto ? 'Pacote pronto!' : 'Próximo pacote') + '</div>'
      + '<div class="pac-nome">' + esc(n > 6 ? 'Mais um lote da fábrica' : NOZ_PATAMARES[p].nome) + '</div>'
      + '<div class="pac-valor">' + NOZ_ICONE + nozTxt(nozValor(n)) + '</div>'
      + '<div class="progress-bar-track pac-barra" role="progressbar" aria-valuemin="0" aria-valuemax="' + passo + '" aria-valuenow="' + feito + '" aria-label="XP para o próximo pacote">'
        + '<div class="progress-bar-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="pac-falta">' + (pronto ? 'Toque para abrir e guardar as nozes.'
          : 'Faltam ' + (passo - feito).toLocaleString('pt-BR') + ' XP · ' + feito.toLocaleString('pt-BR') + ' de ' + passo.toLocaleString('pt-BR')) + '</div>'
      + (pronto ? '<button type="button" class="btn btn-primary pac-bt" onclick="nozAbrirPacote()">Abrir pacote</button>' : '')
    + '</div>';

  trilha.innerHTML = NOZ_PATAMARES.map(function(t, i){
    var fabrica = i === 6;
    var coletado = fabrica ? n > 6 : n > i;
    var atual = fabrica ? n >= 6 : n === i;
    var estado = coletado && !atual ? 'pac-feito' : atual ? 'pac-atual' : 'pac-bloq';
    var sub = fabrica && n > 6 ? (n - 6) + (n - 6 === 1 ? ' lote' : ' lotes')
            : estado === 'pac-feito' ? 'Coletado'
            : (50 * Math.pow(2, i)).toLocaleString('pt-BR') + ' XP';   // o que esse pacote pede
    return '<div class="pac-tile ' + estado + '">'
      + (estado === 'pac-feito' ? '<span class="pac-check" aria-hidden="true">✓</span>' : '')
      + '<span class="pac-tile-arte">' + nozArte(i) + '</span>'
      + '<span class="pac-tile-nome">' + t.curto + '</span>'
      + '<span class="pac-tile-valor">' + NOZ_ICONE + nozValor(i) + (fabrica ? '+' : '') + '</span>'
      + '<span class="pac-tile-sub">' + sub + '</span>'
    + '</div>';
  }).join('');
}

// Atalho do Perfil: abre Estudos ja na secao pedida.
function nozIrPara(id){
  if(typeof goToPage === 'function') goToPage('estudos');
  setTimeout(function(){
    var el = document.getElementById(id);
    if(el && el.scrollIntoView) el.scrollIntoView({ behavior: menosMovimentoNoz() ? 'auto' : 'smooth', block: 'start' });
  }, 80);
}

// ── Loja de cores ───────────────────────────────────────────────────────
function comprarCor(id){
  var c = ticoCor(id);
  if(!c.preco || corTenho(id)) return;
  if(NOZ.saldo != null && NOZ.saldo < c.preco){ toast('🌰 Faltam ' + nozTxt(c.preco - NOZ.saldo) + ' para essa cor.'); return; }
  document.getElementById('confirm-icon').textContent = '🌰';
  document.getElementById('confirm-title').textContent = 'Comprar ' + c.nome.toLowerCase() + '?';
  document.getElementById('confirm-body').textContent = 'Custa ' + nozTxt(c.preco) + '. A cor fica sua para sempre.';
  var ok = document.getElementById('confirm-ok-btn');
  ok.textContent = 'Comprar';
  ok.onclick = function(){
    closeModal('modal-confirm');
    if(typeof resetConfirmBtn === 'function') resetConfirmBtn();
    nozConfirmarCompra(id);
  };
  openModal('modal-confirm');
}

var _comprando = false;
async function nozConfirmarCompra(id){
  if(_comprando) return;
  _comprando = true;
  try {
    var r = await sb.rpc('comprar_cor', { p_cor: id });
    if(r.error) throw r.error;
    if(r.data === 'ok' || r.data === 'ja_tem'){
      if(!NOZ.cores) NOZ.cores = [];
      if(NOZ.cores.indexOf(id) === -1) NOZ.cores.push(id);
      if(state) state.coresCompradas = NOZ.cores.slice();
      await carregarNozes(true);
      if(typeof usarCorTico === 'function') usarCorTico(id);
    } else if(r.data === 'sem_saldo'){
      toast('🌰 Você não tem nozes suficientes para essa cor.');
      carregarNozes(true);
    } else {
      toast('⚠️ Não deu para comprar agora. Tente de novo em instantes.');
    }
  } catch(e) {
    console.warn('nozes: compra falhou', e);
    toast('⚠️ Sem conexão com o servidor. Tente de novo em instantes.');
  } finally {
    _comprando = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AS ILUSTRACOES — uma por patamar, em SVG, no traco chapado do Ticolino.
// Com { anima: true } as pecas ganham a classe que dispara a animacao do
// pop-up (styles/nozes.css). As pecas animadas ficam numa <g> de fora e o
// desenho numa <g> de dentro: animar o transform de um elemento SVG apaga
// o transform="..." que o posiciona.
// ═══════════════════════════════════════════════════════════════════════
function nozSvg(x, y, s, r){
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (r || 0) + ') scale(' + s + ')">'
    + '<path d="M-9 -2C-9 9-4 15 0 15C4 15 9 9 9-2Z" fill="#C98A4B"/>'
    + '<path d="M3-1C3 8 1 12 0 15C4 14 9 8 9-1Z" fill="#A86A33"/>'
    + '<ellipse cx="-4" cy="4" rx="1.7" ry="3.2" fill="#E8BE88" opacity=".75"/>'
    + '<path d="M-10.5 0C-10.5-7.5-5.5-11 0-11C5.5-11 10.5-7.5 10.5 0Z" fill="#6E4425"/>'
    + '<path d="M-6.5-6.5H6.5M-9-3H9" stroke="#8D5C34" stroke-width="1.3" stroke-linecap="round"/>'
    + '<path d="M0-11V-15" stroke="#4E2F18" stroke-width="2.4" stroke-linecap="round"/>'
    + '</g>';
}
// Noz com uma <g> por fora para animar (classe e atraso).
function nozPeca(cls, d, x, y, s, r){
  return '<g class="' + cls + '" style="--d:' + d + 's">' + nozSvg(x, y, s, r) + '</g>';
}
// Noz pequenininha, so contorno, para o desenho dos conteineres.
function nozMini(x, y){
  return '<g transform="translate(' + x + ' ' + y + ')" fill="#FFF8EA" opacity=".92">'
    + '<path d="M-3.4 0C-3.4-2.6-1.9-3.8 0-3.8C1.9-3.8 3.4-2.6 3.4 0Z"/>'
    + '<path d="M-2.9 .6C-2.9 3.6-1.3 5.2 0 5.2C1.3 5.2 2.9 3.6 2.9 .6Z"/></g>';
}
function nozSombra(cx, cy, rx){
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="7" fill="#000" opacity=".16"/>';
}

var NOZ_DESENHOS = [
  // 0 — Um punhado: cinco nozes numa folha.
  function(){
    var h = nozSombra(122, 150, 80)
      + '<path d="M40 142C64 104 174 98 206 134C176 160 72 162 40 142Z" fill="#5E9E77"/>'
      + '<path d="M50 141C96 128 150 124 198 134" stroke="#3F7A57" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M96 132l-12-12M126 128l-6-14M156 129l4-14" stroke="#3F7A57" stroke-width="2" stroke-linecap="round"/>';
    [[94, 126, 1.35, -16, 0], [122, 130, 1.4, 6, .12], [150, 125, 1.35, 18, .24], [108, 104, 1.35, -6, .36], [137, 103, 1.35, 12, .48]]
      .forEach(function(n){ h += nozPeca('nz-cai', n[4], n[0], n[1], n[2], n[3]); });
    return h;
  },
  // 1 — Pote de vidro: as nozes caem dentro e a tampa fecha.
  function(){
    var h = nozSombra(120, 157, 62);
    [[92, 140, 1.2, -10], [114, 141, 1.2, 8], [136, 140, 1.2, -4], [156, 139, 1.2, 14],
     [102, 120, 1.2, 12], [124, 121, 1.2, -12], [146, 120, 1.2, 6], [113, 100, 1.2, -6], [136, 100, 1.2, 10]]
      .forEach(function(n, i){ h += nozPeca('nz-cai', (i * .1).toFixed(2), n[0], n[1], n[2], n[3]); });
    h += '<path d="M78 60Q74 60 74 68V142Q74 157 90 157H150Q166 157 166 142V68Q166 60 162 60Z" fill="#CFE8EF" fill-opacity=".28" stroke="#A9CBD6" stroke-width="3"/>'
      + '<rect x="84" y="46" width="72" height="16" rx="4" fill="#CFE8EF" fill-opacity=".35" stroke="#A9CBD6" stroke-width="3"/>'
      + '<path d="M86 74V136M98 74V90" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".5"/>'
      + '<rect x="98" y="122" width="44" height="24" rx="4" fill="#F3E7C4" stroke="#D8C79A" stroke-width="1.5"/>'
      + nozSvg(120, 132, .55, 0)
      + '<g class="nz-tampa"><rect x="80" y="30" width="80" height="18" rx="5" fill="#D9822B"/>'
      + '<rect x="84" y="32" width="72" height="4" rx="2" fill="#F0A24E"/>'
      + '<path d="M92 41H148" stroke="#B5661B" stroke-width="2" stroke-linecap="round"/></g>';
    return h;
  },
  // 2 — Cesta: a cesta pula e as nozes saltam la de dentro.
  function(){
    var h = nozSombra(120, 162, 72)
      + '<g class="nz-cesta">'
      + '<path d="M66 100C66 28 174 28 174 100" stroke="#9C6A35" stroke-width="8" fill="none" stroke-linecap="round"/>'
      + '<path d="M66 100C66 34 174 34 174 100" stroke="#C08A4E" stroke-width="2.5" fill="none"/>';
    [[86, 92, 1.25, -14], [106, 88, 1.25, 6], [126, 86, 1.25, -6], [146, 88, 1.25, 12], [164, 93, 1.2, 20],
     [96, 72, 1.25, -8], [118, 68, 1.25, 10], [140, 71, 1.25, -12], [128, 52, 1.25, 4]]
      .forEach(function(n, i){ h += nozPeca('nz-pula', (i * .07).toFixed(2), n[0], n[1], n[2], n[3]); });
    h += '<path d="M56 96H184L170 156Q168 160 162 160H78Q72 160 70 156Z" fill="#C99355"/>'
      + '<path d="M60 112H180M63 128H177M67 144H173" stroke="#A8743A" stroke-width="2.5"/>'
      + '<path d="M80 98L84 158M100 98L102 158M120 98V158M140 98L138 158M160 98L156 158" stroke="#A8743A" stroke-width="2" opacity=".6"/>'
      + '<rect x="50" y="89" width="140" height="13" rx="6.5" fill="#9C6A35"/>'
      + '<path d="M58 93H182" stroke="#C08A4E" stroke-width="2" stroke-linecap="round"/>'
      + '</g>';
    return h;
  },
  // 3 — Amontoado: a pilha se forma de baixo para cima.
  function(){
    var h = nozSombra(120, 158, 92), fileiras = [[148, 7], [128, 6], [108, 5], [88, 4], [68, 3], [48, 2], [28, 1]], k = 0;
    fileiras.forEach(function(f, linha){
      var y = f[0], qtd = f[1], x0 = 120 - (qtd - 1) * 10.5;
      for(var i = 0; i < qtd; i++){
        h += nozPeca('nz-cai', (linha * .14 + i * .03).toFixed(2), x0 + i * 21, y, 1.05, ((k++ * 37) % 30) - 15);
      }
    });
    h += nozSvg(34, 152, .9, -40) + nozSvg(206, 150, .9, 50);
    return h;
  },
  // 4 — Caminhao: chega, vira a cacamba e as nozes escorregam para o chao.
  function(){
    var h = nozSombra(124, 160, 98) + '<g class="nz-chao">';
    [[30, 150, 1, -30, 0], [48, 152, 1, 20, .08], [20, 154, .95, 60, .16], [40, 138, 1, -10, .24], [60, 154, .9, 35, .3]]
      .forEach(function(n){ h += nozPeca('nz-despeja', n[4], n[0], n[1], n[2], n[3]); });
    h += '</g><g class="nz-caminhao">'
      + '<rect x="40" y="118" width="168" height="12" rx="3" fill="#3B403A"/>'
      + '<g class="nz-cacamba">';
    [[60, 66, 1.15, -10], [80, 62, 1.15, 8], [100, 60, 1.15, -6], [120, 62, 1.15, 14], [140, 66, 1.15, -12],
     [72, 47, 1.15, 6], [92, 43, 1.15, -14], [112, 45, 1.15, 10], [132, 49, 1.15, -4], [102, 28, 1.15, 12]]
      .forEach(function(n, i){ h += nozPeca('nz-escorrega', (i * .04).toFixed(2), n[0], n[1], n[2], n[3]); });
    h += '<path d="M44 74H160L156 118H48Z" fill="#5C8C70"/>'
      + '<path d="M70 76V116M95 76V116M120 76V116M145 76V116" stroke="#4A735B" stroke-width="3"/>'
      + '<rect x="40" y="69" width="124" height="8" rx="2" fill="#4A735B"/>'
      + '</g>'
      + '<path d="M166 82H192Q200 82 204 92L212 108V128H166Z" fill="#EB7D00"/>'
      + '<path d="M174 88H190Q195 88 198 95L203 106H174Z" fill="#BFE0EA"/>'
      + '<path d="M170 112H186" stroke="#B85F00" stroke-width="2.5" stroke-linecap="round"/>'
      + '<rect x="206" y="118" width="9" height="10" rx="2" fill="#3B403A"/>'
      + '<circle cx="210" cy="112" r="3" fill="#FFE08A"/>'
      + '<circle cx="78" cy="132" r="15" fill="#2A2D29"/><circle cx="78" cy="132" r="6" fill="#9A9E96"/>'
      + '<circle cx="108" cy="132" r="15" fill="#2A2D29"/><circle cx="108" cy="132" r="6" fill="#9A9E96"/>'
      + '<circle cx="188" cy="132" r="15" fill="#2A2D29"/><circle cx="188" cy="132" r="6" fill="#9A9E96"/>'
      + '</g>';
    return h;
  },
  // 5 — Navio cargueiro: navega, balanca e um conteiner cai no mar.
  function(){
    var cores = ['#D9533B', '#3E7FA8', '#E8B53B', '#4E8F69', '#EB7D00', '#6FA9C9'];
    var cont = function(x, y, cor){
      return '<rect x="' + x + '" y="' + y + '" width="26" height="16" rx="1.5" fill="' + cor + '"/>'
        + '<path d="M' + (x + 6) + ' ' + (y + 2) + 'V' + (y + 14) + 'M' + (x + 20) + ' ' + (y + 2) + 'V' + (y + 14) + '" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>'
        + nozMini(x + 13, y + 8);
    };
    var h = '<g class="nz-navio"><g class="nz-balanca">'
      + '<rect x="32" y="56" width="34" height="44" rx="2" fill="#EDEAE0"/>'
      + '<rect x="36" y="62" width="26" height="7" rx="1" fill="#3E7FA8"/>'
      + '<rect x="36" y="74" width="26" height="5" rx="1" fill="#3E7FA8" opacity=".6"/>'
      + '<rect x="42" y="40" width="12" height="18" fill="#C8412E"/><rect x="42" y="40" width="12" height="4" fill="#24384F"/>';
    [70, 97, 124, 151, 178].forEach(function(x, i){ h += cont(x, 82, cores[i]); });
    [83, 110, 137].forEach(function(x, i){ h += cont(x, 66, cores[(i + 3) % 6]); });
    h += cont(97, 50, cores[2]) + cont(124, 50, cores[5])
      + '<g class="nz-conteiner">' + cont(164, 66, cores[2]) + '</g>'
      + '<path d="M18 98H222L208 132Q206 138 198 138H44Q37 138 34 132Z" fill="#24384F"/>'
      + '<path d="M26 118H214L208 132Q206 138 198 138H44Q37 138 34 132Z" fill="#C8412E"/>'
      + '<rect x="18" y="96" width="204" height="5" rx="1" fill="#E9E6DA"/>'
      + '<circle cx="200" cy="108" r="3.2" fill="#E9E6DA"/>'
      + '</g></g>'
      + '<g class="nz-respingo" opacity="0"><path d="M206 132q-6-14-2-22M214 132q2-16 8-20M222 132q8-10 14-10" stroke="#CFE8EF" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<circle cx="204" cy="106" r="2.5" fill="#CFE8EF"/><circle cx="226" cy="110" r="2" fill="#CFE8EF"/></g>'
      + '<g class="nz-onda"><path d="M-40 130Q-20 124 0 130T40 130T80 130T120 130T160 130T200 130T240 130T280 130V180H-40Z" fill="#3E7FA8"/>'
      + '<path d="M-40 142Q-20 137 0 142T40 142T80 142T120 142T160 142T200 142T240 142T280 142V180H-40Z" fill="#2F6A8F"/>'
      + '<path d="M-30 152h30M50 160h40M130 152h36M196 162h30" stroke="#5C9CC2" stroke-width="3" stroke-linecap="round"/></g>';
    return h;
  },
  // 6 — Fabrica: chamines soltando fumaca e nozes saindo na esteira.
  // Desenhada 14 px mais baixa para a fumaca ter onde subir.
  function(){
    var h = '<g transform="translate(0 14)">' + nozSombra(122, 152, 96);
    [[167, 26, 0], [164, 18, .8], [170, 22, 1.6], [190, 40, .4], [187, 32, 1.2], [193, 36, 2]].forEach(function(f){
      h += '<g class="nz-fumaca" style="--d:' + f[2] + 's"><circle cx="' + f[0] + '" cy="' + f[1] + '" r="8" fill="#D6D2C6" opacity=".9"/></g>';
    });
    h += '<rect x="160" y="30" width="14" height="58" fill="#8A5A33"/><rect x="160" y="38" width="14" height="5" fill="#C8412E"/>'
      + '<rect x="184" y="44" width="12" height="44" fill="#8A5A33"/><rect x="184" y="50" width="12" height="5" fill="#C8412E"/>'
      + '<path d="M44 86V64L84 86V64L124 86V64L164 86V86Z" fill="#6E4425"/>'
      + '<path d="M44 64L84 86M84 64L124 86M124 64L164 86" stroke="#8D5C34" stroke-width="2"/>'
      + '<rect x="44" y="86" width="160" height="60" fill="#D98C4A"/>'
      + '<rect x="44" y="86" width="160" height="6" fill="#B5733A"/>'
      + '<rect x="54" y="100" width="16" height="16" rx="2" fill="#F6D27A"/><rect x="76" y="100" width="16" height="16" rx="2" fill="#F6D27A"/>'
      + '<path d="M62 100V116M54 108H70M84 100V116M76 108H92" stroke="#D9A94A" stroke-width="1.5"/>'
      + '<rect x="100" y="116" width="22" height="30" rx="2" fill="#6E4425"/>'
      + '<circle cx="160" cy="114" r="21" fill="#F3E7C4" stroke="#B5733A" stroke-width="3"/>'
      + nozSvg(160, 115, 1.05, 0)
      + '<rect x="4" y="136" width="44" height="6" rx="3" fill="#3B403A"/>'
      + '<circle cx="12" cy="145" r="3" fill="#3B403A"/><circle cx="26" cy="145" r="3" fill="#3B403A"/><circle cx="40" cy="145" r="3" fill="#3B403A"/>';
    [[40, 126, 0], [24, 126, .7], [8, 126, 1.4]].forEach(function(n){ h += nozPeca('nz-esteira', n[2], n[0], n[1], .8, 0); });
    return h + '</g>';
  }
];

function nozArte(p, o){
  o = o || {};
  p = Math.max(0, Math.min(6, p | 0));
  return '<svg class="noz-arte noz-p' + p + (o.anima ? ' anima' : '') + (o.grande ? ' grande' : '') + '" viewBox="0 0 240 180"'
    + ' role="img" aria-label="' + NOZ_PATAMARES[p].nome + '">' + NOZ_DESENHOS[p]() + '</svg>';
}
