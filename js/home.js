// HOME — tela inicial, frase do dia e o gatilho de login
// (onAuthStateChange), que vive aqui por chamar renderHome().

sb.auth.onAuthStateChange(function(event,session){
  // O link de recuperacao enviado por email tambem cria uma sessao valida.
  // Sem este desvio, o usuario entraria direto no app em vez de trocar a senha.
  if(event==='PASSWORD_RECOVERY'){
    currentUser=session?session.user:null;
    abrirNovaSenha();
    return;
  }
  if(session&&session.user){
    currentUser=session.user;
    loadUserData().then(function(){
      document.getElementById('auth-screen').style.display='none';
      document.getElementById('app').style.visibility='visible';
      // O XP vinha zerado na Home ate o usuario visitar a pagina Estudos,
      // porque loadStudyXP() so era chamado de dentro de renderEstudos().
      // Todo dado compartilhado precisa ser hidratado aqui, no carregamento.
      if (typeof loadStudyXP === 'function') loadStudyXP();
      updateGroupSelects();updateGroupFilters();renderHome();
      if (migrarCoresCategorias()) saveState();   // categorias antigas nasceram roxas
      sincronizar();   // traz o que outro aparelho fez e envia o que ficou pendente
    }).catch(function(err){
      // Nao entrar no app com o estado vazio: o usuario acharia que perdeu
      // tudo, e a primeira gravacao sobrescreveria os dados de verdade.
      console.error('loadUserData error:', err);
      mostrarFalhaDeCarga(err);
    });
  }else{
    currentUser=null;
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('app').style.visibility='hidden';
    if(typeof mostrarEtapaAuth==='function') mostrarEtapaAuth('auth-form-wrap');
    setAuthLoading(false);
  }
});

// QUOTES
var QUOTES=[
  '"O homem sofre mais na imaginação do que na realidade." — Sêneca',
  '"Conhece-te a ti mesmo." — Sócrates',
  '"Você tem poder sobre sua mente, não sobre eventos externos." — Marco Aurélio',
  '"A única maneira de fazer um grande trabalho é amar o que você faz." — Steve Jobs',
  '"Seja a mudança que você quer ver no mundo." — Gandhi',
  '"A felicidade não é algo pronto. Ela vem de suas próprias ações." — Dalai Lama',
  '"Na ausência do vento, rema." — Provérbio latino',
  '"O segredo é começar." — Mark Twain',
  '"Nada é permanente exceto a mudança." — Heráclito',
  '"Viver é a coisa mais rara do mundo. A maioria das pessoas apenas existe." — Oscar Wilde',
];
document.getElementById('daily-quote').textContent=QUOTES[Math.floor(Math.random()*QUOTES.length)];

