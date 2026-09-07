// NAV — troca de paginas (desktop e mobile).

// NAV
document.querySelectorAll('.nav-item').forEach(function(el){
  el.addEventListener('click',function(){
    var page=el.dataset.page;goToPage(page);
    document.querySelectorAll('.mobile-nav-item').forEach(function(n){n.classList.toggle('active',n.dataset.page===page);});
  });
});
function goToPage(name){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.toggle('active',n.dataset.page===name);});
  if(name==='home')renderHome();
  else if(name==='metas')renderMetas();
  else if(name==='tarefas')renderTasks();
  else if(name==='gastos')renderGastos();
  else if(name==='estudos')renderEstudos();
  else if(name==='notas')renderNotas();
  else if(name==='resumo')renderResumo();
  else if(name==='agenda')renderAgenda();
  else if(name==='leitura')renderLeitura();
  else if(name==='perfil')renderPerfil();
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
