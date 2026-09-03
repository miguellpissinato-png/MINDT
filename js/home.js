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
  document.getElementById('home-tico').innerHTML=ticolino(ticoHumorDoDia(),84);
  document.getElementById('home-tico-msg').textContent =
    feitos===0 ? T('msgStart') : (feitos>=3 ? T('msgDone') : T('msgMid'));

  // Lista do dia
  document.getElementById('home-today-count').textContent=feitos+'/3';
  document.getElementById('home-today-list').innerHTML=TAREFAS_DIA.map(function(t){
    var on=d[t.chave];
    return '<button class="tico-today-item" onclick="toggleTarefaDia(\''+t.chave+'\')">'+
      '<span class="tico-check'+(on?' on':'')+'"></span>'+
      '<span class="tico-today-info"><span class="tico-today-tag">'+T('tag_'+t.chave)+'</span>'+
      '<span class="tico-today-label">'+T('day_'+t.chave)+'</span></span>'+
      '<span class="tico-today-xp">+10 XP</span></button>';
  }).join('');

  // Cartoes rapidos
  var saldo=[].concat(state.metas,state.tasks).filter(function(i){return i.budget;}).reduce(function(s,i){return s+parseFloat(i.budget||0);},0);
  document.getElementById('home-stat-gastos').textContent='R$'+saldo.toFixed(0);
  document.getElementById('home-stat-metas').textContent=state.metas.length;

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
