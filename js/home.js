// HOME — tela inicial, frase do dia e o gatilho de login
// (onAuthStateChange), que vive aqui por chamar renderHome().

sb.auth.onAuthStateChange(function(event,session){
  if(session&&session.user){
    currentUser=session.user;
    loadUserData().then(function(){
      document.getElementById('auth-screen').style.display='none';
      document.getElementById('app').style.visibility='visible';
      updateGroupSelects();updateGroupFilters();renderHome();
    }).catch(function(err){
      // Even if loadUserData fails, show the app with empty state
      console.error('loadUserData error:', err);
      document.getElementById('auth-screen').style.display='none';
      document.getElementById('app').style.visibility='visible';
      updateGroupSelects();updateGroupFilters();renderHome();
    });
  }else{
    currentUser=null;
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('app').style.visibility='hidden';
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
function renderHome(){
  if(!document.getElementById('home-stat-tasks')) return;
  var active=state.tasks.filter(function(t){return !t.done;});
  document.getElementById('home-stat-tasks').textContent=active.length;
  document.getElementById('home-stat-metas').textContent=state.metas.length;
  var total=[].concat(state.metas,state.tasks).filter(function(i){return i.budget;}).reduce(function(s,i){return s+parseFloat(i.budget||0);},0);
  document.getElementById('home-stat-gastos').textContent='R$'+total.toFixed(0);
  var all=[].concat(state.tasks,state.metas).filter(function(i){return !i.done;});
  document.getElementById('home-task-count').textContent=all.length+' item'+(all.length!==1?'s':'');
  var scroll=document.getElementById('home-tasks-scroll');
  if(all.length===0){scroll.innerHTML='<div style="color:var(--text-muted);font-size:13px;padding:20px 0">Sem itens em andamento</div>';return;}
  scroll.innerHTML=all.map(function(item){
    return '<div class="task-mini" onclick="openDetail(\''+item._type+'\',\''+item.id+'\')">'+
      '<div class="task-mini-img">'+(item.img?'<img src="'+item.img+'">':`<div class="default-icon">✓</div>`)+`</div>`+
      `<div class="task-mini-label">Objetivo</div>`+
      `<div class="task-mini-title">`+esc(item.name)+`</div>`+
      `<div class="task-mini-desc">`+esc(item.desc||'')+`</div></div>`;
  }).join('');
}
function scrollTasks(dir){document.getElementById('home-tasks-scroll').scrollBy({left:dir*200,behavior:'smooth'});}
