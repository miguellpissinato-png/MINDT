// HOME — tela inicial, frase do dia e o gatilho de login
// (onAuthStateChange), que vive aqui por chamar renderHome().

sb.auth.onAuthStateChange(function(event,session){
  // O link de recuperacao enviado por email tambem cria uma sessao valida.
  // Sem este desvio, o usuario entraria direto no app em vez de trocar a senha.
  // O Supabase avisa PASSWORD_RECOVERY e LOGO DEPOIS manda a mesma sessao de
  // novo (INITIAL_SESSION/SIGNED_IN) — por isso vale o sinal guardado ate a
  // senha nova ser salva, e nao so o evento: antes, o segundo aviso abria o
  // app por cima da tela de nova senha.
  if(event==='PASSWORD_RECOVERY') LINK_DO_EMAIL.recuperacao=true;
  if(LINK_DO_EMAIL.recuperacao && session && session.user && event!=='SIGNED_OUT'){
    currentUser=session.user;
    abrirNovaSenha();
    return;
  }
  // Renovacao do token (a cada hora) e troca de senha nao sao um login novo:
  // recarregar os dados aqui trocaria o que esta na tela pela versao do
  // servidor, por cima de mudancas que ainda nao subiram.
  if((event==='TOKEN_REFRESHED'||event==='USER_UPDATED') && session && currentUser && currentUser.id===session.user.id
     && document.getElementById('app').style.visibility==='visible'){
    currentUser=session.user;
    return;
  }
  if(session&&session.user){
    entrarComSessao(session);
  }else{
    currentUser=null;
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('app').style.visibility='hidden';
    if(typeof mostrarEtapaAuth==='function') mostrarEtapaAuth('auth-form-wrap');
    setAuthLoading(false);
    // Voltou de um link de e-mail vencido ou ja usado: explicar, em vez de
    // largar a pessoa no login sem saber o que houve.
    if(LINK_DO_EMAIL.erro && typeof avisarLinkVencido==='function') avisarLinkVencido();
  }
});

// Carrega os dados da conta e abre o app. Tambem e o caminho depois de
// trocar a senha pelo link do e-mail.
function entrarComSessao(session){
    currentUser=session.user;
    // Separado de proposito: so falha AO CARREGAR os dados mostra a tela
    // "Nao conseguimos carregar seus dados". Um erro depois disso, ao
    // desenhar alguma tela, nao e problema de dados — antes ele caia no
    // mesmo .catch e trancava a pessoa fora do app com os dados ja em maos.
    // Antes de carregar: o que esta guardado neste navegador e desta conta?
    if (typeof prepararLocalPara === 'function') prepararLocalPara(currentUser.id);
    loadUserData().then(entrarNoApp, function(err){
      // Nao entrar no app com o estado vazio: o usuario acharia que perdeu
      // tudo, e a primeira gravacao sobrescreveria os dados de verdade.
      console.error('loadUserData error:', err);
      mostrarFalhaDeCarga(err);
    });
}

// Abre o app com os dados ja carregados. Cada passo roda isolado: se um
// falhar (uma tela com defeito, um arquivo velho no cache), os outros
// seguem e a pessoa entra do mesmo jeito. O erro vai para o console.
function entrarNoApp(){
  var falhou = [];
  var passo = function(nome, fn){
    try { fn(); } catch(e) { falhou.push(nome); console.error('entrar no app — ' + nome + ':', e); }
  };
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.visibility='visible';
  // O XP vinha zerado na Home ate o usuario visitar a pagina Estudos,
  // porque loadStudyXP() so era chamado de dentro de renderEstudos().
  // Todo dado compartilhado precisa ser hidratado aqui, no carregamento.
  passo('xp', function(){ if (typeof loadStudyXP === 'function') loadStudyXP(); });
  // O plano vem da tabela subscriptions e decide o que fica liberado.
  // Nao segura a entrada no app: enquanto nao chega, vale o Free.
  passo('plano', function(){ if (typeof carregarPlano === 'function') carregarPlano(); });
  passo('lembrete', function(){ if (typeof carregarLembrete === 'function') carregarLembrete(); });
  passo('grupos', function(){ updateGroupSelects(); updateGroupFilters(); });
  passo('home', renderHome);
  // Um treino que ja estava contando quando o app abriu volta para o titulo da aba.
  passo('titulo', function(){ if (typeof ligarTituloDaAba === 'function') ligarTituloDaAba(); });
  passo('categorias', function(){ if (migrarCoresCategorias()) saveState(); });   // categorias antigas nasceram roxas
  // Entradas recorrentes (salario e afins) que venceram enquanto o app
  // estava fechado. Roda aqui, e nao so na pagina de dinheiro, para o
  // saldo da Home ja nascer certo.
  passo('ganhos', function(){ if (typeof atualizarRecorrentes === 'function') atualizarRecorrentes(); });
  // Tarefas repetidas cujo dia (e hora) chegou voltam para a lista.
  passo('tarefas', function(){
    if (typeof atualizarTarefasRecorrentes === 'function' && atualizarTarefasRecorrentes()){ saveState(); renderHome(); }
  });
  passo('imagens', function(){ if (typeof encolherImagensAntigas === 'function') encolherImagensAntigas(); });
  passo('sync', sincronizar);   // traz o que outro aparelho fez e envia o que ficou pendente
  // Amizades: selo de pedidos, meus numeros na vitrine e o convite que a
  // pessoa abriu (?amigo=) antes de entrar.
  passo('amizades', function(){
    if (typeof amzCarregar === 'function') amzCarregar().then(function(){ publicarPerfil(true); amzConvitePendente(); });
  });
  passo('sino', function(){ if (typeof notifIniciar === 'function') notifIniciar(); });   // sininho da Home
  if (falhou.length) curarCacheVelho();
}