// HOME
// ─── Streak e tarefas do dia ───────────────────────────
function hojeStr(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function ontemStr(){var d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}

// Garante que state.diario e state.streak existam e estejam no dia certo.
function garantirDiario(){
  if(!state.streak) state.streak={count:0,lastDay:null};
  if(!state.diario || state.diario.data!==hojeStr()){
    state.diario={data:hojeStr(),leitura:false,estudo:false,grana:false};
  }
  return state.diario;
}
function tarefasDoDiaFeitas(){
  var d=garantirDiario();
  return (d.leitura?1:0)+(d.estudo?1:0)+(d.grana?1:0);
}
// Marca/desmarca uma tarefa do dia, atualiza streak e XP.
function toggleTarefaDia(chave){
  var d=garantirDiario();
  d[chave]=!d[chave];
  if(d[chave]) addXP(10); else addXP(-10);
  atualizarStreak();
  saveState();
  renderHome();
}
// O streak sobe uma vez por dia, no primeiro item marcado.
function atualizarStreak(){
  var s=state.streak, hoje=hojeStr();
  if(tarefasDoDiaFeitas()===0) return;
  if(s.lastDay===hoje) return;
  s.count = (s.lastDay===ontemStr()) ? s.count+1 : 1;
  s.lastDay=hoje;
}

var TAREFAS_DIA=[
  {chave:'leitura', tag:'LEITURA', rotulo:'20 minutos de leitura'},
  {chave:'estudo',  tag:'ESTUDOS', rotulo:'1 pomodoro de estudo'},
  {chave:'grana',   tag:'GRANA',   rotulo:'Lançar os gastos do dia'}
];

function renderHome(){
  if(!document.getElementById('home-today-list')) return;
  var d=garantirDiario(), feitos=tarefasDoDiaFeitas();

  // Saudação e data
  var hora=new Date().getHours();
  var saud = hora<12 ? T('goodMorning') : (hora<18 ? T('goodAfternoon') : T('goodEvening'));
  var nome=(state.perfil&&state.perfil.name)||'';
  document.getElementById('home-greeting').textContent=saud+(nome?', '+nome:'');
  document.getElementById('home-date').textContent=new Date().toLocaleDateString(idiomaAtual()==='en'?'en-US':'pt-BR',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('home-avatar').innerHTML = (state.perfil&&state.perfil.avatar)
    ? '<img src="'+state.perfil.avatar+'" alt="">'
    : ticolino('feliz',48,true);

  // Streak e XP (reaproveita o XP dos Estudos)
  var xp=(typeof studyXP==='number'?studyXP:0);
  var nivel=Math.floor(xp/100)+1, noNivel=xp%100;
  document.getElementById('home-streak').textContent=state.streak.count;
  document.getElementById('home-level').textContent=T('level')+' '+nivel;
  document.getElementById('home-xp').textContent=noNivel+'/100 XP';
  document.getElementById('home-xp-bar').style.width=noNivel+'%';

  // Ticolino e sua fala
  document.getElementById('home-tico').innerHTML=ticolino(ticoHumorDoDia(),56);
  document.getElementById('home-tico-msg').textContent =
    feitos===0 ? T('msgStart') : (feitos>=3 ? T('msgDone') : T('msgMid'));

  // Lista do dia
  document.getElementById('home-today-count').textContent=feitos+' '+T('deTresConcluidos');
  document.getElementById('home-today-list').innerHTML=TAREFAS_DIA.map(function(t){
    var on=d[t.chave];
    return '<button class="tico-today-item" onclick="toggleTarefaDia(\''+t.chave+'\')">'+
      '<span class="tico-check'+(on?' on':'')+'"></span>'+
      '<span class="tico-today-info"><span class="tico-today-tag">'+T('tag_'+t.chave)+'</span>'+
      '<span class="tico-today-label">'+T('day_'+t.chave)+'</span></span>'+
      '<span class="tico-today-xp">+10 XP</span></button>';
  }).join('');

  // Cartoes rapidos.
  // Este cartao somava o campo 'budget' de metas e tarefas e nunca lia
  // state.gastos — mostrava R$0 para quem tinha lancamentos. Agora soma os
  // gastos do mes corrente, que e o que o rotulo promete.
  var hoje=new Date(), mes=hoje.getMonth(), ano=hoje.getFullYear();
  var gastoMes=(state.gastos||[]).filter(function(g){
    var d=new Date(g.data+'T12:00:00');
    return d.getMonth()===mes && d.getFullYear()===ano;
  }).reduce(function(s,g){return s+(parseFloat(g.valor)||0);},0);
  document.getElementById('home-stat-gastos').textContent=moeda(gastoMes);
  document.getElementById('home-stat-metas').textContent=state.metas.length;

  // Sub-rotulos dos dois atalhos (design system): quantos lancamentos no mes
  // e quantas metas vencem neste mes.
  var doMes=(state.gastos||[]).filter(function(g){
    var d=new Date(g.data+'T12:00:00');
    return d.getMonth()===mes && d.getFullYear()===ano;
  }).length;
  var sg=document.getElementById('home-stat-gastos-sub');
  if(sg) sg.textContent=doMes+' '+T(doMes===1?'lancamento':'lancamentos');

  var vencem=(state.metas||[]).filter(function(m){
    if(m.done||!m.deadline) return false;
    var d=new Date(m.deadline+'T12:00:00');
    return d.getMonth()===mes && d.getFullYear()===ano;
  }).length;
  var sm=document.getElementById('home-stat-metas-sub');
  if(sm) sm.textContent = vencem ? vencem+' '+T(vencem===1?'venceEsteMes':'vencemEsteMes') : '';

  // Em andamento (mantido do app original)
  var all=[].concat(state.tasks,state.metas).filter(function(i){return !i.done;});
  document.getElementById('home-stat-tasks').textContent=state.tasks.filter(function(t){return !t.done;}).length;
  document.getElementById('home-task-count').textContent=all.length+' '+(all.length!==1?T('items'):T('item'));
  var scroll=document.getElementById('home-tasks-scroll');
  if(all.length===0){
    scroll.innerHTML='<div class="empty-inline">'+T('nothingRunning')+'</div>';
    ajustarSetasCarrossel();
    return;
  }
  scroll.innerHTML=all.map(function(item){
    return '<div class="task-mini" onclick="openDetail(\''+item._type+'\',\''+item.id+'\')">'+
      '<div class="task-mini-img">'+(item.img?'<img src="'+item.img+'">':'<div class="default-icon">✓</div>')+'</div>'+
      '<div class="task-mini-label">'+T('objective')+'</div>'+
      '<div class="task-mini-title">'+esc(item.name)+'</div>'+
      '<div class="task-mini-desc">'+esc(item.desc||'')+'</div></div>';
  }).join('');
  ajustarSetasCarrossel();
}

// As setas do carrossel so aparecem quando ha conteudo alem da largura visivel.
function ajustarSetasCarrossel(){
  var scroll=document.getElementById('home-tasks-scroll');
  if(!scroll) return;
  var precisa = scroll.scrollWidth > scroll.clientWidth + 4;
  document.querySelectorAll('.scroll-arrows .scroll-arrow').forEach(function(b){
    b.hidden = !precisa;
  });
}
window.addEventListener('resize', ajustarSetasCarrossel);
function scrollTasks(dir){document.getElementById('home-tasks-scroll').scrollBy({left:dir*200,behavior:'smooth'});}


// ═══════════════════════════════════════════════════════════════════════
// A FLORESTA DO TICOLINO — cenario de fundo da Home
//
// Cinco planos de silhueta (montanhas ao longe, arvores distantes, arvores
// do meio, colina da frente, arvores em primeiro plano), cada um com uma
// taxa de parallax diferente contra o mouse e a rolagem, mais o brilho do
// sol baixo e quatro passaros cruzando o ceu.
//
// So a Home recebe o cenario. Em todas as paginas viraria papel de parede
// e deixaria de significar alguma coisa.
//
// As silhuetas sao `fill` de SVG e nao podem vir de token, entao o modulo
// observa o atributo data-theme e se repinta. No claro a profundidade volta
// ao normal: longe fica pálido, perto e o mais escuro da tela.
// ═══════════════════════════════════════════════════════════════════════

var FLORESTA_VB_W = 1200, FLORESTA_VB_H = 460;

// Conifera estilizada: andares de triangulos empilhados + tronco.
function floresteConifera(x, baseY, h, w, andares){
  andares = andares || 5;
  var d = '';
  for (var i = 0; i < andares; i++) {
    var t = i / andares;
    var topo = baseY - h * (1 - t * 0.78);
    var base = topo + h * 0.3;
    var meia = (w / 2) * (0.32 + 0.68 * ((i + 1) / andares));
    d += 'M' + x + ' ' + topo +
         'L' + (x + meia) + ' ' + base +
         'L' + (x + meia * 0.52) + ' ' + base +
         'L' + (x + meia * 0.78) + ' ' + (base + h * 0.06) +
         'L' + (x - meia * 0.78) + ' ' + (base + h * 0.06) +
         'L' + (x - meia * 0.52) + ' ' + base +
         'L' + (x - meia) + ' ' + base + 'Z';
  }
  var tw = Math.max(1.5, w * 0.045);
  d += 'M' + (x - tw) + ' ' + (baseY - h * 0.06) +
       'L' + (x + tw) + ' ' + (baseY - h * 0.06) +
       'L' + (x + tw) + ' ' + baseY +
       'L' + (x - tw) + ' ' + baseY + 'Z';
  return d;
}

var FLORESTA_MONTANHAS =
  'M-60 330L110 208L214 262L330 168L452 268L560 226L648 300L700 330Z' +
  'M620 330L742 214L830 258L940 176L1046 250L1140 202L1260 330Z';
var FLORESTA_COLINA_MEIO =
  'M-60 360C90 316 176 336 268 352C382 372 470 330 596 338C712 346 800 320 906 330C1010 340 1120 366 1260 350L1260 470L-60 470Z';
var FLORESTA_COLINA_PERTO =
  'M-60 424C120 400 240 416 392 428C548 440 664 414 810 420C946 426 1080 442 1260 424L1260 480L-60 480Z';

var FLORESTA_ARVORES_LONGE = [floresteConifera(392,336,74,34,5), floresteConifera(438,338,54,26,4)];
var FLORESTA_ARVORES_MEIO  = [floresteConifera(150,380,128,56,6), floresteConifera(232,384,96,44,5),
                              floresteConifera(905,378,140,62,6), floresteConifera(978,384,104,48,5)];
var FLORESTA_ARVORES_PERTO = [floresteConifera(74,452,212,92,7), floresteConifera(186,460,156,70,6),
                              floresteConifera(1096,452,238,104,7)];

var FLORESTA_PASSARO = 'M0 0C4.2 -4.6 8.4 -4.6 12 -0.6C15.6 -4.6 19.8 -4.6 24 0';
var FLORESTA_BANDO = [
  {atraso:0,   dur:26, y:96,  escala:1,    de:168, deriva:-34},
  {atraso:3.5, dur:30, y:132, escala:0.78, de:210, deriva:-20},
  {atraso:9,   dur:23, y:74,  escala:0.62, de:138, deriva:-46},
  {atraso:15,  dur:34, y:158, escala:0.5,  de:246, deriva:-12}
];

var FLORESTA_PALETAS = {
  dark:  {longe1:'#26332A',longe2:'#1B241D',meio1:'#1C271F',meio2:'#141C16',
          arvLonge:'#212D24',arvMeio:'#141D17',colina:'#0D120E',arvPerto:'#080B08',
          passaro:'#EBE3A7',passaroOp:0.34,vale:0.2},
  light: {longe1:'#AFC0A8',longe2:'#9EB198',meio1:'#88A085',meio2:'#75906F',
          arvLonge:'#8CA487',arvMeio:'#5E7C5B',colina:'#4A6547',arvPerto:'#37502F',
          passaro:'#2E2910',passaroOp:0.6,vale:0.08}
};

function montarFloresta(){
  var host = document.getElementById('floresta');
  if (!host) return;
  var claro = document.documentElement.getAttribute('data-theme') === 'light';
  var P = FLORESTA_PALETAS[claro ? 'light' : 'dark'];

  function caminhos(lista, cor, op){
    return lista.map(function(d){
      return '<path d="' + d + '" fill="' + cor + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
    }).join('');
  }

  var passaros = FLORESTA_BANDO.map(function(b, i){
    return '<g class="floresta-passaro" style="--deriva:' + b.deriva + 'px;' +
             'animation:floresta-voo ' + b.dur + 's linear ' + b.atraso + 's infinite">' +
             '<g transform="translate(' + b.de + ' ' + b.y + ') scale(' + b.escala + ')">' +
               '<g style="animation:floresta-asa ' + (0.42 + i * 0.07) + 's ease-in-out infinite;transform-origin:12px 0">' +
                 '<path d="' + FLORESTA_PASSARO + '" fill="none" stroke="' + P.passaro +
                 '" stroke-opacity="' + (P.passaroOp - i * 0.045) + '" stroke-width="2.4" stroke-linecap="round"/>' +
               '</g></g></g>';
  }).join('');

  host.innerHTML =
    // Luz do sol no ceu, acima da linha das cristas.
    '<div class="floresta-ceu" style="background:' +
      'radial-gradient(56% 62% at 66% 58%,rgba(245,160,61,' + (claro?0.16:0.22) + ') 0%,rgba(235,125,0,' + (claro?0.07:0.11) + ') 38%,rgba(235,125,0,0) 72%),' +
      'radial-gradient(120% 84% at 50% 100%,rgba(44,87,69,' + (claro?0.1:0.26) + ') 0%,rgba(44,87,69,0) 70%)"></div>' +
    // preserveAspectRatio="none" de proposito: numa silhueta abstrata o
    // esticamento horizontal e imperceptivel, e garante que as nove arvores
    // e o bando fiquem enquadrados em qualquer largura.
    '<svg viewBox="0 0 ' + FLORESTA_VB_W + ' ' + FLORESTA_VB_H + '" preserveAspectRatio="none" class="floresta-svg">' +
      '<defs>' +
        '<linearGradient id="floresta-longe" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + P.longe1 + '"/><stop offset="100%" stop-color="' + P.longe2 + '"/></linearGradient>' +
        '<linearGradient id="floresta-meio" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + P.meio1 + '"/><stop offset="100%" stop-color="' + P.meio2 + '"/></linearGradient>' +
        '<radialGradient id="floresta-sol" cx="0.5" cy="0.5" r="0.5">' +
          '<stop offset="0%" stop-color="#F5A03D" stop-opacity="' + (claro?0.26:0.36) + '"/>' +
          '<stop offset="45%" stop-color="#EB7D00" stop-opacity="' + (claro?0.11:0.16) + '"/>' +
          '<stop offset="100%" stop-color="#EB7D00" stop-opacity="0"/></radialGradient>' +
        // Neblina do vale: da as arvores da frente um fundo mais claro para
        // recortarem contra. Sem isso, preto sobre preto.
        '<linearGradient id="floresta-vale" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#3A7059" stop-opacity="0"/>' +
          '<stop offset="52%" stop-color="#3A7059" stop-opacity="' + P.vale + '"/>' +
          '<stop offset="100%" stop-color="#3A7059" stop-opacity="0.05"/></linearGradient>' +
      '</defs>' +
      '<g data-plano="0.22"><path d="' + FLORESTA_MONTANHAS + '" fill="url(#floresta-longe)" opacity="0.7"/></g>' +
      // O sol entra aqui: na frente das montanhas, atras das colinas — e por
      // isso le como luz vindo detras da crista.
      '<ellipse cx="792" cy="318" rx="560" ry="230" fill="url(#floresta-sol)"/>' +
      '<g data-plano="0.45">' + caminhos(FLORESTA_ARVORES_LONGE, P.arvLonge, 0.72) +
        '<path d="' + FLORESTA_COLINA_MEIO + '" fill="url(#floresta-meio)" opacity="0.88"/></g>' +
      '<g data-plano="0.72">' + caminhos(FLORESTA_ARVORES_MEIO, P.arvMeio) + '</g>' +
      '<rect x="0" y="336" width="' + FLORESTA_VB_W + '" height="124" fill="url(#floresta-vale)"/>' +
      '<g data-plano="1"><path d="' + FLORESTA_COLINA_PERTO + '" fill="' + P.colina + '"/></g>' +
      '<g data-plano="1.35">' + caminhos(FLORESTA_ARVORES_PERTO, P.arvPerto) + '</g>' +
      passaros +
    '</svg>' +
    '';   // o topo da paisagem se dissolve por mascara no CSS (.floresta-svg)

  ligarParallaxFloresta(host);
}

var florestaSolto = null;   // guarda como desligar o parallax anterior

function ligarParallaxFloresta(host){
  if (florestaSolto) { florestaSolto(); florestaSolto = null; }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var planos = host.querySelectorAll('[data-plano]');
  var mx = 0, my = 0, rolagem = 0, quadro = null;

  function aplicar(){
    quadro = null;
    for (var i = 0; i < planos.length; i++) {
      var d = Number(planos[i].getAttribute('data-plano'));
      planos[i].style.transform =
        'translate3d(' + (mx * 26 * d).toFixed(2) + 'px,' +
        (my * 12 * d - rolagem * 0.34 * d).toFixed(2) + 'px,0)';
    }
  }
  function agendar(){ if (quadro == null) quadro = requestAnimationFrame(aplicar); }

  function noMouse(e){
    var r = host.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width * 2 - 1;
    my = (e.clientY - r.top) / Math.max(r.height, 1) * 2 - 1;
    agendar();
  }
  // Quem rola de verdade e o #main, nao a janela.
  var rolante = document.getElementById('main') || window;
  function naRolagem(){
    rolagem = rolante === window ? window.scrollY : rolante.scrollTop;
    agendar();
  }
  window.addEventListener('mousemove', noMouse, {passive:true});
  rolante.addEventListener('scroll', naRolagem, {passive:true});

  florestaSolto = function(){
    window.removeEventListener('mousemove', noMouse);
    rolante.removeEventListener('scroll', naRolagem);
    if (quadro != null) cancelAnimationFrame(quadro);
  };
}

document.addEventListener('DOMContentLoaded', function(){
  montarFloresta();
  // As silhuetas sao fill de SVG: nao seguem token, precisam ser repintadas.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(montarFloresta).observe(document.documentElement,
      {attributes:true, attributeFilter:['data-theme']});
  }
});
