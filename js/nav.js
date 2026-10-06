// NAV — troca de paginas (desktop e mobile).

// NAV
document.querySelectorAll('.nav-item').forEach(function(el){
  el.addEventListener('click',function(){
    var page=el.dataset.page;
    if(!page) return;   // o botao de tema mora no menu mas nao e pagina
    goToPage(page);
    document.querySelectorAll('.mobile-nav-item').forEach(function(n){n.classList.toggle('active',n.dataset.page===page);});
  });
});
// Ligada so durante a pintura que vem de uma navegacao. E o que distingue
// "a lista chegou" de "a pessoa mexeu na lista" — ver marcarEntradaDaGrade().
var chegandoNaPagina = false;

function goToPage(name){
  // Pagina que nao existe nao pode apagar a atual: antes, as paginas eram
  // escondidas primeiro e o erro vinha depois — tela em branco.
  if(!document.getElementById('page-'+name)) return;
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.getElementById('page-'+name).classList.add('active');
  // "Conhecer novos Ticolinos" e uma pagina de dentro de Amizades.
  var noMenu = name === 'conhecer' ? 'amizades' : name;
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.toggle('active',n.dataset.page===noMenu);});
  // A barra de baixo do celular tambem: sem isto, chegar numa pagina por um
  // botao (e nao pela barra) deixava a aba anterior acesa.
  document.querySelectorAll('.mobile-nav-item').forEach(function(n){n.classList.toggle('active',n.dataset.page===noMenu);});
  // A barra rola para o lado (sao muitas abas): a acesa entra na tela.
  var acesa = document.querySelector('.mobile-nav-item.active');
  if(acesa && acesa.parentNode && acesa.parentNode.scrollWidth > acesa.parentNode.clientWidth){
    var barra = acesa.parentNode, l = acesa.offsetLeft, r = l + acesa.offsetWidth;
    if(l < barra.scrollLeft) barra.scrollLeft = l - 8;
    else if(r > barra.scrollLeft + barra.clientWidth) barra.scrollLeft = r - barra.clientWidth + 8;
  }
  document.body.classList.toggle('na-home', name === 'home');
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
function mobileNav(el,page){document.querySelectorAll('.mobile-nav-item').forEach(function(n){n.classList.remove('active');});el.classList.add('active');goToPage(page);}


// ═══════════════════════════════════════════════════════════════════════
// GAVETA DO MENU NO CELULAR
//
// No desktop a barra lateral esta sempre la e abre no hover. No celular ela
// ficava escondida e as opcoes que so existem nela — tema, nivel, rotulos —
// nao tinham como ser alcancadas. Agora ela vira gaveta: um botao abre, um
// toque fora fecha.
// ═══════════════════════════════════════════════════════════════════════

function menuAberto(){
  return document.body.classList.contains('menu-aberto');
}

function abrirMenu(){
  document.body.classList.add('menu-aberto');
  var b = document.getElementById('btn-menu');
  if (b) { b.setAttribute('aria-expanded','true'); b.setAttribute('aria-label', T('fecharMenu')); }
  // Leva o foco para o primeiro item, senao quem usa teclado ou leitor de
  // tela abre a gaveta e continua preso no conteudo atras dela.
  var primeiro = document.querySelector('#sidebar .nav-item');
  if (primeiro && primeiro.focus) primeiro.focus();
}

function fecharMenu(){
  if (!menuAberto()) return;
  document.body.classList.remove('menu-aberto');
  var b = document.getElementById('btn-menu');
  if (b) {
    b.setAttribute('aria-expanded','false');
    b.setAttribute('aria-label', T('abrirMenu'));
    b.focus();   // devolve o foco a quem abriu
  }
}

function alternarMenu(){
  if (menuAberto()) fecharMenu(); else abrirMenu();
}

// Escolher uma pagina fecha a gaveta — ninguem quer fechar na mao depois.
document.addEventListener('click', function(e){
  if (!menuAberto()) return;
  if (e.target.closest('#sidebar .nav-item')) fecharMenu();
});

// Esc fecha, como em qualquer painel sobreposto.
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && menuAberto()) fecharMenu();
});

// Ao voltar para a largura de desktop a barra ja aparece sozinha; deixar a
// classe ligada manteria o fundo escurecido por cima da tela.
window.addEventListener('resize', function(){
  if (window.innerWidth > 768) fecharMenu();
});