// Um erro ao abrir quase sempre e arquivo velho guardado no aparelho
// misturado com a pagina nova. Uma vez por sessao: apaga os arquivos
// guardados e recarrega, para tudo vir da mesma versao.
function curarCacheVelho(){
  try { if (sessionStorage.getItem('mindt-curou')) return; sessionStorage.setItem('mindt-curou', '1'); } catch(e) { return; }
  if (!window.caches) return;
  caches.keys().then(function(nomes){
    return Promise.all(nomes.filter(function(n){ return n.indexOf('mindt-') === 0; })
      .map(function(n){ return caches.delete(n); }));
  }).then(function(){ location.reload(); }).catch(function(){});
}

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
    state.diario={data:hojeStr(),leitura:false,estudo:false,grana:false,exercicio:false};
  }
  return state.diario;
}
function tarefasDoDiaFeitas(){
  var d=garantirDiario();
  return (d.leitura?1:0)+(d.estudo?1:0)+(d.grana?1:0)+(d.exercicio?1:0);
}
// Marca/desmarca uma tarefa do dia, atualiza streak e XP.
function toggleTarefaDia(chave){
  var d=garantirDiario();
  d[chave]=!d[chave];
  // O item de exercicio nao e so um check: dizer que treinou conta como dia
  // de treino na aba Exercicios. Quem sabe fazer essa conta e o modulo de
  // exercicios — aqui so se avisa que o check mudou.
  if(chave==='exercicio' && typeof exSincronizarDiaDeTreino==='function'){
    exSincronizarDiaDeTreino();
  }
  pagarItemDoDia(chave, d[chave], xpDaTarefaDia(chave));
  atualizarStreak();
  if(typeof registrarItensDoDia==='function') registrarItensDoDia();
  saveState();
  renderHome();
  // A aba Exercicios mostra o mesmo check; se estiver aberta, acompanha.
  if(typeof renderExercicios==='function') renderExercicios();
}
// O XP de cada item do dia e pago uma vez so e devolvido pelo MESMO valor
// ao desmarcar. Antes o desmarcar recalculava (e o dobro do Max podia mudar
// no meio), e cada caminho pagava por conta propria — marcar e desmarcar,
// ou registrar varios treinos, rendia XP sem fim.
function pagarItemDoDia(chave, marcar, base){
  var d=garantirDiario();
  if(!d.xpPago) d.xpPago={};
  if(marcar){
    if(d.xpPago[chave]) return 0;
    d.xpPago[chave]=addXP(base);
    return d.xpPago[chave];
  }
  var pago=d.xpPago[chave];
  delete d.xpPago[chave];
  if(pago==null) return addXP(-base);   // dia marcado antes desta regra
  return pago ? addXP(-pago, true) : 0;
}
function xpDaTarefaDia(chave){
  for(var i=0;i<TAREFAS_DIA.length;i++) if(TAREFAS_DIA[i].chave===chave) return TAREFAS_DIA[i].xp;
  return 10;
}
// A OFENSIVA (streak) sobe uma vez por dia, no primeiro item marcado, e
// DESCE de volta se o dia ficar sem nenhum item: antes, marcar e desmarcar
// guardava o dia na ofensiva sem nada feito. O estado de antes do dia fica
// em s.antes justamente para esse desfazer.
function atualizarStreak(){
  if(!state.streak) state.streak={count:0,lastDay:null};
  var s=state.streak, hoje=hojeStr();
  if(tarefasDoDiaFeitas()===0){
    if(s.lastDay===hoje){
      var a=s.antes;
      if(a && a.lastDay!==hoje){ s.count=a.count||0; s.lastDay=a.lastDay||null; }
      else { s.count=Math.max(0,(s.count||1)-1); s.lastDay=s.count?ontemStr():null; }
      delete s.antes;
    }
    return;
  }
  if(s.lastDay===hoje) return;
  s.antes={count:s.count||0,lastDay:s.lastDay||null};
  s.count = (s.lastDay===ontemStr()) ? (s.count||0)+1 : 1;
  s.lastDay=hoje;
}

