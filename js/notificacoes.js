// NOTIFICACOES — o sininho da Home.
//
// Toda notificacao do app mora na tabela notificacoes: pedidos e aceites de
// amizade, cutucoes e presentes (criados pelas funcoes do banco) e os
// lembretes, avisos de tarefa e de fim do teste (criados pela funcao
// enviar-lembretes). Cada uma some depois de 1 dia: o app so busca as
// ultimas 24h e o banco apaga as antigas toda madrugada.
//
// Depende de: sb, currentUser (config.js), goToPage (nav.js), amzCarregar
// (amizades.js), esc/toast (helpers.js).

var NOTIF = { lista: [], aberto: false, timer: null, iniciado: false };

var NOTIF_ICONES = { pedido: '🐹', aceito: '🤝', cutucada: '👉', presente: '🌰', lembrete: '⏰', tarefa: '🔁', teste: '⏳', aviso: '📣' };

function notifIniciar(){
  if(NOTIF.iniciado) { notifCarregar(); return; }
  NOTIF.iniciado = true;
  notifCarregar();
  // A cada 2 minutos com o app aberto, e sempre que a pessoa volta para ele.
  NOTIF.timer = setInterval(function(){ if(!document.hidden) notifCarregar(); }, 120000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) notifCarregar(); });
}

async function notifCarregar(){
  if(typeof currentUser === 'undefined' || !currentUser) return;
  var desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  var r = await sb.from('notificacoes').select('id,tipo,titulo,corpo,lida,criada_em')
    .gte('criada_em', desde).order('criada_em', { ascending: false }).limit(50);
  if(r.error){ console.warn('notificacoes:', r.error); return; }
  var antes = NOTIF.lista.map(function(n){ return n.id; }).join();
  NOTIF.lista = r.data || [];
  notifPintarSino();
  if(NOTIF.aberto) notifPintarPainel();
  // Chegou algo de amizade? Atualiza o selo de pedidos e a lista.
  var mudou = NOTIF.lista.map(function(n){ return n.id; }).join() !== antes;
  if(mudou && typeof amzCarregar === 'function' && NOTIF.lista.some(function(n){ return ['pedido', 'aceito'].indexOf(n.tipo) >= 0; })){
    amzCarregar(true).then(function(){
      if(typeof amzPaginaAtiva === 'function' && amzPaginaAtiva('amizades')) renderAmizades(true);
    });
  }
}

function notifNaoLidas(){ return NOTIF.lista.filter(function(n){ return !n.lida; }).length; }

function notifPintarSino(){
  var n = notifNaoLidas(), selo = document.getElementById('sino-selo'), bt = document.getElementById('sino-bt');
  if(selo){ selo.hidden = !n; selo.textContent = n > 9 ? '9+' : String(n); }
  if(bt) bt.setAttribute('aria-label', n ? 'Notificações, ' + n + (n === 1 ? ' nova' : ' novas') : 'Notificações');
}

// "agora", "há 5 min", "há 2 h"
function notifTempo(iso){
  var min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if(min < 1) return 'agora';
  if(min < 60) return 'há ' + min + ' min';
  return 'há ' + Math.round(min / 60) + ' h';
}

// O titulo que ja comeca com emoji usa ele como icone; senao, o do tipo.
function notifSeparar(n){
  var m = String(n.titulo || '').match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
  return m ? { icone: m[1], titulo: m[2] } : { icone: NOTIF_ICONES[n.tipo] || '🔔', titulo: n.titulo };
}

