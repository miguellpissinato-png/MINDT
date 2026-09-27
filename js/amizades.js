// AMIZADES — a aba social: perfil publico, amigos, pedidos, privacidade, o
// pop-up do amigo (comparar, cutucar, presente, desafio, abandonar,
// bloquear) e a pagina "Conhecer novos Ticolinos" (QR, pesquisa, link).
//
// Toda regra que importa (quem ve o que, convite vencido, bloqueio, saldo
// de nozes) mora no servidor, nas funcoes de
// supabase/migrations/*_amizades_funcoes.sql. Este arquivo e so tela: pede,
// mostra e traduz as respostas curtas ('ok', 'ja_amigos'...) em frases.
//
// Depende de: sb, currentUser, state (config.js), ticolino/TICO_CORES/esc/
// toast/openModal (helpers.js), studyXP (estudos.js), livroConcluido
// (leitura.js), goToPage (nav.js).

var AMZ = {
  carregado: false, carregando: null, erro: null,
  perfil: null,          // minha linha em perfis_publicos (null = nunca ativei)
  amigos: [], pedidos: [], bloqueados: [], saldo: null,
  tela: 'principal',     // 'principal' | 'privacidade'
  amigoAberto: null, popTela: 'principal', qtd: 3,
  desTipo: 'leitura', desPeriodo: '1 semana'
};

function amzEu(){ return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null; }
function amzNum(n){ return Number(n || 0).toLocaleString('pt-BR'); }
function amzAtivo(){ return !!(AMZ.perfil && AMZ.perfil.ativo); }
function amzPrimeiroNome(a){ return String((a && (a.nome || a.nick)) || 'seu amigo').trim().split(/\s+/)[0]; }

// Os meus numeros, os mesmos que a Home mostra.
function amzPaginasLidas(){
  var total = 0;
  (state.livros || []).forEach(function(l){
    var lidas = parseInt(l.paginasLidas) || 0, pags = parseInt(l.paginas) || 0;
    var fim = (typeof livroConcluido === 'function') ? livroConcluido(l) : !!l.concluido;
    total += fim ? Math.max(pags, lidas) : lidas;
  });
  return total;
}
function amzMeusNumeros(){
  var xp = (typeof studyXP === 'number') ? studyXP : 0;
  return {
    xp: xp, nivel: Math.floor(xp / 100) + 1,
    ofensiva: (state.streak && state.streak.count) || 0,
    paginas: amzPaginasLidas()
  };
}

// ── Carga ───────────────────────────────────────────────────────────────
function amzCarregar(forcar){
  if(!amzEu()) return Promise.resolve();
  if(AMZ.carregando && !forcar) return AMZ.carregando;
  AMZ.carregando = (async function(){
    try {
      var r = await sb.from('perfis_publicos').select('*').eq('user_id', amzEu()).maybeSingle();
      if(r.error) throw r.error;
      AMZ.perfil = r.data || null;
      if(amzAtivo()){
        var res = await Promise.all([
          sb.rpc('meus_amigos'),
          sb.rpc('minhas_solicitacoes'),
          sb.from('carteira_nozes').select('saldo').eq('user_id', amzEu()).maybeSingle()
        ]);
        if(res[0].error) throw res[0].error;
        if(res[1].error) throw res[1].error;
        AMZ.amigos  = res[0].data || [];
        AMZ.pedidos = res[1].data || [];
        AMZ.saldo   = res[2].data ? res[2].data.saldo : 0;
      } else {
        AMZ.amigos = []; AMZ.pedidos = [];
      }
      AMZ.erro = null; AMZ.carregado = true;
    } catch(e) {
      console.warn('amizades: carga falhou', e);
      AMZ.erro = e;
    } finally {
      AMZ.carregando = null;
    }
    amzPintarSelo();
  })();
  return AMZ.carregando;
}

// Selinho com o numero de pedidos no menu e na barra do celular.
function amzPintarSelo(){
  var n = amzAtivo() ? AMZ.pedidos.length : 0;
  ['nav-selo-amizades', 'mnav-selo-amizades'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.hidden = !n;
    el.textContent = n > 9 ? '9+' : String(n);
    el.setAttribute('aria-label', n + (n === 1 ? ' pedido de amizade' : ' pedidos de amizade'));
  });
}

function amzPaginaAtiva(id){
  var p = document.getElementById('page-' + id);
  return !!(p && p.classList.contains('active'));
}

// ── Publicar meus numeros ───────────────────────────────────────────────
// O app envia nome, cor, XP, ofensiva e paginas para a vitrine. Servem para
// comparar com os amigos; nao valem premio. No maximo 1 vez por minuto, e
// so quando algo mudou.
var _pubUltimo = 0, _pubAssinatura = '', _pubAgendado = null;
function publicarPerfil(forcar){
  if(!amzAtivo() || !amzEu()) return;
  var n = amzMeusNumeros();
  var dados = {
    nome: String((state.perfil && state.perfil.name) || '').slice(0, 40),
    cor: (typeof minhaCorTico === 'function') ? minhaCorTico() : 'padrao',
    xp: Math.max(0, Math.min(100000000, Math.round(n.xp))),
    ofensiva: Math.max(0, Math.min(100000, Math.round(n.ofensiva))),
    paginas: Math.max(0, Math.min(100000000, Math.round(n.paginas)))
  };
  var assinatura = JSON.stringify(dados);
  if(assinatura === _pubAssinatura) return;
  var espera = 60000 - (Date.now() - _pubUltimo);
  if(!forcar && espera > 0){
    if(!_pubAgendado) _pubAgendado = setTimeout(function(){ _pubAgendado = null; publicarPerfil(); }, espera);
    return;
  }
  _pubUltimo = Date.now(); _pubAssinatura = assinatura;
  sb.from('perfis_publicos').update(dados).eq('user_id', amzEu()).then(function(r){
    if(r.error){ _pubAssinatura = ''; console.warn('amizades: publicar falhou', r.error); return; }
    Object.assign(AMZ.perfil, dados);
    AMZ.perfil.nivel = Math.floor(dados.xp / 100) + 1;
  });
}

// ── Frases para as respostas do servidor ────────────────────────────────
var AMZ_RESPOSTAS = {
  ok:             '📨 Pedido enviado! Quando aceitarem, vocês viram amigos.',
  amigos:         '🤝 Vocês dois se convidaram — agora são amigos!',
  ja_amigos:      '🐹 Vocês já são amigos.',
  ja_pedido:      'Você já mandou um pedido para esse Ticolino.',
  voce_mesmo:     'Esse convite é seu mesmo 😄 Mande para um amigo.',
  indisponivel:   'Esse Ticolino não está aceitando convites agora.',
  expirado:       '⏳ Esse link de convite venceu — ele vale 5 minutos. Peça um novo.',
  invalido:       'Esse convite não existe mais. Peça um novo.',
  ative_primeiro: '🐹 Ative as amizades para mandar convites.'
};
function amzFrase(codigo){ return AMZ_RESPOSTAS[codigo] || '⚠️ Não deu certo agora. Tente de novo em instantes.'; }
function amzFalhou(e){ console.warn('amizades:', e); toast('⚠️ Sem conexão com o servidor. Tente de novo em instantes.'); }

