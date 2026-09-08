// EXERCICIOS — dias treinados, distribuicao por modalidade, cronometro do
// treino com o Ticolino reagindo, e a rotina de cada tipo de modalidade
// (academia, corrida, caminhada, calistenia).
//
// O que NAO esta aqui, e por que:
//  - Cronometro na tela de bloqueio (Live Activity no iPhone, notificacao
//    continua no Android). Nao existe em site aberto no navegador; exigiria
//    empacotar o Mindt como app nativo. O proprio material de design marca
//    isso como decisao a tomar antes. Ficou de fora.
//  - Contagem automatica de passos. O navegador nao le o pedometro do
//    telefone. Os passos sao registrados a mao, um valor por dia.
//
// Depende de: state (config.js), saveState (persistence.js), addXP e studyXP
// (estudos.js), ticolino/toast/esc/openModal/closeModal (helpers.js),
// garantirDiario/hojeStr/renderHome (home.js).

var EX_DIAS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
var EX_GRUPOS = ['Peito','Costas','Pernas','Ombro','Braço','Misto'];

// Tipo de modalidade -> o que o painel de baixo mostra e como o Ticolino posa.
var EX_TIPOS = [
  {chave:'academia',   nome:'Academia',   campo:'Dias × grupo muscular', humor:'levantando'},
  {chave:'corrida',    nome:'Corrida',    campo:'Distância e ritmo',     humor:'correndo'},
  {chave:'caminhada',  nome:'Caminhada',  campo:'Passos e tempo',        humor:'correndo'},
  {chave:'calistenia', nome:'Calistenia', campo:'Séries × repetições',   humor:'pulando'},
  {chave:'luta',       nome:'Luta',       campo:'Só o cronômetro',       humor:'boxe'}
];
function exTipo(chave){
  for(var i=0;i<EX_TIPOS.length;i++) if(EX_TIPOS[i].chave===chave) return EX_TIPOS[i];
  return EX_TIPOS[0];
}

var EX_XP = 5;              // XP por treino concluido (mesmo valor do design)
var exPeriodo = 'Semana';   // filtro do cartao "Dias treinados"
var exRelogio = null;       // id do setInterval do cronometro
var exNovoTipo = 'corrida'; // tipo escolhido no modal "Nova modalidade"
var exRotinaDraft = null;   // rascunho da rotina enquanto o modal esta aberto

// ─── Estado ────────────────────────────────────────────────
// Conta antiga nao tem state.exercicios; cria a estrutura com as quatro
// modalidades do design e devolve sempre um objeto valido.
function garantirExercicios(){
  var e = state.exercicios;
  if(!e){
    e = state.exercicios = {
      modalidades:[
        {id:'m-academia',   nome:'Academia',   tipo:'academia'},
        {id:'m-corrida',    nome:'Corrida',    tipo:'corrida'},
        {id:'m-caminhada',  nome:'Caminhada',  tipo:'caminhada'},
        {id:'m-calistenia', nome:'Calistenia', tipo:'calistenia'}
      ],
      ativa:'m-academia',
      treinos:[],      // {id, data, modId, dur}
      corridas:[],     // {id, data, modId, dist, tempo}
      passos:[],       // {data, passos}
      rotinas:{},      // modId -> {Seg:['Peito'], ...}
      circuitos:{},    // modId -> [{nome, series, reps}]
      metaPassos:8000,
      metaSemanal:5,
      cronometro:null  // {modId, inicio, acumulado} enquanto ha treino em curso
    };
  }
  // Campos que podem faltar em estados gravados por versoes anteriores.
  if(!e.modalidades||!e.modalidades.length) e.modalidades=[{id:'m-academia',nome:'Academia',tipo:'academia'}];
  if(!e.treinos) e.treinos=[];
  if(!e.corridas) e.corridas=[];
  if(!e.passos) e.passos=[];
  if(!e.rotinas) e.rotinas={};
  if(!e.circuitos) e.circuitos={};
  if(!e.metaPassos) e.metaPassos=8000;
  if(!e.metaSemanal) e.metaSemanal=5;
  if(!exModalidade(e.ativa)) e.ativa=e.modalidades[0].id;
  return e;
}
function exModalidade(id){
  var e=state.exercicios; if(!e) return null;
  for(var i=0;i<e.modalidades.length;i++) if(e.modalidades[i].id===id) return e.modalidades[i];
  return null;
}
function exAtiva(){ var e=garantirExercicios(); return exModalidade(e.ativa)||e.modalidades[0]; }