function notifPintarPainel(){
  var el = document.getElementById('sino-painel');
  if(!el) return;
  var h = '<div class="sino-cab"><h3>Notificações</h3>'
    + (notifNaoLidas() ? '<button type="button" class="sino-ler" onclick="notifLerTodas()">Marcar tudo como lido</button>' : '')
    + '</div>';
  if(!NOTIF.lista.length){
    h += '<div class="sino-vazio">' + ticolino('sonolento', 64) + '<p>Nada por aqui. As notificações somem depois de 1 dia.</p></div>';
  } else {
    h += '<ul class="sino-lista">' + NOTIF.lista.map(function(n){
      var p = notifSeparar(n);
      return '<li><button type="button" class="sino-item' + (n.lida ? '' : ' nova') + '" onclick="notifAbrir(\'' + n.id + '\')">'
        + '<span class="sino-ico" aria-hidden="true">' + p.icone + '</span>'
        + '<span class="sino-txt"><b>' + esc(p.titulo) + '</b>'
        + (n.corpo ? '<span>' + esc(n.corpo) + '</span>' : '')
        + '<i>' + notifTempo(n.criada_em) + (n.lida ? '' : ' · nova') + '</i></span></button></li>';
    }).join('') + '</ul>'
    + '<p class="sino-rodape">Cada notificação fica aqui por 1 dia.</p>';
  }
  el.innerHTML = h;
}

function notifAlternar(forcar){
  var el = document.getElementById('sino-painel'), bt = document.getElementById('sino-bt');
  if(!el) return;
  NOTIF.aberto = typeof forcar === 'boolean' ? forcar : !NOTIF.aberto;
  // O painel vive no <body>: dentro da Home ele ficava preso na camada dos
  // cartoes (e da faixa do teste) e abria por baixo deles.
  if(el.parentNode !== document.body) document.body.appendChild(el);
  if(NOTIF.aberto && bt) notifPosicionar(el, bt);
  el.hidden = !NOTIF.aberto;
  if(bt) bt.setAttribute('aria-expanded', String(NOTIF.aberto));
  if(NOTIF.aberto){
    notifPintarPainel();
    notifCarregar();
    var primeiro = el.querySelector('button');
    if(primeiro) primeiro.focus();
  }
}

function notifPosicionar(el, bt){
  var r = bt.getBoundingClientRect();
  if(window.innerWidth <= 560){ el.style.top = (r.bottom + 8) + 'px'; el.style.left = '16px'; el.style.right = '16px'; }
  else { el.style.top = (r.bottom + 8) + 'px'; el.style.right = Math.max(16, window.innerWidth - r.right) + 'px'; el.style.left = 'auto'; }
}
window.addEventListener('resize', function(){ if(NOTIF.aberto) notifAlternar(false); });
document.addEventListener('scroll', function(e){
  // Rolar a pagina fecha (o painel ficaria solto no ar); rolar a lista dele nao.
  var painel = document.getElementById('sino-painel');
  if(NOTIF.aberto && !(painel && painel.contains(e.target))) notifAlternar(false);
}, true);

// Fecha ao clicar fora e com Esc.
document.addEventListener('click', function(e){
  if(!NOTIF.aberto) return;
  var wrap = document.querySelector('.sino-wrap'), painel = document.getElementById('sino-painel');
  if(wrap && !wrap.contains(e.target) && !(painel && painel.contains(e.target))) notifAlternar(false);
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && NOTIF.aberto){
    notifAlternar(false);
    var bt = document.getElementById('sino-bt'); if(bt) bt.focus();
  }
});

async function notifMarcar(ids){
  if(!ids.length) return;
  NOTIF.lista.forEach(function(n){ if(ids.indexOf(n.id) >= 0) n.lida = true; });
  notifPintarSino();
  if(NOTIF.aberto) notifPintarPainel();
  var r = await sb.from('notificacoes').update({ lida: true }).in('id', ids);
  if(r.error) console.warn('notificacoes: marcar', r.error);
}

function notifLerTodas(){
  notifMarcar(NOTIF.lista.filter(function(n){ return !n.lida; }).map(function(n){ return n.id; }));
}

// Tocar leva ao lugar certo de cada tipo.
function notifAbrir(id){
  var n = NOTIF.lista.find(function(x){ return x.id === id; });
  if(!n) return;
  notifMarcar([id]);
  notifAlternar(false);
  if(['pedido', 'aceito', 'cutucada', 'presente'].indexOf(n.tipo) >= 0){
    if(typeof AMZ !== 'undefined') AMZ.tela = 'principal';
    goToPage('amizades');
  } else if(n.tipo === 'lembrete' || n.tipo === 'tarefa'){
    goToPage('tarefas');
  } else if(n.tipo === 'teste'){
    goToPage('perfil');
    if(typeof perfilAba === 'function') perfilAba('assinaturas');
  }
}