// ── Convite aberto por link ou QR (?amigo=CODIGO) ───────────────────────
// O codigo e guardado ao abrir a pagina (a pessoa pode ainda nem estar
// logada) e sai da barra de endereco. Depois do login, vira pedido.
(function(){
  try {
    var u = new URL(location.href), c = u.searchParams.get('amigo');
    if(c && /^[a-z0-9]{8,40}$/i.test(c)){
      localStorage.setItem('mindt-convite', c);
      u.searchParams.delete('amigo');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  } catch(e) {}
})();

async function amzConvitePendente(){
  var c = null;
  try { c = localStorage.getItem('mindt-convite'); } catch(e) {}
  if(!c || !amzEu()) return;
  await amzCarregar();
  if(!amzAtivo()){
    goToPage('amizades');
    toast('🐹 Ative as amizades para aceitar o convite que você abriu.');
    return;                                   // fica guardado ate ativar
  }
  try { localStorage.removeItem('mindt-convite'); } catch(e) {}
  var r = await sb.rpc('usar_convite', { p_codigo: c });
  if(r.error){ amzFalhou(r.error); return; }
  toast(amzFrase(r.data));
  await amzCarregar(true);
  goToPage('amizades');
}

// ── A pagina ────────────────────────────────────────────────────────────
function renderAmizades(semRecarregar){
  var raiz = document.getElementById('amz-raiz');
  if(!raiz) return;
  if(!AMZ.carregado){
    raiz.innerHTML = AMZ.erro ? amzTelaErro() : '<div class="amz-carregando">Carregando suas amizades…</div>';
    if(!AMZ.erro || !semRecarregar){
      amzCarregar().then(function(){ if(amzPaginaAtiva('amizades')) renderAmizades(true); });
    }
    return;
  }
  if(!amzAtivo()) raiz.innerHTML = amzTelaDesligada();
  else if(AMZ.tela === 'privacidade') raiz.innerHTML = amzTelaPrivacidade();
  else raiz.innerHTML = amzTelaPrincipal();
  if(!amzAtivo()) amzConferirNick();
  if(amzAtivo()) publicarPerfil();
  // Traz o que mudou do outro lado (pedido novo, amigo que aceitou).
  if(!semRecarregar){
    amzCarregar(true).then(function(){ if(amzPaginaAtiva('amizades')) renderAmizades(true); });
  }
}

function amzTelaErro(){
  return '<div class="amz-vazio"><p>Não deu para carregar suas amizades agora.</p>'
    + '<button type="button" class="btn btn-ghost" onclick="AMZ.erro=null;renderAmizades()">Tentar de novo</button></div>';
}

// Nick sugerido a partir do nome que a pessoa ja criou no app.
function amzNickSugerido(){
  var base = String((state.perfil && state.perfil.name) || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 20);
  return base.length >= 3 ? base : (base + 'ticolino').slice(0, 20);
}

function amzTelaDesligada(){
  var nick = (AMZ.perfil && AMZ.perfil.nick) || amzNickSugerido();
  var itens = ['Seu Ticolino, com cor e roupinha', 'Nível e XP', 'Ofensiva', 'Páginas lidas'];
  return '<div class="amz-topo"><h2 class="page-title">Amizades</h2></div>'
    + '<div class="amz-desligada">'
      + '<div class="amz-desl-tico">' + ticolino('feliz', 120) + '</div>'
      + '<h3 class="amz-desl-titulo">Amizades desligadas</h3>'
      + '<p class="amz-desl-texto">Ative para adicionar amigos, comparar o progresso e criar desafios juntos.</p>'
      + '<div class="amz-card amz-vitrine">'
        + '<div class="amz-rotulo">Se você ativar, seus amigos veem</div>'
        + itens.map(function(t){ return '<div class="amz-check"><span aria-hidden="true">✓</span>' + t + '</div>'; }).join('')
        + '<p class="amz-nota">Tudo aparece por padrão. Você escolhe o que mostrar em Privacidade, e dá para desligar as amizades a qualquer momento.</p>'
      + '</div>'
      + '<label class="amz-rotulo" for="amz-nick">Seu nick</label>'
      + '<div class="amz-nick-campo"><span aria-hidden="true">@</span>'
        + '<input id="amz-nick" class="form-input" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false"'
        + ' value="' + esc(nick) + '" oninput="amzConferirNick()" aria-describedby="amz-nick-estado amz-nick-nota"></div>'
      + '<div class="amz-nick-estado" id="amz-nick-estado" aria-live="polite"></div>'
      + '<p class="amz-nota" id="amz-nick-nota">Vem do nome que você criou no app. Use de 3 a 20 letras, números, ponto ou _.</p>'
      + '<button type="button" class="btn btn-primary amz-bt-largo" id="amz-ativar" onclick="amzAtivar()">Ativar amizades</button>'
    + '</div>';
}

var _nickTimer = null, _nickPedido = 0;
function amzNormNick(v){ return String(v || '').trim().replace(/^@/, '').toLowerCase(); }
function amzConferirNick(){
  var inp = document.getElementById('amz-nick'), est = document.getElementById('amz-nick-estado');
  if(!inp || !est) return;
  var nick = amzNormNick(inp.value);
  clearTimeout(_nickTimer);
  if(!/^[a-z0-9._]{3,20}$/.test(nick)){
    est.className = 'amz-nick-estado ruim';
    est.textContent = nick.length < 3 ? 'O nick precisa de pelo menos 3 caracteres.' : 'Só letras sem acento, números, ponto ou _.';
    return;
  }
  est.className = 'amz-nick-estado'; est.textContent = 'Conferindo…';
  var n = ++_nickPedido;
  _nickTimer = setTimeout(function(){
    sb.rpc('nick_disponivel', { p_nick: nick }).then(function(r){
      if(n !== _nickPedido) return;          // chegou uma resposta velha
      if(r.error){ est.textContent = ''; return; }
      est.className = 'amz-nick-estado ' + (r.data ? 'bom' : 'ruim');
      est.textContent = r.data ? '@' + nick + ' disponível' : '@' + nick + ' já está em uso. Tente outro.';
    });
  }, 350);
}

async function amzAtivar(){
  var inp = document.getElementById('amz-nick'), bt = document.getElementById('amz-ativar');
  var nick = amzNormNick(inp && inp.value);
  if(bt){ bt.disabled = true; bt.textContent = 'Ativando…'; }
  try {
    var r = await sb.rpc('ativar_amizades', { p_nick: nick, p_nome: (state.perfil && state.perfil.name) || '' });
    if(r.error) throw r.error;
    if(r.data === 'nick_em_uso'){ toast('Esse nick já está em uso. Tente outro.'); return; }
    if(r.data === 'nick_invalido'){ toast('O nick precisa de 3 a 20 letras, números, ponto ou _.'); return; }
    await amzCarregar(true);
    publicarPerfil(true);
    toast('🐹 Amizades ativadas! Agora é só convidar alguém.');
    AMZ.tela = 'principal';
    renderAmizades(true);
    amzConvitePendente();
  } catch(e) { amzFalhou(e); }
  finally { if(bt && bt.isConnected){ bt.disabled = false; bt.textContent = 'Ativar amizades'; } }
}

// ── Tela principal ──────────────────────────────────────────────────────
var AMZ_ICONES = {
  olho: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  pessoas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  mao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
  presente: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  espadas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/><path d="M3 19l2 2"/></svg>',
  noz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4.5 0 8 3 8 7H4c0-4 3.5-7 8-7z"/><path d="M5 10c0 6 3 11 7 11s7-5 7-11"/><path d="M12 3v2"/></svg>'
};

function amzTelaPrincipal(){
  var p = AMZ.perfil, n = amzMeusNumeros();
  var cor = ticoCor((typeof minhaCorTico === 'function') ? minhaCorTico() : 'padrao');
  var noNivel = n.xp % 100;
  var h = '<div class="amz-topo"><h2 class="page-title">Amizades</h2>'
    + '<button type="button" class="btn btn-primary" onclick="goToPage(\'conhecer\')">Conhecer novos Ticolinos</button></div>';

  h += '<div class="amz-card amz-eu">'
    + '<button type="button" class="amz-olho" onclick="amzAbrirPrivacidade()" aria-label="Privacidade: o que os amigos veem" title="Privacidade">' + AMZ_ICONES.olho + '</button>'
    + '<div class="amz-eu-tico">' + ticolino('feliz', 120) + '</div>'
    + '<div class="amz-eu-nome">' + esc((state.perfil && state.perfil.name) || p.nick) + '</div>'
    + '<div class="amz-eu-nick">@' + esc(p.nick) + '</div>'
    + '<div class="amz-chips"><span class="amz-chip">Cor ' + esc(cor.nome) + '</span>'
      + '<span class="amz-chip">Roupinhas em breve</span>'
      + '<span class="amz-chip amz-chip-noz">' + AMZ_ICONES.noz + amzNum(AMZ.saldo) + (AMZ.saldo === 1 ? ' noz' : ' nozes') + '</span></div>'
    + '<div class="amz-stats">'
      + '<div><b>' + n.nivel + '</b><span>Nível</span></div>'
      + '<div><b>' + n.ofensiva + (n.ofensiva === 1 ? ' dia' : ' dias') + '</b><span>Ofensiva</span></div>'
      + '<div><b>' + amzNum(n.paginas) + '</b><span>Páginas</span></div>'
    + '</div>'
    + '<div class="amz-xp"><span class="amz-xp-val">' + amzNum(n.xp) + ' XP</span><span>' + (100 - noNivel) + ' XP pro nível ' + (n.nivel + 1) + '</span></div>'
    + '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + noNivel + '%"></div></div>'
  + '</div>';

  if(AMZ.pedidos.length){
    h += '<h3 class="amz-secao">Solicitações <span class="amz-conta">' + AMZ.pedidos.length + '</span></h3><div class="amz-lista">';
    h += AMZ.pedidos.map(function(s){
      var origem = { pesquisa: 'chegou pela pesquisa', link: 'chegou pelo link', qr: 'chegou pelo QR code' }[s.origem] || '';
      return '<div class="amz-item amz-pedido">'
        + '<span class="amz-rosto">' + ticolino('feliz', 44, true, s.cor) + '</span>'
        + '<div class="amz-item-txt"><div class="amz-item-nome">' + esc(s.nome || '@' + s.nick) + '</div>'
        + '<div class="amz-item-sub">@' + esc(s.nick) + ' · ' + origem + '</div></div>'
        + '<button type="button" class="amz-icone-bt" onclick="amzResponder(\'' + s.id + '\',false)" aria-label="Recusar pedido de ' + esc(s.nome || s.nick) + '">' + AMZ_ICONES.x + '</button>'
        + '<button type="button" class="btn btn-ghost amz-bt-aceitar" onclick="amzResponder(\'' + s.id + '\',true)">Aceitar</button>'
      + '</div>';
    }).join('') + '</div>';
  }

  h += '<h3 class="amz-secao">Seus amigos <span class="amz-conta">' + AMZ.amigos.length + '</span></h3>';
  if(!AMZ.amigos.length){
    h += '<div class="amz-vazio">' + AMZ_ICONES.pessoas
      + '<p>Nenhum amigo por aqui ainda. Mande um convite ou mostre seu QR code.</p>'
      + '<button type="button" class="btn btn-ghost" onclick="cnhAba(\'qr\');goToPage(\'conhecer\')">Mostrar meu QR code</button></div>';
  } else {
    h += '<div class="amz-lista">' + AMZ.amigos.map(function(a){
      var sub = [];
      if(a.nivel != null) sub.push('Nível ' + a.nivel);
      if(a.ofensiva != null) sub.push(a.ofensiva + (a.ofensiva === 1 ? ' dia' : ' dias') + ' de ofensiva');
      return '<div class="amz-item amz-amigo" onclick="amzAbrirAmigo(\'' + a.user_id + '\')">'
        + '<span class="amz-rosto">' + ticolino('feliz', 44, true, a.cor) + '</span>'
        + '<div class="amz-item-txt"><div class="amz-item-nome">' + esc(a.nome || '@' + a.nick) + '</div>'
        + '<div class="amz-item-sub">' + esc(sub.length ? sub.join(' · ') : '@' + a.nick) + '</div></div>'
        + '<button type="button" class="amz-icone-bt amz-mais" onclick="event.stopPropagation();amzAbrirAmigo(\'' + a.user_id + '\')" aria-label="Abrir ' + esc(a.nome || a.nick) + '">' + AMZ_ICONES.mais + '</button>'
      + '</div>';
    }).join('') + '</div>';
  }
  return h;
}

async function amzResponder(id, aceitar){
  try {
    var r = await sb.rpc('responder_solicitacao', { p_id: id, p_aceitar: aceitar });
    if(r.error) throw r.error;
    toast(aceitar ? (r.data === 'ok' ? '🤝 Agora vocês são amigos!' : amzFrase(r.data)) : 'Pedido recusado.');
    await amzCarregar(true);
    renderAmizades(true);
  } catch(e) { amzFalhou(e); }
}

// ── Privacidade ─────────────────────────────────────────────────────────
function amzAbrirPrivacidade(){
  AMZ.tela = 'privacidade';
  renderAmizades(true);
  sb.rpc('meus_bloqueados').then(function(r){
    AMZ.bloqueados = (r && r.data) || [];
    if(amzPaginaAtiva('amizades') && AMZ.tela === 'privacidade') renderAmizades(true);
  });
}
function amzFecharPrivacidade(){ AMZ.tela = 'principal'; renderAmizades(true); }

var AMZ_CHAVES = [
  ['vistos', 'mostra_cor',      'Cor e roupinha do Ticolino'],
  ['vistos', 'mostra_nivel',    'Nível e XP'],
  ['vistos', 'mostra_ofensiva', 'Ofensiva'],
  ['vistos', 'mostra_paginas',  'Páginas lidas'],
  ['achar',  'buscavel',        'Aparecer na pesquisa por nick'],
  ['achar',  'aceita_convites', 'Aceitar convites por QR code e link']
];

function amzTelaPrivacidade(){
  var p = AMZ.perfil, n = amzMeusNumeros();
  var chave = function(c){
    var on = !!p[c[1]];
    return '<div class="amz-chave"><span id="amz-ch-' + c[1] + '">' + c[2] + '</span>'
      + '<div class="toggle-switch' + (on ? ' on' : '') + '" role="switch" tabindex="0" data-a11y="1"'
      + ' aria-checked="' + on + '" aria-labelledby="amz-ch-' + c[1] + '" onclick="amzAlternar(\'' + c[1] + '\')"></div></div>';
  };
  var previa = [];
  if(p.mostra_nivel) previa.push('Nível ' + n.nivel);
  if(p.mostra_ofensiva) previa.push(n.ofensiva + ' dias de ofensiva');
  if(p.mostra_paginas) previa.push(amzNum(n.paginas) + ' páginas');
  var h = '<div class="amz-topo amz-topo-voltar">'
      + '<button type="button" class="amz-icone-bt" onclick="amzFecharPrivacidade()" aria-label="Voltar para Amizades">' + AMZ_ICONES.voltar + '</button>'
      + '<h2 class="page-title">Privacidade</h2></div>'
    + '<p class="amz-desl-texto amz-esq">Escolha o que outros Ticolinos veem. Por padrão, tudo aparece.</p>'
    + '<div class="amz-rotulo">Seus amigos veem</div>'
    + AMZ_CHAVES.filter(function(c){ return c[0] === 'vistos'; }).map(chave).join('')
    + '<div class="amz-rotulo">Como te encontram</div>'
    + AMZ_CHAVES.filter(function(c){ return c[0] === 'achar'; }).map(chave).join('')
    + '<div class="amz-rotulo">Assim você aparece pra eles</div>'
    + '<div class="amz-item amz-previa"><span class="amz-rosto">' + ticolino('feliz', 44, true, p.mostra_cor ? undefined : 'padrao') + '</span>'
      + '<div class="amz-item-txt"><div class="amz-item-nome">' + esc((state.perfil && state.perfil.name) || p.nick) + '</div>'
      + '<div class="amz-item-sub">' + esc(previa.length ? previa.join(' · ') : '@' + p.nick) + '</div></div></div>'
    + '<div class="amz-rotulo">Bloqueados</div>';
  h += AMZ.bloqueados.length
    ? AMZ.bloqueados.map(function(b){
        return '<div class="amz-item"><div class="amz-item-txt"><div class="amz-item-nome">' + esc(b.nome || (b.nick ? '@' + b.nick : 'Ticolino')) + '</div>'
          + (b.nick ? '<div class="amz-item-sub">@' + esc(b.nick) + '</div>' : '') + '</div>'
          + '<button type="button" class="btn btn-ghost amz-bt-aceitar" onclick="amzDesbloquear(\'' + b.user_id + '\')">Desbloquear</button></div>';
      }).join('')
    : '<p class="amz-nota">Nenhum Ticolino bloqueado.</p>';
  h += '<button type="button" class="btn btn-danger amz-bt-largo amz-desativar" onclick="amzConfirmarDesativar()">Desativar amizades</button>'
    + '<p class="amz-nota amz-centro">Seus amigos deixam de ver você e ninguém te acha. Dá para ativar de novo depois.</p>';
  return h;
}

async function amzAlternar(col){
  if(!AMZ.perfil) return;
  var antes = !!AMZ.perfil[col], mud = {};
  mud[col] = !antes;
  AMZ.perfil[col] = !antes;
  amzRepintarChave(col);
  var r = await sb.from('perfis_publicos').update(mud).eq('user_id', amzEu());
  if(r.error){ AMZ.perfil[col] = antes; amzRepintarChave(col); amzFalhou(r.error); }
}
// Repinta a tela sem perder o foco do teclado na chave que foi mexida.
function amzRepintarChave(col){
  renderAmizades(true);
  var ch = document.querySelector('[aria-labelledby="amz-ch-' + col + '"]');
  if(ch) ch.focus();
}

async function amzDesbloquear(id){
  var r = await sb.rpc('desbloquear', { p_outro: id });
  if(r.error){ amzFalhou(r.error); return; }
  AMZ.bloqueados = AMZ.bloqueados.filter(function(b){ return b.user_id !== id; });
  toast('Desbloqueado. Vocês podem se convidar de novo.');
  renderAmizades(true);
}

function amzConfirmarDesativar(){
  document.getElementById('confirm-icon').textContent = '🐹';
  document.getElementById('confirm-title').textContent = 'Desativar amizades?';
  document.getElementById('confirm-body').textContent =
    'Seus amigos deixam de ver seu Ticolino e seus números, e ninguém te acha na pesquisa. Suas amizades ficam guardadas: ao ativar de novo, elas voltam.';
  var ok = document.getElementById('confirm-ok-btn');
  ok.textContent = 'Desativar';
  ok.onclick = async function(){
    closeModal('modal-confirm'); if(typeof resetConfirmBtn === 'function') resetConfirmBtn();
    var r = await sb.rpc('desativar_amizades');
    if(r.error){ amzFalhou(r.error); return; }
    AMZ.tela = 'principal';
    await amzCarregar(true);
    toast('Amizades desativadas.');
    renderAmizades(true);
  };
  openModal('modal-confirm');
}

// ── Pop-up do amigo ─────────────────────────────────────────────────────
var _acenoTimer = null;
function amzAbrirAmigo(id){
  var a = AMZ.amigos.find(function(x){ return x.user_id === id; });
  if(!a) return;
  AMZ.amigoAberto = a; AMZ.popTela = 'principal'; AMZ.qtd = 3;
  amzPintarPop(true);
  openModal('modal-amigo');
}

function amzPop(tela){ AMZ.popTela = tela; amzPintarPop(false); }

function amzLinhaComp(rotulo, eu, ele, suf){
  var temEle = ele != null;
  var tot = eu + (ele || 0);
  var pct = !temEle ? 50 : (tot > 0 ? Math.max(6, Math.min(94, Math.round(eu / tot * 100))) : 50);
  var fmt = function(v){ return v == null ? '—' : amzNum(v) + (suf || ''); };
  return '<div class="amz-comp-linha">'
      + '<span class="amz-comp-v' + (temEle && eu > ele ? ' ganha' : '') + '">' + fmt(eu) + '</span>'
      + '<span class="amz-comp-rot">' + rotulo + '</span>'
      + '<span class="amz-comp-v ele' + (temEle && ele > eu ? ' ganha' : '') + '">' + (temEle ? fmt(ele) : '<span title="Escondido pela privacidade">—</span>') + '</span>'
    + '</div>'
    + '<div class="amz-comp-barra' + (temEle ? '' : ' vazia') + '"><i style="width:' + pct + '%"></i><b></b></div>';
}

function amzPintarPop(acenar){
  var el = document.getElementById('amz-modal'), a = AMZ.amigoAberto;
  if(!el || !a) return;
  var nome = a.nome || '@' + a.nick, primeiro = amzPrimeiroNome(a);
  var fechar = '<button type="button" class="amz-icone-bt amz-fechar" onclick="closeModal(\'modal-amigo\')" aria-label="Fechar">' + AMZ_ICONES.x + '</button>';
  var voltar = '<button type="button" class="amz-icone-bt" onclick="amzPop(\'principal\')" aria-label="Voltar">' + AMZ_ICONES.voltar + '</button>';
  var t = AMZ.popTela, h = '';
  el.setAttribute('aria-label', nome);

  if(t === 'principal'){
    var eu = amzMeusNumeros();
    var desde = a.desde ? new Date(a.desde).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', '/') : '';
    h = fechar
      + '<div class="amz-pop-tico' + (acenar ? ' acenando' : '') + '" id="amz-pop-tico">' + ticolino(acenar && !menosMovimento() ? 'acenando' : 'tranquilo', 120, false, a.cor) + '</div>'
      + '<div class="amz-pop-nome">' + esc(nome) + '</div>'
      + '<div class="amz-pop-sub">@' + esc(a.nick) + (desde ? ' · amigos desde ' + esc(desde) : '') + '</div>'
      + '<div class="amz-chips">' + (a.nivel != null ? '<span class="amz-chip amz-chip-acc">Nível ' + a.nivel + '</span>' : '')
        + '<span class="amz-chip">Cor ' + esc(ticoCor(a.cor).nome) + '</span></div>'
      + '<div class="amz-comp">'
        + '<div class="amz-comp-topo"><span><i class="eu"></i>Você</span><span>' + esc(primeiro) + '<i class="ele"></i></span></div>'
        + amzLinhaComp('Nível', eu.nivel, a.nivel)
        + amzLinhaComp('XP', eu.xp, a.xp)
        + amzLinhaComp('Ofensiva', eu.ofensiva, a.ofensiva, ' d')
        + amzLinhaComp('Páginas lidas', eu.paginas, a.paginas)
      + '</div>'
      + '<div class="amz-acoes">'
        + '<button type="button" onclick="amzCutucar()">' + AMZ_ICONES.mao + 'Cutucar</button>'
        + '<button type="button" onclick="amzPop(\'presente\')">' + AMZ_ICONES.presente + 'Presente</button>'
        + '<button type="button" onclick="amzPop(\'desafio\')">' + AMZ_ICONES.espadas + 'Criar desafio</button>'
      + '</div>'
      + '<button type="button" class="btn btn-ghost amz-bt-largo" onclick="amzPop(\'abandonar\')">Abandonar amizade</button>'
      + '<button type="button" class="btn btn-danger amz-bt-largo" onclick="amzPop(\'bloquear\')">Bloquear esse ticolino</button>';
  } else if(t === 'presente'){
    var saldo = AMZ.saldo || 0;
    h = '<div class="amz-pop-cab">' + voltar + '<h3>Dar um presente</h3>' + fechar + '</div>'
      + '<div class="amz-pres-topo"><span>' + ticolino('feliz', 80, false, a.cor) + '</span><p>As nozes vão direto pro Ticolino de ' + esc(primeiro) + '.</p></div>'
      + '<div class="amz-saldo">' + AMZ_ICONES.noz + '<span>Suas nozes</span><b>' + amzNum(saldo) + '</b></div>'
      + '<div class="amz-rotulo">Quantas nozes</div><div class="amz-pilulas">'
      + [1, 3, 5, 10].map(function(q){
          return '<button type="button" class="amz-pilula" aria-pressed="' + (q === AMZ.qtd) + '" onclick="AMZ.qtd=' + q + ';amzPintarPop()"'
            + (q > saldo ? ' disabled' : '') + '>' + (q === 1 ? '1 noz' : q + ' nozes') + '</button>';
        }).join('') + '</div>'
      + '<p class="amz-nota">' + (saldo ? 'Cada conta começou com 10 nozes. Em breve, as missões semanais e as tarefas concluídas dão mais.'
                                        : 'Suas nozes acabaram. Em breve, as missões semanais e as tarefas concluídas dão mais.') + '</p>'
      + '<button type="button" class="btn btn-primary amz-bt-largo" onclick="amzDarNozes()"' + (AMZ.qtd > saldo ? ' disabled' : '') + '>'
        + 'Enviar ' + (AMZ.qtd === 1 ? '1 noz' : AMZ.qtd + ' nozes') + '</button>';
  } else if(t === 'desafio'){
    var TIPOS = [['leitura', 'lê mais páginas', 'ler mais páginas'], ['estudo', 'estuda mais tempo', 'estudar mais tempo'],
                 ['tarefas', 'faz mais tarefas', 'fizer mais tarefas'], ['treino', 'treina mais', 'treinar mais']];
    var sel = TIPOS.find(function(x){ return x[0] === AMZ.desTipo; }) || TIPOS[0];
    h = '<div class="amz-pop-cab">' + voltar + '<h3>Criar desafio <span class="amz-breve">em breve</span></h3>' + fechar + '</div>'
      + '<div class="amz-vs">' + ticolino('feliz', 64) + '<span>vs</span>' + ticolino('feliz', 64, false, a.cor) + '</div>'
      + '<div class="amz-rotulo">Quem…</div><div class="amz-pilulas">'
      + TIPOS.map(function(x){ return '<button type="button" class="amz-pilula" aria-pressed="' + (x[0] === AMZ.desTipo) + '" onclick="AMZ.desTipo=\'' + x[0] + '\';amzPintarPop()">' + x[1] + '</button>'; }).join('')
      + '</div><div class="amz-rotulo">Duração</div><div class="abas amz-abas">'
      + ['1 semana', '1 mês'].map(function(d){ return '<button type="button" class="aba" aria-pressed="' + (d === AMZ.desPeriodo) + '" onclick="AMZ.desPeriodo=\'' + d + '\';amzPintarPop()">' + d + '</button>'; }).join('')
      + '</div><div class="amz-resumo">Quem ' + sel[2] + ' em ' + AMZ.desPeriodo + ' vence. Começa quando ' + esc(primeiro) + ' aceitar.</div>'
      + '<button type="button" class="btn btn-primary amz-bt-largo" onclick="toast(\'🐹 Os desafios chegam em breve — seu Ticolino já está treinando!\')">Enviar desafio</button>';
  } else {
    var ab = t === 'abandonar';
    h = fechar
      + '<div class="amz-pop-tico">' + ticolino('tranquilo', 96, false, a.cor) + '</div>'
      + '<h3 class="amz-conf-titulo">' + (ab ? 'Abandonar amizade?' : 'Bloquear esse ticolino?') + '</h3>'
      + '<p class="amz-conf-texto">' + (ab
          ? 'Você e ' + esc(primeiro) + ' deixam de ver o progresso um do outro.'
          : esc(primeiro) + ' sai da sua lista, não te acha na pesquisa e não consegue te mandar convite.') + '</p>'
      + '<p class="amz-nota amz-centro">' + (ab ? 'Dá para mandar um convite de novo depois.' : 'Ninguém é avisado. Dá para desbloquear em Privacidade.') + '</p>'
      + '<div class="amz-conf-bts"><button type="button" class="btn btn-ghost" onclick="amzPop(\'principal\')">Cancelar</button>'
      + '<button type="button" class="btn btn-danger" onclick="' + (ab ? 'amzAbandonar()' : 'amzBloquear()') + '">' + (ab ? 'Abandonar' : 'Bloquear') + '</button></div>';
  }
  el.innerHTML = h;

  // O aceno dura um instante; depois o amigo fica tranquilo.
  clearTimeout(_acenoTimer);
  if(t === 'principal' && acenar && !menosMovimento()){
    _acenoTimer = setTimeout(function(){
      var tico = document.getElementById('amz-pop-tico');
      if(tico && AMZ.popTela === 'principal'){ tico.classList.remove('acenando'); tico.innerHTML = ticolino('tranquilo', 120, false, a.cor); }
    }, 1700);
  }
}

async function amzCutucar(){
  var a = AMZ.amigoAberto; if(!a) return;
  var r = await sb.rpc('cutucar', { p_outro: a.user_id });
  if(r.error){ amzFalhou(r.error); return; }
  var p = amzPrimeiroNome(a);
  toast(r.data === 'ok' ? '👉 Cutucão enviado para ' + p + '!'
      : r.data === 'ja_cutucou' ? 'Você já cutucou ' + p + ' hoje. Amanhã tem mais.'
      : amzFrase(r.data));
}

async function amzDarNozes(){
  var a = AMZ.amigoAberto, q = AMZ.qtd; if(!a) return;
  var r = await sb.rpc('dar_nozes', { p_outro: a.user_id, p_qtd: q });
  if(r.error){ amzFalhou(r.error); return; }
  if(r.data === 'ok'){
    AMZ.saldo = Math.max(0, (AMZ.saldo || 0) - q);
    toast('🌰 ' + (q === 1 ? '1 noz enviada' : q + ' nozes enviadas') + ' para ' + amzPrimeiroNome(a) + '!');
    amzPop('principal');
  } else if(r.data === 'sem_saldo'){
    toast('Você não tem nozes suficientes.');
    amzCarregar(true).then(function(){ amzPintarPop(); });
  } else toast(amzFrase(r.data));
}

async function amzAbandonar(){
  var a = AMZ.amigoAberto; if(!a) return;
  var r = await sb.rpc('desfazer_amizade', { p_outro: a.user_id });
  if(r.error){ amzFalhou(r.error); return; }
  closeModal('modal-amigo');
  toast('Amizade desfeita.');
  await amzCarregar(true); renderAmizades(true);
}

async function amzBloquear(){
  var a = AMZ.amigoAberto; if(!a) return;
  var r = await sb.rpc('bloquear', { p_outro: a.user_id });
  if(r.error){ amzFalhou(r.error); return; }
  closeModal('modal-amigo');
  toast('Ticolino bloqueado.');
  await amzCarregar(true); renderAmizades(true);
}

// ═══════════════════════════════════════════════════════════════════════
// CONHECER NOVOS TICOLINOS
// ═══════════════════════════════════════════════════════════════════════
var CNH = { aba: 'qr', link: null, timer: null, busca: '', resultados: null, buscando: false };

function amzLinkPara(codigo){ return location.origin + location.pathname + '?amigo=' + encodeURIComponent(codigo); }

function renderConhecer(){
  cnhPintarCena();
  if(!AMZ.carregado){
    document.getElementById('cnh-painel').innerHTML = '<div class="amz-carregando">Carregando…</div>';
    amzCarregar().then(function(){ if(amzPaginaAtiva('conhecer')) renderConhecer(); });
    return;
  }
  cnhAba(CNH.aba);
}

function cnhAba(aba){
  CNH.aba = aba;
  document.querySelectorAll('[data-cnh]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.cnh === aba)); });
  var el = document.getElementById('cnh-painel');
  if(!el) return;
  if(!amzAtivo()){
    el.innerHTML = '<div class="amz-card cnh-card"><p>Para convidar alguém, primeiro ative as amizades e escolha seu nick.</p>'
      + '<button type="button" class="btn btn-primary" onclick="goToPage(\'amizades\')">Ativar amizades</button></div>';
    return;
  }
  if(aba === 'qr') cnhPainelQR(el);
  else if(aba === 'pesquisa') cnhPainelPesquisa(el);
  else cnhPainelLink(el);
}

// ── Cena da toca ────────────────────────────────────────────────────────
// A arte (img/toca.svg) vem do design: toca de gravetos, arvores verdes,
// laranjas e amarelas, pedrinhas e grama que esmaece. Por cima, vagalumes
// e os tres Ticolinos (padrao na frente, marrom a direita, cinza listrado a
// esquerda). Tudo num SVG so, com "slice": no celular corta as bordas e
// mantem a toca e os Ticolinos.
var CNH_VAGALUMES = [
  [120,330,2.6,0,5.8,6,-4],[232,262,3.1,-1.2,6.6,-5,6],[318,330,2.2,-.6,5.1,4,5],[410,290,3.4,-2.2,7.2,-6,-5],
  [540,336,2.8,-1.7,6.1,5,4],[610,250,2.4,-.3,5.4,-4,6],[70,470,3,-2.6,6.4,6,5],[640,455,2.5,-1,5.6,-5,-6],
  [455,395,3.6,-.8,7.6,4,-6],[250,410,2.9,-1.9,6,-6,4],[600,610,2.3,-1.4,5.2,5,-4],[95,600,3.2,-2.9,6.8,-4,-5]
];
function cnhTicoEm(cor, x, y, w){
  return ticolino('feliz', w, false, cor).replace(/^<svg viewBox="([^"]+)" style="([^"]*)"/, function(m, vb, st){
    var vars = st.split(';').filter(function(p){ return p.indexOf('--') === 0; }).join(';');
    return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + Math.round(w * 1.03) + '" viewBox="' + vb + '" style="' + vars + '"';
  });
}
function cnhPintarCena(){
  var el = document.getElementById('cnh-cena');
  if(!el || el.dataset.pronta) return;
  var vaga = CNH_VAGALUMES.map(function(v){
    return '<g><animate attributeName="opacity" values="0.2;1;0.2" dur="' + v[2] + 's" begin="' + v[3] + 's" repeatCount="indefinite"/>'
      + '<animateTransform attributeName="transform" type="translate" values="0 0;' + v[5] + ' ' + v[6] + ';0 0" dur="' + v[4] + 's" repeatCount="indefinite"/>'
      + '<circle cx="' + v[0] + '" cy="' + v[1] + '" r="11" fill="url(#cnhVaga)"/><circle cx="' + v[0] + '" cy="' + v[1] + '" r="1.8" fill="#FFF2C2"/></g>';
  }).join('');
  el.innerHTML = '<svg class="cnh-cena-svg" viewBox="0 0 700 800" preserveAspectRatio="xMidYMax slice">'
    + '<defs><radialGradient id="cnhVaga" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE08A" stop-opacity=".95"/>'
    + '<stop offset=".35" stop-color="#FFC24A" stop-opacity=".45"/><stop offset="1" stop-color="#FFC24A" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="cnhSombra" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0A1208" stop-opacity=".6"/><stop offset="1" stop-color="#0A1208" stop-opacity="0"/></radialGradient></defs>'
    + '<image href="img/toca.svg" x="0" y="0" width="700" height="800"/>'
    + '<ellipse cx="350" cy="590" rx="80" ry="14" fill="url(#cnhSombra)"/><ellipse cx="175" cy="578" rx="62" ry="11" fill="url(#cnhSombra)"/>'
    + '<ellipse cx="525" cy="578" rx="62" ry="11" fill="url(#cnhSombra)"/>'
    + vaga
    + cnhTicoEm('listrado', 116, 452, 118) + cnhTicoEm('marrom', 466, 452, 118) + cnhTicoEm('padrao', 275, 434, 150)
    + '</svg>';
  el.dataset.pronta = '1';
  var svg = el.querySelector('svg');
  if(svg && menosMovimento() && svg.pauseAnimations) svg.pauseAnimations();
}

// ── QR code ─────────────────────────────────────────────────────────────
// Biblioteca qrcode-generator (MIT), carregada so quando a pessoa abre esta
// pagina. integrity: se o arquivo no CDN mudar, o navegador recusa.
var _libQR = null;
function cnhCarregarLibQR(){
  if(typeof qrcode === 'function') return Promise.resolve();
  if(_libQR) return _libQR;
  _libQR = new Promise(function(ok, falha){
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.integrity = 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k';
    s.crossOrigin = 'anonymous';
    s.onload = function(){ ok(); };
    s.onerror = function(){ _libQR = null; falha(new Error('qr')); };
    document.head.appendChild(s);
  });
  return _libQR;
}

// Modulos do QR como um unico <path>. Correcao de erro alta (H): o rosto do
// Ticolino no meio cobre parte do codigo e ele continua lendo.
function cnhQRModulos(texto){
  var q = qrcode(0, 'H'); q.addData(texto); q.make();
  var n = q.getModuleCount(), d = '';
  for(var r = 0; r < n; r++) for(var c = 0; c < n; c++) if(q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
  return { n: n, d: d };
}
function cnhQRsvg(texto){
  var m = cnhQRModulos(texto), t = m.n + 8;
  return '<svg viewBox="-4 -4 ' + t + ' ' + t + '" shape-rendering="crispEdges" role="img" aria-label="QR code do seu convite">'
    + '<rect x="-4" y="-4" width="' + t + '" height="' + t + '" fill="#F4E9C9"/><path d="' + m.d + '" fill="#17140E"/></svg>';
}

function cnhPainelQR(el){
  var p = AMZ.perfil, url = amzLinkPara(p.qr_codigo);
  el.innerHTML = '<div class="amz-card cnh-card cnh-qr-card">'
    + '<div class="cnh-qr" id="cnh-qr"><div class="amz-carregando">Gerando seu QR code…</div></div>'
    + '<div class="cnh-qr-nick">@' + esc(p.nick) + '</div>'
    + '<p class="amz-nota amz-centro">Seu QR code é único. Quem escanear te manda um convite de amizade.</p>'
    + '<div class="cnh-bts"><button type="button" class="btn btn-primary" onclick="cnhEscanear()">Escanear QR code</button>'
    + '<button type="button" class="btn btn-ghost" onclick="cnhSalvarQR()">Salvar imagem</button></div></div>';
  cnhCarregarLibQR().then(function(){
    var box = document.getElementById('cnh-qr');
    if(box) box.innerHTML = cnhQRsvg(url) + '<span class="cnh-qr-rosto">' + ticolino('feliz', 40, true) + '</span>';
  }).catch(function(){
    var box = document.getElementById('cnh-qr');
    if(box) box.innerHTML = '<p class="amz-nota amz-centro">Não deu para desenhar o QR code sem internet. Use o link de convite.</p>';
  });
}

function cnhSalvarQR(){
  if(typeof qrcode !== 'function'){ toast('Espere o QR code aparecer.'); return; }
  var p = AMZ.perfil, m = cnhQRModulos(amzLinkPara(p.qr_codigo));
  var px = 12, borda = 4, lado = (m.n + borda * 2) * px, cv = document.createElement('canvas');
  cv.width = lado; cv.height = lado + 70;
  var g = cv.getContext('2d');
  g.fillStyle = '#F4E9C9'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#17140E';
  g.translate(borda * px, borda * px);
  g.fill(new Path2D(m.d.replace(/(\d+) (\d+)h1v1h-1z/g, function(x, c, r){ return (c * px) + ' ' + (r * px) + 'h' + px + 'v' + px + 'h-' + px + 'z'; })));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = '600 28px Poppins, system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('@' + p.nick + ' no Mindt', lado / 2, lado + 42);
  var a = document.createElement('a');
  a.download = 'ticolino-' + p.nick + '.png';
  a.href = cv.toDataURL('image/png');
  a.click();
}

// Leitor de QR dentro do app: so onde o navegador ja traz um (Chrome no
// Android). Nos outros, a camera do proprio celular le o QR e abre o link.
var _scan = null;
function cnhEscanear(){
  if(!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    toast('📷 Abra a câmera do celular e aponte para o QR code do amigo — o convite abre sozinho.');
    return;
  }
  var ov = document.createElement('div');
  ov.className = 'cnh-scan'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Escanear QR code');
  ov.innerHTML = '<video playsinline muted></video><p>Aponte para o QR code do amigo</p>'
    + '<button type="button" class="btn btn-ghost" onclick="cnhPararScan()">Fechar</button>';
  document.body.appendChild(ov);
  var video = ov.querySelector('video'), det = new BarcodeDetector({ formats: ['qr_code'] });
  _scan = { ov: ov, stream: null, vivo: true };
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function(stream){
    if(!_scan || !_scan.vivo){ stream.getTracks().forEach(function(t){ t.stop(); }); return; }
    _scan.stream = stream; video.srcObject = stream; video.play();
    var ler = function(){
      if(!_scan || !_scan.vivo) return;
      det.detect(video).then(function(cods){
        var cod = null;
        (cods || []).some(function(c){
          try { cod = new URL(c.rawValue).searchParams.get('amigo'); } catch(e) {}
          return !!cod;
        });
        if(cod){ cnhPararScan(); cnhUsarCodigo(cod); }
        else setTimeout(ler, 300);
      }).catch(function(){ setTimeout(ler, 500); });
    };
    ler();
  }).catch(function(){
    cnhPararScan();
    toast('Sem acesso à câmera. Use a câmera do celular para ler o QR code.');
  });
}
function cnhPararScan(){
  if(!_scan) return;
  _scan.vivo = false;
  if(_scan.stream) _scan.stream.getTracks().forEach(function(t){ t.stop(); });
  if(_scan.ov) _scan.ov.remove();
  _scan = null;
}
async function cnhUsarCodigo(cod){
  var r = await sb.rpc('usar_convite', { p_codigo: cod });
  if(r.error){ amzFalhou(r.error); return; }
  toast(amzFrase(r.data));
  if(r.data === 'amigos' || r.data === 'ok') amzCarregar(true);
}

// ── Pesquisa por nick ───────────────────────────────────────────────────
var _buscaTimer = null, _buscaPedido = 0;
function cnhPainelPesquisa(el){
  el.innerHTML = '<div class="cnh-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
    + '<input id="cnh-busca" class="form-input" type="search" placeholder="Nick ou nome" autocomplete="off" autocapitalize="none" spellcheck="false"'
    + ' value="' + esc(CNH.busca) + '" oninput="cnhBuscar(this.value)" aria-label="Procurar Ticolino por nick ou nome"></div>'
    + '<div id="cnh-resultados" aria-live="polite"></div>';
  cnhPintarResultados();
  var inp = document.getElementById('cnh-busca');
  if(inp && window.matchMedia('(pointer:fine)').matches) inp.focus();
}
function cnhBuscar(v){
  CNH.busca = v;
  clearTimeout(_buscaTimer);
  var q = v.trim().replace(/^@/, '');
  if(q.length < 2){ CNH.resultados = null; cnhPintarResultados(); return; }
  CNH.buscando = true; cnhPintarResultados();
  var n = ++_buscaPedido;
  _buscaTimer = setTimeout(function(){
    sb.rpc('buscar_ticolinos', { p_q: q }).then(function(r){
      if(n !== _buscaPedido) return;
      CNH.buscando = false;
      CNH.resultados = r.error ? [] : (r.data || []);
      if(r.error) console.warn('amizades: busca', r.error);
      cnhPintarResultados();
    });
  }, 300);
}
function cnhPintarResultados(){
  var el = document.getElementById('cnh-resultados');
  if(!el) return;
  var R = CNH.resultados;
  if(R === null){
    el.innerHTML = '<p class="amz-nota">' + (CNH.buscando ? 'Procurando…' : 'Digite pelo menos 2 letras. Só aparece quem deixou a pesquisa ligada.') + '</p>';
    return;
  }
  el.innerHTML = '<p class="amz-nota">' + (R.length === 1 ? '1 Ticolino encontrado' : R.length + ' Ticolinos encontrados') + ' · só aparece quem deixou a pesquisa ligada</p>'
    + '<div class="amz-lista">' + R.map(function(t){
      var acao = t.relacao === 'amigo' ? '<span class="amz-chip amz-chip-ok">Amigos</span>'
        : t.relacao === 'enviado' ? '<span class="amz-chip">Pedido enviado</span>'
        : t.relacao === 'recebido' ? '<button type="button" class="btn btn-ghost amz-bt-aceitar" onclick="cnhAceitarDe(\'' + t.user_id + '\')">Aceitar</button>'
        : '<button type="button" class="btn btn-ghost amz-bt-aceitar" onclick="cnhConvidar(\'' + t.user_id + '\')">Convidar</button>';
      return '<div class="amz-item"><span class="amz-rosto">' + ticolino('feliz', 44, true, t.cor) + '</span>'
        + '<div class="amz-item-txt"><div class="amz-item-nome">' + esc(t.nome || '@' + t.nick) + '</div>'
        + '<div class="amz-item-sub">@' + esc(t.nick) + (t.nivel != null ? ' · Nível ' + t.nivel : '') + '</div></div>' + acao + '</div>';
    }).join('') + '</div>';
}
async function cnhConvidar(id){
  var r = await sb.rpc('pedir_amizade', { p_para: id });
  if(r.error){ amzFalhou(r.error); return; }
  toast(amzFrase(r.data));
  (CNH.resultados || []).forEach(function(t){
    if(t.user_id === id) t.relacao = r.data === 'amigos' || r.data === 'ja_amigos' ? 'amigo' : (r.data === 'ok' || r.data === 'ja_pedido') ? 'enviado' : t.relacao;
  });
  cnhPintarResultados();
  if(r.data === 'amigos') amzCarregar(true);
}
async function cnhAceitarDe(id){
  await amzCarregar(true);
  var s = AMZ.pedidos.find(function(x){ return x.de === id; });
  if(!s){ toast('Esse pedido não está mais aqui.'); return; }
  await amzResponder(s.id, true);
  (CNH.resultados || []).forEach(function(t){ if(t.user_id === id) t.relacao = 'amigo'; });
  cnhPintarResultados();
}

// ── Link de 5 minutos ───────────────────────────────────────────────────
function cnhPainelLink(el){
  var L = CNH.link, vivo = L && L.expira > Date.now();
  if(!L){
    el.innerHTML = '<div class="amz-card cnh-card"><div class="amz-rotulo">Link de convite</div>'
      + '<p class="amz-nota">Crie um link que vale por 5 minutos e mande para quem você quiser. Quem abrir te manda um convite — você aceita em Amizades.</p>'
      + '<button type="button" class="btn btn-primary" onclick="cnhGerarLink()">Gerar link de 5 minutos</button></div>';
    return;
  }
  var url = amzLinkPara(L.codigo);
  el.innerHTML = '<div class="amz-card cnh-card"><div class="amz-rotulo">Seu link</div>'
    + '<div class="cnh-link' + (vivo ? '' : ' vencido') + '"><input class="form-input" readonly value="' + esc(url) + '" aria-label="Link de convite" onclick="this.select()">'
    + '<button type="button" class="amz-icone-bt" onclick="cnhCopiarLink()" aria-label="Copiar link"' + (vivo ? '' : ' disabled') + '>'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>'
    + '<div class="cnh-expira"><span>' + (vivo ? 'Expira em' : 'Esse link venceu') + '</span><b id="cnh-conta">' + (vivo ? cnhRestante() : '0:00') + '</b></div>'
    + '<div class="progress-bar-track"><div class="progress-bar-fill" id="cnh-barra" style="width:' + (vivo ? cnhPct() : 0) + '%"></div></div>'
    + '<p class="amz-nota">Quem abrir o link te manda um convite. Você aceita em Amizades.</p>'
    + '<div class="cnh-bts">' + (vivo ? '<button type="button" class="btn btn-primary" onclick="cnhCopiarLink()">Copiar link</button>'
      + (navigator.share ? '<button type="button" class="btn btn-ghost" onclick="cnhCompartilhar()">Compartilhar</button>' : '') : '')
    + '<button type="button" class="btn btn-ghost" onclick="cnhGerarLink()">Gerar outro</button></div></div>';
}
function cnhRestante(){
  var s = Math.max(0, Math.ceil((CNH.link.expira - Date.now()) / 1000));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}
function cnhPct(){ return Math.max(0, Math.min(100, (CNH.link.expira - Date.now()) / 3000)); }
async function cnhGerarLink(){
  var r = await sb.rpc('gerar_link_convite');
  if(r.error || !r.data || !r.data[0]){ amzFalhou(r.error); return; }
  // O relogio conta a partir de agora no aparelho; quem decide se venceu e
  // o servidor (expira_em), entao um relogio adiantado nao estende nada.
  CNH.link = { codigo: r.data[0].codigo, expira: Date.now() + 5 * 60 * 1000 };
  cnhAba('link');
  clearInterval(CNH.timer);
  CNH.timer = setInterval(function(){
    var conta = document.getElementById('cnh-conta'), barra = document.getElementById('cnh-barra');
    if(!CNH.link || CNH.link.expira <= Date.now()){
      clearInterval(CNH.timer);
      if(CNH.aba === 'link' && amzPaginaAtiva('conhecer')) cnhAba('link');
      return;
    }
    if(conta) conta.textContent = cnhRestante();
    if(barra) barra.style.width = cnhPct() + '%';
  }, 1000);
}
function cnhCopiarLink(){
  if(!CNH.link) return;
  var url = amzLinkPara(CNH.link.codigo);
  var feito = function(){ toast('🔗 Link copiado! Ele vale até o relógio zerar.'); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(feito, function(){ toast('Selecione o link e copie.'); });
  else { var i = document.querySelector('.cnh-link input'); if(i){ i.select(); try { document.execCommand('copy'); feito(); } catch(e) {} } }
}
function cnhCompartilhar(){
  if(!CNH.link || !navigator.share) return;
  navigator.share({ title: 'Vem ser meu amigo no Mindt', text: 'Meu Ticolino quer te conhecer 🐹', url: amzLinkPara(CNH.link.codigo) }).catch(function(){});
}