// ─── Datas ─────────────────────────────────────────────────
function exData(iso){ return new Date(iso+'T12:00:00'); }
function exISO(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
// Segunda-feira da semana de uma data. getDay() devolve 0 para domingo, que
// aqui e o ULTIMO dia da semana — por isso o 6 no lugar do 0.
function exSegunda(d){
  var x=new Date(d.getTime()), dia=(x.getDay()+6)%7;
  x.setDate(x.getDate()-dia); x.setHours(12,0,0,0); return x;
}

// ─── Numeros da pagina ─────────────────────────────────────
// Dias distintos com pelo menos um treino dentro do intervalo.
function exDiasTreinados(de, ate){
  var e=garantirExercicios(), vistos={};
  e.treinos.forEach(function(t){
    var d=exData(t.data);
    if(d>=de && d<=ate) vistos[t.data]=1;
  });
  return Object.keys(vistos).length;
}
function exTemTreino(iso){
  var e=garantirExercicios();
  for(var i=0;i<e.treinos.length;i++) if(e.treinos[i].data===iso) return true;
  return false;
}

// ─── Cronometro ────────────────────────────────────────────
// O tempo vem sempre da diferenca entre dois relogios, nunca de um contador
// que soma 1 por segundo: com a aba em segundo plano o navegador segura o
// setInterval e o contador atrasaria minutos num treino longo.
function exDecorrido(){
  var c=garantirExercicios().cronometro;
  if(!c) return 0;
  var base=c.acumulado||0;
  if(c.inicio) base += Math.floor((Date.now()-c.inicio)/1000);
  return base;
}
function exRodando(){ var c=garantirExercicios().cronometro; return !!(c&&c.inicio); }
function exEmAndamento(){ return !!garantirExercicios().cronometro; }

function exIniciarTreino(){
  var e=garantirExercicios();
  if(exRodando()) return;
  if(e.cronometro) e.cronometro.inicio=Date.now();
  else e.cronometro={modId:e.ativa, inicio:Date.now(), acumulado:0};
  exLigarRelogio(); saveState(); renderExercicios();
}
function exPausarTreino(){
  var e=garantirExercicios();
  if(!exRodando()) return;
  e.cronometro.acumulado=exDecorrido();
  e.cronometro.inicio=null;
  exDesligarRelogio(); saveState(); renderExercicios();
}
function exResetarTreino(){
  var e=garantirExercicios();
  e.cronometro=null; exDesligarRelogio(); saveState(); renderExercicios();
}
function exFinalizarTreino(){
  var e=garantirExercicios();
  if(!exEmAndamento()) return;
  var dur=exDecorrido(), modId=e.cronometro.modId||e.ativa;
  if(dur<10){ toast('Treino muito curto para registrar.'); return; }
  e.treinos.unshift({id:'t'+Date.now(), data:hojeStr(), modId:modId, dur:dur});
  e.ultimo={dur:dur, modId:modId};
  e.cronometro=null; exDesligarRelogio();
  exFecharDiaSemXP();         // o check do dia na Home fecha junto
  addXP(EX_XP);
  saveState(); renderExercicios();
  if(typeof renderHome==='function') renderHome();
  toast('+'+EX_XP+' XP · treino registrado');
}

// Enquanto a pagina de exercicios esta visivel, o mostrador anda de segundo em
// segundo. Sair da pagina desliga o intervalo — o tempo continua certo porque
// vem do relogio, nao do contador.
function exLigarRelogio(){
  if(exRelogio) return;
  exRelogio=setInterval(function(){
    if(!exRodando()){ exDesligarRelogio(); return; }
    var pg=document.getElementById('page-exercicios');
    if(!pg||!pg.classList.contains('active')){ exDesligarRelogio(); return; }
    exPintarCronometro();
  },1000);
}
function exDesligarRelogio(){ if(exRelogio){ clearInterval(exRelogio); exRelogio=null; } }

function exTempo(seg){
  var m=Math.floor(seg/60), s=seg%60;
  if(m<60) return m+':'+pad(s);
  return Math.floor(m/60)+':'+pad(m%60)+':'+pad(s);
}

// ─── Check do dia ──────────────────────────────────────────
// Marca ou desmarca o check do dia PAGANDO o XP — e o que o botao
// "Concluir exercicio do dia" faz.
function exMarcarDia(valor){
  var d=garantirDiario();
  if(!!d.exercicio===!!valor) return;
  d.exercicio=!!valor;
  addXP(valor?EX_XP:-EX_XP);
  if(typeof atualizarStreak==='function') atualizarStreak();
}
// Fecha o check do dia SEM pagar XP. Usado por quem ja paga o seu proprio:
// terminar um treino vale +5 uma vez so, nao +5 do treino mais +5 do check.
function exFecharDiaSemXP(){
  var d=garantirDiario();
  if(d.exercicio) return;
  d.exercicio=true;
  if(typeof atualizarStreak==='function') atualizarStreak();
}
function exConcluirDia(){
  exMarcarDia(true); saveState(); renderExercicios();
  if(typeof renderHome==='function') renderHome();
  toast('+'+EX_XP+' XP · exercício do dia');
}

// ─── Render ────────────────────────────────────────────────
function renderExercicios(){
  if(!document.getElementById('ex-dias-valor')) return;
  var e=garantirExercicios(), d=garantirDiario();

  // Cabecalho
  var xp=(typeof studyXP==='number'?studyXP:0), nivel=Math.floor(xp/100)+1;
  document.getElementById('ex-sub').textContent='Nível '+nivel+' · +'+EX_XP+' XP por treino concluído';
  document.getElementById('ex-mes').textContent=
    new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  document.getElementById('ex-dia-btn').style.display = d.exercicio?'none':'';
  document.getElementById('ex-dia-ok').style.display  = d.exercicio?'':'none';

  exPintarDias();
  exPintarDistribuicao();
  exPintarCronometro();
  exPintarModalidades();
  exPintarPainel();
}

// Cartao "Dias treinados" — numero, barrinhas e nota do periodo.
function exPintarDias(){
  var e=garantirExercicios(), hoje=new Date();
  var feitos, total, nota, barras=[];

  if(exPeriodo==='Semana'){
    var seg=exSegunda(hoje);
    barras=EX_DIAS.map(function(nome,i){
      var dia=new Date(seg.getTime()); dia.setDate(seg.getDate()+i);
      return {label:nome.slice(0,1), on:exTemTreino(exISO(dia))};
    });
    feitos=barras.filter(function(b){return b.on;}).length;
    total=7;
    var faltam=Math.max(0,e.metaSemanal-feitos);
    nota='Meta da semana: '+e.metaSemanal+' dias. '+(faltam?('Faltam '+faltam+'.'):'Meta batida.');
  }else if(exPeriodo==='Mês'){
    var pri=new Date(hoje.getFullYear(),hoje.getMonth(),1,12);
    var ult=new Date(hoje.getFullYear(),hoje.getMonth()+1,0,12);
    feitos=exDiasTreinados(pri,ult); total=ult.getDate();
    // Uma barra por semana do mes: acesa se teve pelo menos um treino nela.
    var cursor=exSegunda(pri), n=1;
    while(cursor<=ult){
      var fim=new Date(cursor.getTime()); fim.setDate(cursor.getDate()+6);
      barras.push({label:'S'+n, on:exDiasTreinados(cursor,fim)>0});
      cursor=new Date(fim.getTime()); cursor.setDate(fim.getDate()+1); n++;
    }
    nota=feitos?('Melhor sequência começa hoje.'):('Nenhum treino registrado neste mês ainda.');
  }else{
    var ini=new Date(hoje.getFullYear(),0,1,12), fim2=new Date(hoje.getFullYear(),11,31,12);
    feitos=exDiasTreinados(ini,fim2); total=365;
    var LETRAS=['J','F','M','A','M','J','J','A','S','O','N','D'];
    for(var m=0;m<=hoje.getMonth();m++){
      var a=new Date(hoje.getFullYear(),m,1,12), b=new Date(hoje.getFullYear(),m+1,0,12);
      barras.push({label:LETRAS[m], on:exDiasTreinados(a,b)>0});
    }
    var meses=hoje.getMonth()+1;
    nota='Média de '+Math.round(e.treinos.length/meses)+' treinos por mês.';
  }

  document.getElementById('ex-dias-valor').textContent=feitos;
  document.getElementById('ex-dias-total').textContent='de '+total+' dias';
  document.getElementById('ex-dias-nota').textContent=nota;
  document.getElementById('ex-strip').innerHTML=barras.map(function(b){
    return '<div class="ex-strip-col"><span class="ex-strip-barra'+(b.on?' on':'')+'"></span>'+
           '<span class="ex-strip-label">'+esc(b.label)+'</span></div>';
  }).join('');
  document.querySelectorAll('#ex-periodos .filter-chip').forEach(function(c){
    c.classList.toggle('active', c.dataset.periodo===exPeriodo);
  });
}

// Cartao "Você treina mais" — participacao de cada modalidade nos treinos.
function exPintarDistribuicao(){
  var e=garantirExercicios(), total=e.treinos.length;
  var CORES=['var(--accent)','#6FB58C','#8CA9FF','#E3B341','#D9694A','#B48EAD'];
  var contas=e.modalidades.map(function(m,i){
    var n=e.treinos.filter(function(t){return t.modId===m.id;}).length;
    return {nome:m.nome, n:n, pct: total?Math.round(n/total*100):0, cor:CORES[i%CORES.length]};
  }).sort(function(a,b){return b.n-a.n;});

  var topo=contas[0];
  document.getElementById('ex-top-nome').textContent = (total&&topo&&topo.n)?topo.nome:'—';
  document.getElementById('ex-top-nota').textContent =
    total ? (topo.pct+'% dos treinos registrados') : 'Nenhum treino registrado ainda.';
  document.getElementById('ex-distrib').innerHTML=contas.map(function(d){
    return '<div class="ex-distrib-linha">'+
      '<span class="ex-distrib-nome">'+esc(d.nome)+'</span>'+
      '<span class="ex-distrib-trilho"><span class="ex-distrib-fill" style="width:'+d.pct+'%;background:'+d.cor+'"></span></span>'+
      '<span class="ex-distrib-pct">'+d.pct+'</span></div>';
  }).join('');
}

// Cronometro: anel, mascote, fala e botoes.
function exPintarCronometro(){
  var anel=document.getElementById('ex-anel-fill');
  if(!anel) return;
  var e=garantirExercicios(), mod=exAtiva(), tipo=exTipo(mod.tipo);
  var seg=exDecorrido(), rodando=exRodando(), emAndamento=exEmAndamento();

  document.getElementById('ex-cron-tempo').textContent=exTempo(seg);
  document.getElementById('ex-cron-mod').textContent=mod.nome;
  document.getElementById('ex-cron-label').textContent =
    rodando ? 'Em treino' : (emAndamento ? 'Pausado' : 'Pronto para começar');

  // O anel completa uma volta a cada hora — referencia visual, nao limite.
  var C=2*Math.PI*88, frac=(seg%3600)/3600;
  anel.style.strokeDasharray=C;
  anel.style.strokeDashoffset=C*(1-frac);

  var humor, fala;
  if(rodando){ humor=tipo.humor; fala='Tá valendo. Não olha pro relógio, olha pro Ticolino.'; }
  else if(emAndamento){ humor='pausa'; fala='Pausado. Bebe água — mas não senta.'; }
  else if(e.ultimo){
    humor = e.ultimo.dur>=1800 ? 'cansado' : 'forte';
    fala  = e.ultimo.dur>=1800 ? 'Treino pesado. O Ticolino tá suando por você.'
                               : 'Fechou. Curto e bem feito também conta.';
  }
  else { humor=tipo.humor; fala='Aperta iniciar quando começar. O Ticolino treina junto.'; }

  var tico=document.getElementById('ex-tico');
  if(tico.dataset.humor!==humor){ tico.innerHTML=ticolino(humor,124); tico.dataset.humor=humor; }
  tico.classList.toggle('pulando', rodando);
  document.getElementById('ex-tico-fala').textContent=fala;

  document.getElementById('ex-btn-iniciar').style.display  = rodando?'none':'';
  document.getElementById('ex-btn-iniciar').textContent    = emAndamento?'▶ Continuar':'▶ Iniciar treino';
  document.getElementById('ex-btn-pausar').style.display   = rodando?'':'none';
  document.getElementById('ex-btn-finalizar').style.display= emAndamento?'':'none';
  document.getElementById('ex-btn-resetar').style.display  = emAndamento?'':'none';

  var resumo=document.getElementById('ex-resumo');
  if(e.ultimo && !emAndamento){
    var m=exModalidade(e.ultimo.modId);
    resumo.style.display='';
    document.getElementById('ex-resumo-txt').textContent=
      (m?m.nome:'Treino')+' · '+exTempo(e.ultimo.dur);
    document.getElementById('ex-resumo-xp').textContent='+'+EX_XP+' XP';
  } else resumo.style.display='none';
}

// Fila de modalidades + botao de criar.
function exPintarModalidades(){
  var e=garantirExercicios();
  document.getElementById('ex-mods').innerHTML=e.modalidades.map(function(m){
    return '<button class="filter-chip'+(m.id===e.ativa?' active':'')+'" onclick="exTrocarModalidade(\''+m.id+'\')">'+
           esc(m.nome)+'</button>';
  }).join('');
}
function exTrocarModalidade(id){
  var e=garantirExercicios();
  if(!exModalidade(id)) return;
  e.ativa=id; saveState(); renderExercicios();
}

// O painel de baixo muda conforme o tipo da modalidade escolhida.
function exPintarPainel(){
  var mod=exAtiva(), tipo=mod.tipo;
  ['academia','corrida','caminhada','calistenia'].forEach(function(t){
    var el=document.getElementById('ex-painel-'+t);
    if(el) el.style.display = (t===tipo)?'':'none';
  });
  var vazio=document.getElementById('ex-painel-vazio');
  if(vazio){
    var conhecido = ['academia','corrida','caminhada','calistenia'].indexOf(tipo)>=0;
    vazio.style.display = conhecido?'none':'';
  }
  if(tipo==='academia') exPintarRotina();
  else if(tipo==='corrida') exPintarCorridas();
  else if(tipo==='caminhada') exPintarPassos();
  else if(tipo==='calistenia') exPintarCircuito();
}

// ─── Academia: rotina da semana ────────────────────────────
function exRotinaDe(modId){
  var e=garantirExercicios();
  if(!e.rotinas[modId]) e.rotinas[modId]={};
  return e.rotinas[modId];
}
function exPintarRotina(){
  var mod=exAtiva(), r=exRotinaDe(mod.id);
  document.getElementById('ex-rotina').innerHTML=EX_DIAS.map(function(dia){
    var g=r[dia]||[];
    var dur = g.length ? ('~'+(40+(g.length-1)*15)+' min') : '—';
    var corpo = g.length
      ? g.map(function(x){return '<span class="ex-grupo-chip">'+esc(x)+'</span>';}).join('')
      : '<span class="ex-descanso">Descanso</span>';
    return '<div class="ex-rotina-linha"><span class="ex-rotina-dia">'+dia+'</span>'+
           '<div class="ex-rotina-grupos">'+corpo+'</div>'+
           '<span class="ex-rotina-dur">'+dur+'</span></div>';
  }).join('');
}
function exAbrirRotina(){
  var mod=exAtiva(), r=exRotinaDe(mod.id);
  exRotinaDraft={};
  EX_DIAS.forEach(function(d){ exRotinaDraft[d]=(r[d]||[]).slice(); });
  exPintarRotinaEdit();
  openModal('modal-ex-rotina');
}
function exPintarRotinaEdit(){
  document.getElementById('ex-rotina-edit').innerHTML=EX_DIAS.map(function(dia){
    var sel=exRotinaDraft[dia]||[];
    var opcoes=EX_GRUPOS.map(function(g){
      var on=sel.indexOf(g)>=0;
      return '<button class="ex-grupo-opt'+(on?' on':'')+'" onclick="exToggleGrupo(\''+dia+'\',\''+g+'\')">'+
             '<span class="ex-grupo-box"></span>'+g+'</button>';
    }).join('');
    return '<div class="ex-rotina-linha"><span class="ex-rotina-dia">'+dia+'</span>'+
           '<div class="ex-rotina-grupos">'+opcoes+'</div></div>';
  }).join('');
}
function exToggleGrupo(dia,grupo){
  var cur=exRotinaDraft[dia]||(exRotinaDraft[dia]=[]);
  var i=cur.indexOf(grupo);
  if(i>=0) cur.splice(i,1);
  else if(cur.length<2) cur.push(grupo);
  else { toast('Máximo de dois grupos por dia.'); return; }
  exPintarRotinaEdit();
}
function exSalvarRotina(){
  var mod=exAtiva(), e=garantirExercicios();
  e.rotinas[mod.id]=exRotinaDraft||{};
  exRotinaDraft=null;
  saveState(); closeModal('modal-ex-rotina'); renderExercicios();
  toast('Rotina salva');
}

// ─── Corrida ───────────────────────────────────────────────
function exCorridasDaMod(){
  var e=garantirExercicios(), mod=exAtiva();
  return e.corridas.filter(function(c){return c.modId===mod.id;});
}
function exPintarCorridas(){
  var lista=exCorridasDaMod(), hoje=new Date();
  var recorde=0, recData='';
  lista.forEach(function(c){ if(c.dist>recorde){ recorde=c.dist; recData=c.data; } });

  document.getElementById('ex-recorde').textContent = recorde? exKm(recorde)+' km' : '—';
  document.getElementById('ex-recorde-data').textContent = recData
    ? exData(recData).toLocaleDateString('pt-BR',{day:'numeric',month:'long'})
    : 'Nenhuma corrida registrada ainda.';

  var doMes=lista.filter(function(c){
    var d=exData(c.data);
    return d.getMonth()===hoje.getMonth() && d.getFullYear()===hoje.getFullYear();
  });
  var km=doMes.reduce(function(s,c){return s+c.dist;},0);
  document.getElementById('ex-km-mes').textContent=exKm(km)+' km';
  document.getElementById('ex-corridas-mes').textContent=
    doMes.length+(doMes.length===1?' corrida no mês':' corridas no mês');

  var el=document.getElementById('ex-corridas');
  if(!lista.length){
    el.innerHTML='<div class="empty-inline">Nenhuma corrida registrada ainda.</div>';
    return;
  }
  el.innerHTML=lista.slice(0,6).map(function(c){
    var partes=[exData(c.data).toLocaleDateString('pt-BR',{day:'numeric',month:'short'})];
    if(c.tempo) partes.push(c.tempo);
    var ritmo=exRitmo(c);
    if(ritmo) partes.push(ritmo);
    return '<div class="ex-corrida-item">'+
      '<span class="ex-corrida-icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg></span>'+
      '<div class="ex-corrida-info"><div class="ex-corrida-dist">'+exKm(c.dist)+' km</div>'+
      '<div class="ex-corrida-meta">'+esc(partes.join(' · '))+'</div></div>'+
      (c.dist===recorde&&recorde ? '<span class="ex-badge">Recorde</span>' : '')+
      '<button class="icon-btn" onclick="exApagarCorrida(\''+c.id+'\')" aria-label="Apagar corrida">✕</button>'+
      '</div>';
  }).join('');
}
function exKm(v){ return (Math.round(v*10)/10).toFixed(1).replace('.',','); }
// Ritmo em min/km, calculado so quando o tempo veio no formato mm:ss ou hh:mm:ss.
function exRitmo(c){
  if(!c.tempo||!c.dist) return '';
  var p=String(c.tempo).split(':').map(Number);
  if(p.some(isNaN)) return '';
  var seg = p.length===3 ? p[0]*3600+p[1]*60+p[2] : (p.length===2 ? p[0]*60+p[1] : 0);
  if(!seg) return '';
  var porKm=Math.round(seg/c.dist);
  return Math.floor(porKm/60)+':'+pad(porKm%60)+' /km';
}
function exAbrirCorrida(){
  document.getElementById('ex-corrida-dist').value='';
  document.getElementById('ex-corrida-tempo').value='';
  document.getElementById('ex-corrida-aviso').style.display='none';
  openModal('modal-ex-corrida');
}
// Avisa antes de salvar quando a distancia digitada passa o recorde atual.
function exConferirRecorde(){
  var v=parseFloat(String(document.getElementById('ex-corrida-dist').value).replace(',','.'));
  var recorde=exCorridasDaMod().reduce(function(m,c){return Math.max(m,c.dist);},0);
  var aviso=document.getElementById('ex-corrida-aviso');
  if(!isNaN(v)&&recorde&&v>recorde){
    document.getElementById('ex-corrida-aviso-txt').textContent=
      'Isso é recorde. Seu melhor percurso era '+exKm(recorde)+' km.';
    document.getElementById('ex-corrida-aviso-tico').innerHTML=ticolino('forte',48);
    aviso.style.display='';
  } else aviso.style.display='none';
}
function exSalvarCorrida(){
  var e=garantirExercicios(), mod=exAtiva();
  var dist=parseFloat(String(document.getElementById('ex-corrida-dist').value).replace(',','.'));
  var tempo=document.getElementById('ex-corrida-tempo').value.trim();
  if(isNaN(dist)||dist<=0){ toast('Coloque a distância primeiro.'); return; }
  var recorde=exCorridasDaMod().reduce(function(m,c){return Math.max(m,c.dist);},0);
  var bateu = dist>recorde;
  e.corridas.unshift({id:'c'+Date.now(), data:hojeStr(), modId:mod.id, dist:dist, tempo:tempo});
  // Uma corrida registrada tambem e um treino do dia — senao o cartao de dias
  // treinados ignoraria quem corre e nao usa o cronometro.
  if(!exTemTreino(hojeStr())) e.treinos.unshift({id:'t'+Date.now(), data:hojeStr(), modId:mod.id, dur:0});
  exFecharDiaSemXP();
  addXP(EX_XP);
  saveState(); closeModal('modal-ex-corrida'); renderExercicios();
  if(typeof renderHome==='function') renderHome();
  toast(bateu ? ('Recorde novo! +'+EX_XP+' XP') : ('Corrida registrada · +'+EX_XP+' XP'));
}
function exApagarCorrida(id){
  var e=garantirExercicios();
  e.corridas=e.corridas.filter(function(c){return c.id!==id;});
  saveState(); renderExercicios();
}

// ─── Caminhada: passos ─────────────────────────────────────
function exPassosDe(iso){
  var e=garantirExercicios();
  for(var i=0;i<e.passos.length;i++) if(e.passos[i].data===iso) return e.passos[i].passos;
  return 0;
}
function exPintarPassos(){
  var e=garantirExercicios(), meta=e.metaPassos, seg=exSegunda(new Date());
  var dias=EX_DIAS.map(function(nome,i){
    var d=new Date(seg.getTime()); d.setDate(seg.getDate()+i);
    return {label:nome.slice(0,1), n:exPassosDe(exISO(d))};
  });
  var teto=Math.max(meta, dias.reduce(function(m,d){return Math.max(m,d.n);},0)) || meta;
  var naMeta=dias.filter(function(d){return d.n>=meta;}).length;

  document.getElementById('ex-meta-passos').textContent=meta.toLocaleString('pt-BR')+' passos';
  document.getElementById('ex-passos-nota').textContent=naMeta+' de 7 dias na meta';
  document.getElementById('ex-passos').innerHTML=dias.map(function(d){
    var h=Math.round(d.n/teto*100);
    return '<div class="ex-passo-col">'+
      '<span class="ex-passo-num">'+(d.n?(Math.round(d.n/100)/10).toFixed(1).replace('.',','):'')+'</span>'+
      '<span class="ex-passo-barra'+(d.n>=meta?' on':'')+'" style="height:'+h+'%"></span>'+
      '<span class="ex-passo-dia">'+d.label+'</span></div>';
  }).join('');
}
function exAbrirPassos(){
  var e=garantirExercicios();
  document.getElementById('ex-passos-data').value=hojeStr();
  document.getElementById('ex-passos-valor').value=exPassosDe(hojeStr())||'';
  document.getElementById('ex-passos-meta').value=e.metaPassos;
  openModal('modal-ex-passos');
}
function exSalvarPassos(){
  var e=garantirExercicios();
  var data=document.getElementById('ex-passos-data').value||hojeStr();
  var n=parseInt(document.getElementById('ex-passos-valor').value,10);
  var meta=parseInt(document.getElementById('ex-passos-meta').value,10);
  if(meta>0) e.metaPassos=meta;
  if(!isNaN(n)&&n>=0){
    var achou=false;
    e.passos.forEach(function(p){ if(p.data===data){ p.passos=n; achou=true; } });
    if(!achou) e.passos.push({data:data, passos:n});
  }
  saveState(); closeModal('modal-ex-passos'); renderExercicios();
  toast('Passos registrados');
}

// ─── Calistenia: circuito ──────────────────────────────────
function exCircuitoDe(modId){
  var e=garantirExercicios();
  if(!e.circuitos[modId]) e.circuitos[modId]=[];
  return e.circuitos[modId];
}
function exPintarCircuito(){
  var mod=exAtiva(), lista=exCircuitoDe(mod.id);
  var el=document.getElementById('ex-circuito');
  if(!lista.length){
    el.innerHTML='<div class="empty-inline">Circuito vazio. Adicione o primeiro exercício.</div>';
    return;
  }
  el.innerHTML=lista.map(function(x,i){
    return '<div class="ex-circuito-linha"><span class="ex-circuito-nome">'+esc(x.nome)+'</span>'+
      '<span class="ex-circuito-serie">'+x.series+' × '+x.reps+'</span>'+
      '<button class="icon-btn" onclick="exApagarExercicio('+i+')" aria-label="Remover exercício">✕</button></div>';
  }).join('');
}
function exAbrirCircuito(){
  document.getElementById('ex-circ-nome').value='';
  document.getElementById('ex-circ-series').value='3';
  document.getElementById('ex-circ-reps').value='12';
  openModal('modal-ex-circuito');
}
function exSalvarExercicio(){
  var mod=exAtiva(), lista=exCircuitoDe(mod.id);
  var nome=document.getElementById('ex-circ-nome').value.trim();
  var series=parseInt(document.getElementById('ex-circ-series').value,10);
  var reps=parseInt(document.getElementById('ex-circ-reps').value,10);
  if(!nome){ toast('Dê um nome ao exercício.'); return; }
  lista.push({nome:nome, series:series>0?series:3, reps:reps>0?reps:12});
  saveState(); closeModal('modal-ex-circuito'); renderExercicios();
}
function exApagarExercicio(i){
  var mod=exAtiva();
  exCircuitoDe(mod.id).splice(i,1);
  saveState(); renderExercicios();
}

// ─── Nova modalidade ───────────────────────────────────────
function exAbrirNovaModalidade(){
  document.getElementById('ex-nova-nome').value='';
  exNovoTipo='corrida';
  exPintarTipos();
  openModal('modal-ex-modalidade');
}
function exPintarTipos(){
  document.getElementById('ex-tipos').innerHTML=EX_TIPOS.map(function(t){
    return '<button class="ex-tipo-opt'+(t.chave===exNovoTipo?' on':'')+'" onclick="exEscolherTipo(\''+t.chave+'\')">'+
      '<span class="ex-tipo-nome">'+t.nome+'</span>'+
      '<span class="ex-tipo-campo">'+t.campo+'</span></button>';
  }).join('');
}
function exEscolherTipo(t){ exNovoTipo=t; exPintarTipos(); }
function exCriarModalidade(){
  var e=garantirExercicios();
  var nome=document.getElementById('ex-nova-nome').value.trim();
  if(!nome){ toast('Dê um nome à modalidade.'); return; }
  var id='m'+Date.now();
  e.modalidades.push({id:id, nome:nome, tipo:exNovoTipo});
  e.ativa=id;
  saveState(); closeModal('modal-ex-modalidade'); renderExercicios();
  toast('Modalidade '+nome+' criada');
  if(exNovoTipo==='academia') exAbrirRotina();
}
// Apagar a modalidade guarda os treinos ja registrados: eles contam para os
// dias treinados, e some-los na surdina seria perder historico do usuario.
function exApagarModalidade(){
  var e=garantirExercicios(), mod=exAtiva();
  if(e.modalidades.length<=1){ toast('Deixe ao menos uma modalidade.'); return; }
  document.getElementById('confirm-title').textContent='Apagar modalidade';
  document.getElementById('confirm-body').textContent=
    'Apagar "'+mod.nome+'"? Os treinos já registrados continuam contando nos dias treinados.';
  document.getElementById('confirm-ok-btn').textContent='Apagar';
  document.getElementById('confirm-ok-btn').onclick=function(){
    e.modalidades=e.modalidades.filter(function(m){return m.id!==mod.id;});
    e.ativa=e.modalidades[0].id;
    saveState(); closeModal('modal-confirm'); renderExercicios(); resetConfirmBtn();
  };
  openModal('modal-confirm');
}
