// NAV — troca de paginas (desktop e mobile).

// NAV — cinco destinos (Design System 2). Cada pagina pertence a um grupo;
// o menu acende o grupo e as abas do cabecalho levam as paginas de dentro.
// Tocar num grupo volta para a ultima pagina vista nele.
var NAV_GRUPO = {
  home: 'hoje',
  tarefas: 'rotina', agenda: 'rotina', quadro: 'rotina', exercicios: 'rotina', notas: 'rotina',
  gastos: 'dinheiro',
  metas: 'evolucao', estudos: 'evolucao', leitura: 'evolucao', resumo: 'evolucao',
  perfil: 'voce', amizades: 'voce', conhecer: 'voce'
};
var NAV_INICIO = { hoje: 'home', rotina: 'tarefas', dinheiro: 'gastos', evolucao: 'metas', voce: 'perfil' };
var navUltima = {};
var NAV_ROTULO = {
  tarefas: 'Tarefas', agenda: 'Agenda', quadro: 'Quadro', exercicios: 'Exercícios', notas: 'Notas',
  metas: 'Metas', estudos: 'Estudos', leitura: 'Leitura', resumo: 'Resumo',
  perfil: 'Perfil', amizades: 'Amizades'
};

// As abas do grupo no topo de cada cabecalho (<nav class="md-gt" data-abas>).
function montarAbasGrupo(){
  document.querySelectorAll('.md-gt[data-abas]').forEach(function(nav){
    var g = nav.dataset.abas;
    nav.innerHTML = Object.keys(NAV_ROTULO).filter(function(p){ return NAV_GRUPO[p] === g; }).map(function(p){
      return '<button type="button" data-pagina="' + p + '" onclick="goToPage(\'' + p + '\')">' + NAV_ROTULO[p] + '</button>';
    }).join('');
  });
}
montarAbasGrupo();