// A ofensiva que vale AGORA. O numero guardado so muda quando algo e
// marcado; quem pulou dias via a ofensiva antiga ate marcar o proximo item
// (e ai ela "caia" para 1 de repente). Ofensiva viva e a que foi feita hoje
// ou ontem; mais velha que isso, ja quebrou: 0.
function ofensivaAtual(){
  var s=state.streak;
  if(!s || !s.lastDay || !s.count) return 0;
  if(s.lastDay!==hojeStr() && s.lastDay!==ontemStr()) return 0;
  return s.count;
}

// Fazer a atividade de verdade tambem fecha o item do dia: um pomodoro
// fecha "Estudos", registrar paginas fecha "Leitura", lancar um gasto de
// hoje fecha "Grana". Antes so o toque no item contava, e quem estudava
// sem tocar nele perdia a ofensiva. So marca (nunca desmarca) e paga o XP
// do item pelas mesmas regras do toque (uma vez por dia).
function marcarItemPorAtividade(chave){
  var d=garantirDiario();
  if(d[chave]) return 0;
  d[chave]=true;
  var xp=pagarItemDoDia(chave, true, xpDaTarefaDia(chave));
  atualizarStreak();
  if(typeof registrarItensDoDia==='function') registrarItensDoDia();
  if(typeof renderHome==='function' && document.getElementById('home-today-list')) renderHome();
  return xp;
}

var TAREFAS_DIA=[
  {chave:'leitura',   tag:'LEITURA',   rotulo:'20 minutos de leitura',       xp:10},
  {chave:'estudo',    tag:'ESTUDOS',   rotulo:'1 pomodoro de estudo',        xp:10},
  {chave:'grana',     tag:'GRANA',     rotulo:'Lançar os gastos do dia',     xp:10},
  {chave:'exercicio', tag:'EXERCÍCIO', rotulo:'Exercício do dia concluído',  xp:5}
];

// ─── OS QUATRO ITENS DO DIA ────────────────────────────────────────────
//
// Marcar o que se fez hoje e o gesto que o app inteiro serve — e era o
// unico sem nenhum retorno. A causa nao estava no CSS: cada toque
// reescrevia o innerHTML desta lista, entao o circulo do check era
// DESTRUIDO e recriado. Nenhuma transicao chega a rodar num elemento que
// acabou de nascer, e quem navega por teclado perdia o foco a cada Enter.
//
// Agora os botoes sao construidos uma vez e so o estado troca neles. O
// retorno visual passa a ser possivel, o foco fica onde estava, e o leitor
// de tela passa a anunciar "marcado"/"nao marcado" em vez de so "botao".
// Cada item do dia tem a cor e o icone da sua area (Design System 2).
var AREA_DO_ITEM = {
  leitura:   { area: 'a-leitura',   icone: 'leitura' },
  estudo:    { area: 'a-estudos',   icone: 'estudos' },
  grana:     { area: 'a-dinheiro',  icone: 'gastos' },
  exercicio: { area: 'a-exercicio', icone: 'halter' }
};

