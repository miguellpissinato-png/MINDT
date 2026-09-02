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