// Ticolinos fixos dos pop-ups (livro terminado, leitura abandonada). Os
// pop-ups ficam depois dos scripts no index.html, entao espera a pagina.
function pintarTicosDosModais(){
  document.querySelectorAll('[data-tico-modal]').forEach(function(el){
    if(!el.firstChild) el.innerHTML = ticolino(el.dataset.ticoModal, 96);
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintarTicosDosModais);
else pintarTicosDosModais();

// ─── Tempo no titulo da aba ────────────────────────────────────────────
// Com o timer de Estudos ou o cronometro de treino contando, o tempo vai para
// o titulo da aba do navegador ("24:13 · Estudando · Mindt"), para a pessoa
// ver de outra aba quanto falta. Pausou, zerou ou acabou: volta a "Mindt".
//
// O tique vem de um Web Worker: o navegador segura os timers de uma aba em
// segundo plano (depois de alguns minutos, um por minuto), e o titulo existe
// justamente para quem esta em outra aba. Sem Worker, vale um setInterval.
var TITULO_PADRAO = 'Mindt';
var tituloTique = null;

// O texto do tempo, calculado do relogio (nao do mostrador da pagina, que
// pode estar parado com a pagina fora de vista); '' sem nada contando.
function tempoNaAba(){
  if(typeof timerRunning !== 'undefined' && timerRunning && timerStartedAt){
    var resta = Math.max(0, timerBaseRemaining - Math.floor((Date.now() - timerStartedAt) / 1000));
    return pad(Math.floor(resta / 60)) + ':' + pad(resta % 60) + ' · ' + T('abaEstudando');
  }
  if(typeof exRodando === 'function' && exRodando()){
    return exTempo(exDecorrido()) + ' · ' + T('abaTreinando');
  }
  return '';
}
function pintarTituloDaAba(){
  var t = tempoNaAba();
  document.title = t ? t + ' · ' + TITULO_PADRAO : TITULO_PADRAO;
  if(!t) desligarTituloDaAba();
}
// Chamado quando um timer comeca (e ao abrir o app, para um treino que ja
// estava contando). Sem nada contando, so deixa o titulo como "Mindt".
function ligarTituloDaAba(){
  pintarTituloDaAba();
  if(tituloTique || !tempoNaAba()) return;
  tituloTique = criarTique(pintarTituloDaAba);
}
function desligarTituloDaAba(){
  if(tituloTique){ tituloTique.parar(); tituloTique = null; }
}
function criarTique(fn){
  try {
    var url = URL.createObjectURL(new Blob(['setInterval(function(){ postMessage(0); }, 1000);'], { type: 'text/javascript' }));
    var w = new Worker(url);
    w.onmessage = function(){ fn(); };
    return { parar: function(){ w.terminate(); URL.revokeObjectURL(url); } };
  } catch(e) {
    var id = setInterval(fn, 1000);
    return { parar: function(){ clearInterval(id); } };
  }
}

function goToGrupo(grupo){
  var pagina = navUltima[grupo] || NAV_INICIO[grupo];
  if(pagina) goToPage(pagina);
}
document.querySelectorAll('[data-grupo]').forEach(function(el){
  el.addEventListener('click', function(){ goToGrupo(el.dataset.grupo); });
});

// Ligada so durante a pintura que vem de uma navegacao. E o que distingue
// "a lista chegou" de "a pessoa mexeu na lista" — ver marcarEntradaDaGrade().
var chegandoNaPagina = false;

function goToPage(name){
  // Pagina que nao existe nao pode apagar a atual: antes, as paginas eram
  // escondidas primeiro e o erro vinha depois — tela em branco.
  if(!document.getElementById('page-'+name)) return;
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  var pg = document.getElementById('page-'+name);
  pg.classList.add('active');
  // O menu (lateral e de baixo) acende o grupo da pagina, mesmo quando se
  // chega nela por um botao e nao pelo menu.
  var grupo = NAV_GRUPO[name] || 'hoje';
  if(name !== 'conhecer') navUltima[grupo] = name;
  document.querySelectorAll('[data-grupo]').forEach(function(n){
    var on = n.dataset.grupo === grupo;
    n.classList.toggle('active', on);
    if(on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  });
  // As abas do cabecalho (as paginas do grupo) marcam a pagina aberta.
  pg.querySelectorAll('.md-gt [data-pagina]').forEach(function(b){
    var on = b.dataset.pagina === (name === 'conhecer' ? 'amizades' : name);
    if(on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.body.classList.toggle('na-home', name === 'home');
  // O Ticolino do cabecalho (data-tico="humor") e desenhado aqui: ele usa a
  // cor que a pessoa escolheu, que pode ter mudado desde a ultima visita.
  pg.querySelectorAll('[data-tico]').forEach(function(el){
    el.innerHTML = ticolino(el.dataset.tico, parseInt(el.dataset.ticoTam, 10) || 100);
  });
  chegandoNaPagina = true;
  if(typeof notifAlternar === 'function' && typeof NOTIF !== 'undefined' && NOTIF.aberto) notifAlternar(false);
  try {
  if(name==='home')renderHome();
  else if(name==='metas')renderMetas();
  else if(name==='tarefas')filterTasks('pending');
  else if(name==='gastos')renderFinancas();
  else if(name==='estudos')renderEstudos();
  else if(name==='notas')renderNotas();
  else if(name==='resumo')renderResumo();
  else if(name==='agenda')renderAgenda();
  else if(name==='quadro')renderQuadro();
  else if(name==='exercicios')renderExercicios();
  else if(name==='leitura')renderLeitura();
  else if(name==='perfil')renderPerfil();
  else if(name==='amizades')renderAmizades();
  else if(name==='conhecer')renderConhecer();
  } finally { chegandoNaPagina = false; }
  // Pagina nova comeca do topo. Sem isto a rolagem da pagina anterior
  // ficava: quem estava no fim de uma lista longa chegava numa pagina curta
  // "rolado" alem do fim — e o Safari do iPhone mostrava a tela em branco.
  var rolante = document.getElementById('main');
  if(rolante) rolante.scrollTop = 0;
  try { window.scrollTo(0, 0); } catch(e) {}
  // Os numeros que ocupam um cartao inteiro so podem ser medidos depois de
  // pintados e com a pagina visivel. Este e o unico funil por onde toda
  // pagina passa, entao o ajuste mora aqui e nao em cada render.
  if(typeof encaixarNumeros === 'function') encaixarNumeros(document.getElementById('page-'+name));
  // A faixa do teste muda por pagina (discreta so aparece na Home).
  if(typeof pintarFaixaTeste === 'function') pintarFaixaTeste();
}


// O icone do destino "Voce" (familia Toca, js/icones.js) acompanha a cor do
// Ticolino que a pessoa escolheu: o rosto pega a pelagem (--tp) e os olhos
// e listras pegam o traco (--tc). As cores vem da tabela fixa TICO_CORES,
// nunca de texto digitado.
function pintarRostoMenu(){
  if(typeof estiloCorTico !== 'function' || typeof minhaCorTico !== 'function') return;
  var estilo = estiloCorTico(minhaCorTico());
  document.querySelectorAll('.nav-voce').forEach(function(el){ el.setAttribute('style', estilo); });
}