function pintarItensDoDia(d){
  var lista = document.getElementById('home-today-list');
  if(!lista) return;
  var idioma = (typeof idiomaAtual==='function') ? idiomaAtual() : 'pt';
  // Reconstroi so quando nao ha o que reaproveitar: primeira pintura ou
  // troca de idioma. Assim o check anima ao marcar (o botao nao e recriado).
  if(lista.children.length !== TAREFAS_DIA.length || lista.dataset.idioma !== idioma){
    lista.dataset.idioma = idioma;
    lista.innerHTML = TAREFAS_DIA.map(function(t){
      var a = AREA_DO_ITEM[t.chave] || { area: 'a-neutro', icone: 'check' };
      return '<button type="button" class="md-row ' + a.area + '" role="switch" aria-checked="false"'+
        ' onclick="toggleTarefaDia(\''+t.chave+'\')">'+
        '<span class="md-tile ' + a.area + '">' + ico(a.icone, 22) + '</span>'+
        '<span class="md-row-txt"><span class="md-label"></span>'+
        '<span class="md-row-titulo">'+T('day_'+t.chave)+'</span></span>'+
        '<span class="md-check" aria-hidden="true">' + ico('check', 18, 3) + '</span></button>';
    }).join('');
  }
  TAREFAS_DIA.forEach(function(t,i){
    var btn = lista.children[i];
    if(!btn) return;
    var on = !!d[t.chave];
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    btn.classList.toggle('feito', on);
    var c = btn.querySelector('.md-check');
    if(c) c.classList.toggle('md-check--on', on);
    var rot = btn.querySelector('.md-label');
    if(rot) rot.textContent = T('tag_'+t.chave) + ' · ' + (on ? 'feito' : '+' + t.xp + ' XP');
  });
}

// O anel do dia: uma parte por item, acesa quando o item fecha. O Ticolino
// mora no meio e muda de humor com o dia.
function anelDoDia(feitos, total){
  var R = 62, C = 70, gap = 7 * Math.PI / 180, partes = '';
  for(var i = 0; i < total; i++){
    var a0 = -Math.PI / 2 + i * 2 * Math.PI / total + gap / 2;
    var a1 = -Math.PI / 2 + (i + 1) * 2 * Math.PI / total - gap / 2;
    var x0 = (C + R * Math.cos(a0)).toFixed(2), y0 = (C + R * Math.sin(a0)).toFixed(2);
    var x1 = (C + R * Math.cos(a1)).toFixed(2), y1 = (C + R * Math.sin(a1)).toFixed(2);
    partes += '<path class="' + (i < feitos ? 'on' : '') + '" d="M' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 0 1 ' + x1 + ' ' + y1 + '"/>';
  }
  return '<svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="50" class="hoje-anel-disco"/>'
    + '<g fill="none" stroke-width="12" stroke-linecap="round">' + partes + '</g></svg>'
    + '<span class="hoje-anel-tico">' + ticolino(ticoHumorDoDia(), 80) + '</span>';
}

function renderHome(){
  if(!document.getElementById('home-today-list')) return;
  var d=garantirDiario(), feitos=tarefasDoDiaFeitas(), total=TAREFAS_DIA.length;

  // Saudação e data
  var hora=new Date().getHours();
  var saud = hora<12 ? T('goodMorning') : (hora<18 ? T('goodAfternoon') : T('goodEvening'));
  var nome=(state.perfil&&state.perfil.name)||'';
  var primeiro = nome.trim().split(/\s+/)[0];
  document.getElementById('home-greeting').textContent=saud+(primeiro?', '+primeiro:'');
  var data=new Date().toLocaleDateString(idiomaAtual()==='en'?'en-US':'pt-BR',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('home-date').textContent=data.charAt(0).toUpperCase()+data.slice(1);

  // Topo: ofensiva, nozes (pintadas por js/nozes.js) e nivel.
  var xp=(typeof studyXP==='number'?studyXP:0);
  var nivel=Math.floor(xp/100)+1;
  document.getElementById('home-streak').textContent=ofensivaAtual();
  document.getElementById('home-level').textContent=T('level')+' '+nivel;

  // Seu dia: o numero, a fala do Ticolino e o anel.
  document.getElementById('home-dia-num').textContent=feitos+' de '+total;
  var frases = feitos===0 ? T('msgStart') : (feitos>=total ? T('msgDone') : T('msgMid'));
  var partes = String(frases).split('. ');
  document.getElementById('home-tico-msg').textContent = partes[0] + (partes.length > 1 ? '.' : '');
  document.getElementById('home-dia-sub').textContent = partes.slice(1).join('. ');
  var anel=document.getElementById('home-anel');
  anel.innerHTML=anelDoDia(feitos,total);
  anel.setAttribute('aria-label', feitos+' de '+total+' itens do dia feitos');

  // Lista do dia
  var xpFalta = TAREFAS_DIA.reduce(function(s,t){ return s + (d[t.chave] ? 0 : t.xp); }, 0);
  document.getElementById('home-today-count').textContent = xpFalta ? '+'+xpFalta+' XP para fechar o anel' : 'Anel fechado';
  pintarItensDoDia(d);

  // Dinheiro do mes: o que saiu e quanto isso e do que entrou.
  var hoje=new Date(), mes=hoje.getMonth(), ano=hoje.getFullYear();
  var doMesFn=function(lista){ return (lista||[]).filter(function(g){
    var dd=new Date(g.data+'T12:00:00');
    return dd.getMonth()===mes && dd.getFullYear()===ano;
  }); };
  var gastosMes=doMesFn(state.gastos), ganhosMes=doMesFn(state.ganhos);
  var soma=function(l){ return l.reduce(function(s,g){return s+(parseFloat(g.valor)||0);},0); };
  var gastoMes=soma(gastosMes), entrouMes=soma(ganhosMes);
  var mesCurto=hoje.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
  document.getElementById('home-gastos-rotulo').textContent='Dinheiro · '+mesCurto;
  document.getElementById('home-stat-gastos').textContent=moeda(gastoMes);
  var pctG = entrouMes>0 ? Math.round(gastoMes/entrouMes*100) : 0;
  document.getElementById('home-gastos-barra').innerHTML = mdBarra(Math.min(100,pctG), '', 'md-pb--sm t-dinheiro');
  document.getElementById('home-stat-gastos-sub').textContent = entrouMes>0
    ? pctG+'% do que entrou'
    : gastosMes.length+' '+T(gastosMes.length===1?'lancamento':'lancamentos');

  // Treinos da semana. Le o mesmo historico da aba Exercicios.
  var seg = (typeof exSegunda==='function') ? exSegunda(new Date()) : null;
  var treinosSemana = 0, metaSemanal = 5;
  if(seg && state.exercicios){
    var fim=new Date(seg.getTime()); fim.setDate(seg.getDate()+6);
    treinosSemana = exDiasTreinados(seg, fim);
    metaSemanal = state.exercicios.metaSemanal || 5;
  }
  document.getElementById('home-stat-treinos').textContent=treinosSemana+' de '+metaSemanal;
  document.getElementById('home-treinos-barra').innerHTML = mdBarra(metaSemanal ? treinosSemana/metaSemanal*100 : 0, '', 'md-pb--sm t-exercicio');
  var faltaT = Math.max(0, metaSemanal - treinosSemana);
  document.getElementById('home-stat-treinos-sub').textContent = faltaT ? 'faltam '+faltaT+(faltaT===1?' dia':' dias') : 'meta da semana batida';

  // Em andamento (mantido do app original)
  // A tarefa recorrente que espera a proxima data nao esta "em andamento".
  var all=[].concat(state.tasks,state.metas).filter(function(i){return !i.done && tarefaVisivel(i);});
  document.getElementById('home-stat-tasks').textContent=state.tasks.filter(function(t){return !t.done && tarefaVisivel(t);}).length;
  document.getElementById('home-task-count').textContent=all.length+' '+(all.length!==1?T('items'):T('item'));
  // A Home e a unica pagina que aparece sem passar por goToPage (entra
  // direto depois do login), entao o ajuste dos numeros e pedido aqui.
  if(typeof encaixarNumeros==='function') encaixarNumeros(document.getElementById('page-home'));

  var scroll=document.getElementById('home-tasks-scroll');
  if(all.length===0){
    scroll.innerHTML='<p class="md-meta hoje-vazio">'+T('nothingRunning')+'</p>';
    return;
  }
  scroll.innerHTML=all.slice(0,12).map(function(item){
    var meta = item._type==='meta';
    return '<button type="button" class="hoje-and ' + (meta ? 'a-metas' : 'a-tarefas') + '" onclick="openDetail(\''+item._type+'\',\''+item.id+'\')">'+
      '<span class="md-tile md-tile--sm ' + (meta ? 'a-metas' : 'a-tarefas') + '">' + ico(meta ? 'metas' : 'tarefas', 18) + '</span>'+
      '<span class="md-row-txt"><span class="md-label md-a-txt">'+(meta ? 'Meta' : 'Tarefa')+'</span>'+
      '<span class="hoje-and-titulo">'+esc(item.name)+'</span></span></button>';
  }).join('');
}

