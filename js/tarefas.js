// TAREFAS — tarefas, seus filtros e checklists.

// TASKS
// Filtro escolhido nos chips. Ao entrar na aba volta para Pendentes (ver
// nav.js); as outras repinturas (salvar, concluir) mantem o que esta ativo.
var filtroTarefas = 'pending';
function renderTasks(filter){
  if(!document.getElementById('tasks-grid')) return;
  // O ciclo pode ter chegado desde a ultima pintura. Idempotente.
  if(atualizarTarefasRecorrentes()) saveState();
  pintarContaRecorrentes();
  if(tarefasAba === 'rec') renderRecorrentes();
  filter=filter||filtroTarefas;filtroTarefas=filter;
  var feitas = updatePeriodStats('tasks');
  pintarCabecalhoTarefas(feitas);
  var grid=document.getElementById('tasks-grid');
  // A recorrente que aguarda a proxima data nao aparece aqui — ela mora na
  // aba Recorrentes ate a hora dela chegar.
  var list=state.tasks.filter(function(t){return tarefaVisivel(t);});
  var hoje = hojeStr();
  if(filter==='pending'){
    // Pendentes, e as que foram feitas hoje no fim (dá para desfazer).
    list=list.filter(function(t){ return !t.done || diaDe(t.completedAt) === hoje; });
  }
  if(filter==='done')list=list.filter(function(t){return t.done;});
  if(filter==='recent')list.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
  if(list.length===0){
    grid.innerHTML = estadoVazio('preguicoso', filter==='done' ? 'Nenhuma tarefa concluída ainda.' : T('semTarefas'),
      filter==='done' ? '' : '<button type="button" class="md-btn md-btn--primary md-btn--sm" onclick="abrirNovaTarefa()">' + ico('plus',18,2.4) + T('novaTarefa') + '</button>');
    return;
  }
  marcarEntradaDaGrade(grid);
  var sel = deleteMode.type==='tasks';
  var linha = function(t){ return linhaDeTarefa(t, sel); };
  var html;
  if(filter==='pending' || filter==='all'){
    // Agrupada pelo prazo, como o dia se organiza.
    var grupos = [['atrasadas','Atrasadas'],['hoje','Para hoje'],['semana','Esta semana'],['depois','Mais tarde'],['semdata','Sem prazo'],['feitas', filter==='all' ? 'Concluídas' : 'Feitas hoje']];
    var por = {};
    list.forEach(function(t){ var g = grupoDaTarefa(t, hoje); (por[g] = por[g] || []).push(t); });
    html = grupos.filter(function(g){ return por[g[0]]; }).map(function(g){
      var itens = por[g[0]];
      if(g[0] !== 'feitas' && g[0] !== 'semdata') itens.sort(function(a,b){ return String(a.deadline||'').localeCompare(String(b.deadline||'')); });
      return '<div class="md-lista-gh' + (g[0]==='atrasadas' ? ' gh-alerta' : '') + '">' + g[1] + '</div>' + itens.map(linha).join('');
    }).join('');
  } else {
    html = list.map(linha).join('');
  }
  grid.innerHTML = '<div class="md-lista tk-lista">' + html + '</div>';
}

function diaDe(iso){
  if(!iso) return '';
  var d = new Date(iso);
  return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}
function grupoDaTarefa(t, hoje){
  if(t.done) return 'feitas';
  if(estadoDaRecorrencia(t) === 'atrasada') return 'atrasadas';
  if(!t.deadline) return 'semdata';
  if(t.deadline < hoje) return 'atrasadas';
  if(t.deadline === hoje) return 'hoje';
  var lim = new Date(hoje + 'T12:00:00'); lim.setDate(lim.getDate() + 6);
  return t.deadline <= diaDe(lim.toISOString()) ? 'semana' : 'depois';
}
// "Vence hoje", "Domingo", "12/11" — o prazo do jeito que se fala.
function prazoEmPalavras(t){
  if(t.recorrencia) return 'Repete: ' + regraEmPalavras(t.recorrencia);
  if(!t.deadline) return '';
  var hoje = hojeStr();
  if(t.deadline === hoje) return 'Vence hoje';
  if(t.deadline < hoje){
    var dias = Math.round((new Date(hoje+'T12:00:00') - new Date(t.deadline+'T12:00:00')) / 86400000);
    return dias === 1 ? 'Venceu ontem' : 'Venceu há ' + dias + ' dias';
  }
  var d = new Date(t.deadline + 'T12:00:00'), lim = new Date(hoje + 'T12:00:00');
  var em = Math.round((d - lim) / 86400000);
  if(em === 1) return 'Amanhã';
  if(em < 7){ var w = d.toLocaleDateString('pt-BR', {weekday:'long'}); return w.charAt(0).toUpperCase() + w.slice(1).replace('-feira',''); }
  return pad(d.getDate()) + '/' + pad(d.getMonth()+1);
}
function linhaDeTarefa(t, sel){
  var dinheiro = !!(t.budget && parseFloat(t.budget) > 0);
  var area = t.done ? 'a-neutro' : (dinheiro ? 'a-dinheiro' : 'a-tarefas');
  var icone = dinheiro ? 'gastos' : (t.recorrencia ? 'repetir' : 'tarefas');
  var prazo = prazoEmPalavras(t), alerta = !t.done && /^Venc/.test(prazo);
  var partes = [];
  if(t.done) partes.push(diaDe(t.completedAt) === hojeStr() ? 'Feita hoje' : 'Concluída');
  else if(prazo) partes.push(prazo);
  if(dinheiro) partes.push(moeda(parseFloat(t.budget)));
  if(t.group && !t.done) partes.push(t.group);
  var cl = (t.checklist || []);
  if(cl.length) partes.push(cl.filter(function(c){ return c.done; }).length + ' de ' + cl.length + ' itens');
  var tile = t.img
    ? '<span class="md-tile md-tile--sm tk-img"><img src="' + esc(t.img) + '" alt=""></span>'
    : '<span class="md-tile md-tile--sm ' + area + '">' + ico(icone, 18) + '</span>';
  return '<div class="md-lista-item tk' + (t.done ? ' feita' : '') + (sel ? ' selection-mode' : '') + '" data-id="' + t.id + '" onclick="handleCardClick(\'task\',\'' + t.id + '\',event)">'
    + '<input type="checkbox" class="select-checkbox" aria-label="Selecionar ' + esc(t.name) + '" onchange="toggleSelect(\'' + t.id + '\',this)">'
    + tile
    + '<span class="md-row-txt"><span class="tk-nome">' + esc(t.name) + '</span>'
    + (partes.length ? '<span class="tk-sub' + (alerta ? ' alerta' : '') + '">' + esc(partes.join(' · ')) + '</span>' : '')
    + '</span>'
    + '<button type="button" class="md-check md-check--sm' + (t.done ? ' md-check--on' : '') + '" aria-label="' + (t.done ? 'Reabrir ' : 'Concluir ') + esc(t.name) + '"'
    + ' onclick="event.stopPropagation();quickCompleteTask(\'' + t.id + '\')">' + ico('check', 16, 3) + '</button>'
    + '</div>';
}

// O numero do cabecalho: o que vence hoje (e o atrasado).
function pintarCabecalhoTarefas(feitas){
  var el = document.getElementById('tasks-hero');
  if(!el) return;
  var hoje = hojeStr(), lim = new Date(hoje + 'T12:00:00'); lim.setDate(lim.getDate() + 6);
  var fimSemana = diaDe(lim.toISOString());
  var abertas = state.tasks.filter(function(t){ return !t.done && tarefaVisivel(t); });
  var praHoje = abertas.filter(function(t){ return t.deadline && t.deadline <= hoje; }).length;
  var semana = abertas.filter(function(t){ return t.deadline && t.deadline <= fimSemana; }).length;
  el.textContent = praHoje + ' pra hoje';
  var feitasHoje = feitas ? feitas.day : 0;
  document.getElementById('tasks-hero-sub').textContent =
    semana + ' na semana · ' + feitasHoje + (feitasHoje === 1 ? ' concluída hoje' : ' concluídas hoje');
}
// Selo de estado do cartao. "Tarefa atrasada" so existe para recorrente: e
// a que passou do proprio ciclo sem ser feita — em vez de gerar uma copia.
function seloDaTarefa(t){
  var est = estadoDaRecorrencia(t);
  var cls = 'task-status-badge', txt;
  if(est === 'atrasada'){ cls += ' atrasada'; txt = 'Tarefa atrasada'; }
  else if(t.done){ cls += ' done'; txt = 'Concluída'; }
  else txt = 'Andamento';
  return '<div class="'+cls+'" style="flex-shrink:0;margin-left:auto">'+txt+'</div>';
}
function filterTasks(type,el){
  document.querySelectorAll('#tasks-filter-row [data-filtro]').forEach(function(c){
    c.setAttribute('aria-pressed', c.dataset.filtro === type ? 'true' : 'false');
  });
  renderTasks(type);
}

function handleCardClick(type,id,event){
  if(event.target.type==='checkbox')return;
  var dm=type==='meta'?'metas':'tasks';
  if(deleteMode.type===dm||editMode.type===dm){var cb=event.currentTarget.querySelector('.select-checkbox');cb.checked=!cb.checked;toggleSelect(id,cb);return;}
  openDetail(type,id);
}

function saveTask(){
  var name=document.getElementById('task-name').value.trim();if(!name){toast('⚠️ Dê um nome à tarefa.');return;}
  var imgEl=document.getElementById('task-preview-img'),imgDiv=document.getElementById('task-img-preview');
  var img=(imgEl.src&&imgDiv.style.display!=='none')?imgEl.src:null;
  if(currentDetailId&&currentDetailType==='task'){
    var t=state.tasks.find(function(x){return x.id===currentDetailId;});
    if(t){t.name=name;t.desc=document.getElementById('task-desc').value.trim();t.group=document.getElementById('task-group').value;t.deadline=document.getElementById('task-deadline').value;t.budget=document.getElementById('task-budget').value;if(img)t.img=img;
      var rEd=lerRecorrenciaDoForm();
      if(rEd) aplicarRecorrencia(t, rEd); else if(t.recorrencia) pararDeRepetir(t);
      saveState();closeModal('modal-add-task');renderTasks();renderHome();toast(avisoDeRecorrencia(t,'✏️ Tarefa atualizada!'));currentDetailId=null;return;}
  }
  // Criar e o unico caminho que esbarra no limite do Free. Editar uma
  // tarefa que ja existe nao aumenta a conta, entao passa direto.
  if(typeof podeCriarTarefa==='function' && !podeCriarTarefa()){ closeModal('modal-add-task'); return; }
  var nova={id:uid(),_type:'task',name:name,desc:document.getElementById('task-desc').value.trim(),group:document.getElementById('task-group').value,deadline:document.getElementById('task-deadline').value,budget:document.getElementById('task-budget').value,img:img,done:false,createdAt:new Date().toISOString()};
  var rNova=lerRecorrenciaDoForm();
  if(rNova) aplicarRecorrencia(nova, rNova);
  state.tasks.push(nova);
  saveState();closeModal('modal-add-task');resetTaskForm();renderTasks();renderHome();toast(avisoDeRecorrencia(nova,'✅ Tarefa criada!'));
}

// Quick complete task from card
function quickCompleteTask(id) {
  var t = state.tasks.find(function(x){return x.id===id;});
  if(!t) return;
  if(t.recorrencia && t.proxima){
    // Recorrente nao "desmarca" pelo cartao: concluida, ela sai da grade ate
    // a proxima data. Desfazer um toque sem querer fica na aba Recorrentes.
    concluirRecorrente(t);
    saveState(); renderTasks(); renderHome();
    toast('✅ Concluída! Volta em ' + recDDMM(t.proxima) + '.');
    return;
  }
  t.done = !t.done;
  t.completedAt = t.done ? new Date().toISOString() : null;
  saveState();
  renderTasks();
  renderHome();
  toast(t.done ? '✅ Concluída!' : '↩ Reaberta!');
}

// Criar ou editar uma recorrente: o aviso diz QUANDO ela aparece, que e a
// unica coisa que nao da para ver na hora — a tarefa pode nem estar na lista.
function avisoDeRecorrencia(t, padrao){
  if(!t.recorrencia || !t.proxima) return padrao;
  if(estadoDaRecorrencia(t) === 'aguardando') return '🔁 Tarefa repetida. Aparece em ' + recDDMM(t.proxima) + '.';
  return '🔁 Tarefa repetida. Já está na lista.';
}

// Toggle checklist item directly from task card
function toggleTaskInlineCheck(taskId, idx, cb) {
  var t = state.tasks.find(function(x){return x.id===taskId;});
  if(!t||!t.checklist) return;
  t.checklist[idx].done = cb.checked;
  saveState();
  renderTasks();
}

// ═══════════════════════════════════════════════════════════════════════
// REPETIR TAREFA — o bloco do formulario
//
// A regra de datas vive em recorrencia.js. Aqui fica so o formulario: ler,
// preencher, limpar e mostrar em palavras o que vai acontecer.
// ═══════════════════════════════════════════════════════════════════════

var _taskRecOn = false, _taskRecAncora = 'calendario', _taskRecModo = 'dias';

// "+ Nova tarefa" abria com os dados da ultima tarefa editada: o botao
// chamava openModal direto, e resetTaskForm so rodava depois de CRIAR. Com a
// repeticao isso ficaria pior — a regra de uma tarefa vazaria para a
// proxima. Mesmo remedio de abrirNovoLivro() em leitura.js.
function abrirNovaTarefa(){
  resetTaskForm();
  openModal('modal-add-task');
}

function preencherHorasRecorrencia(){
  var sel = document.getElementById('task-rec-hora');
  if(!sel || sel.options.length) return;
  var html = '<option value="">Sem horário — aparece no começo do dia</option>';
  for(var h = 0; h < 24; h++) html += '<option value="' + h + '">' + pad(h) + ':00</option>';
  sel.innerHTML = html;
}

function toggleRepetirTarefa(){
  _taskRecOn = !_taskRecOn;
  pintarFormRecorrencia();
}
function setRecAncora(a){ _taskRecAncora = a; pintarFormRecorrencia(); }
function setRecModo(m){ _taskRecModo = m; pintarFormRecorrencia(); }

// O dia de inicio: a data escolhida em "Primeira vez", ou hoje.
function inicioDoForm(){
  var v = dataISO(document.getElementById('task-deadline').value);
  return v || recISO(new Date());
}

function numDoCampo(id, min, max, padrao){
  var n = parseInt(document.getElementById(id).value, 10);
  if(isNaN(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

// A regra que o formulario descreve agora, ou null se repetir esta desligado.
function lerRecorrenciaDoForm(){
  if(!_taskRecOn) return null;
  var tipo = document.getElementById('task-rec-tipo').value;
  var horaV = document.getElementById('task-rec-hora').value;
  var r = { tipo: tipo, inicio: inicioDoForm(), hora: horaV === '' ? null : parseInt(horaV, 10) };
  if(tipo === 'personalizada'){
    r.modo = _taskRecModo;
    if(_taskRecModo === 'diaDoMes'){
      r.diaDoMes  = numDoCampo('task-rec-dia', 1, 31, 1);
      r.intervalo = numDoCampo('task-rec-intervalo-meses', 1, 24, 1);
    } else {
      r.intervalo = numDoCampo('task-rec-intervalo-dias', 1, 365, 1);
    }
  } else {
    r.ancora = _taskRecAncora;
  }
  return r;
}

function marcarAba(id, on){
  var b = document.getElementById(id);
  if(b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// Pinta o bloco inteiro a partir do estado. Unica fonte de verdade da tela.
function pintarFormRecorrencia(){
  preencherHorasRecorrencia();
  var tg = document.getElementById('task-rec-toggle');
  if(!tg) return;
  tg.setAttribute('aria-checked', _taskRecOn ? 'true' : 'false');
  document.getElementById('task-rec-sw').className = 'toggle-switch' + (_taskRecOn ? ' on' : '');
  document.getElementById('task-rec-wrap').hidden = !_taskRecOn;
  // Com repeticao, a data deixa de ser um prazo e vira a primeira vez.
  document.getElementById('task-deadline-label').textContent = _taskRecOn ? 'Primeira vez' : 'Prazo';
  if(!_taskRecOn) return;

  var pers = document.getElementById('task-rec-tipo').value === 'personalizada';
  document.getElementById('task-rec-ancora-grupo').hidden = pers;
  document.getElementById('task-rec-pers').hidden = !pers;
  marcarAba('task-rec-ancora-calendario', _taskRecAncora === 'calendario');
  marcarAba('task-rec-ancora-conclusao',  _taskRecAncora === 'conclusao');
  marcarAba('task-rec-modo-dias',     _taskRecModo === 'dias');
  marcarAba('task-rec-modo-diaDoMes', _taskRecModo === 'diaDoMes');
  document.getElementById('task-rec-dias-grupo').hidden = _taskRecModo !== 'dias';
  document.getElementById('task-rec-mes-grupo').hidden  = _taskRecModo !== 'diaDoMes';
  var nd = numDoCampo('task-rec-intervalo-dias', 1, 365, 1);
  document.getElementById('task-rec-dias-unid').textContent = (nd === 1 ? 'dia' : 'dias') + ' depois de concluir';
  var nm = numDoCampo('task-rec-intervalo-meses', 1, 24, 1);
  document.getElementById('task-rec-meses-unid').textContent = nm === 1 ? 'mês' : 'meses';

  // Em palavras, o que vai acontecer — com a primeira data de verdade.
  var r = lerRecorrenciaDoForm();
  var primeira = recPrimeiraProxima(r, recISO(new Date()));
  var txt = regraEmPalavras(r) + '. Primeira vez: ' + recDDMM(primeira) + '.';
  if(r.hora !== null){
    txt += ' Ela aparece na lista a partir das ' + pad(r.hora) + ':00.';
    txt += ' ' + avisoDoHorario();
  }
  document.getElementById('task-rec-resumo').textContent = txt;
}

// O que acontece NO horario, alem de a tarefa aparecer. Tres situacoes, e
// cada uma diz o que falta — nada de prometer um aviso que nao vai chegar.
function avisoDoHorario(){
  var liberado = (typeof temRecurso === 'function') && temRecurso('lembretes');
  if(!liberado) return 'Com o plano Pro ou Max, você também recebe um aviso nesse horário.';
  if(typeof lembrete === 'undefined' || !lembrete.configurado){
    return 'Para receber um aviso nesse horário, ligue os Lembretes uma vez em Perfil › Conta.';
  }
  return 'Nesse horário você também recebe um aviso, pelo canal escolhido nos Lembretes.';
}

function resetRecorrenciaForm(){
  _taskRecOn = false; _taskRecAncora = 'calendario'; _taskRecModo = 'dias';
  var ids = {'task-rec-tipo':'diaria', 'task-rec-intervalo-dias':'10', 'task-rec-dia':'1',
             'task-rec-intervalo-meses':'1', 'task-rec-hora':''};
  preencherHorasRecorrencia();
  Object.keys(ids).forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ids[id]; });
  var tt = document.getElementById('task-modal-title'); if(tt) tt.textContent = 'Nova tarefa';
  pintarFormRecorrencia();
}

function preencherRecorrenciaForm(t){
  resetRecorrenciaForm();
  var tt = document.getElementById('task-modal-title'); if(tt) tt.textContent = 'Editar tarefa';
  var r = t && t.recorrencia;
  if(!r){ pintarFormRecorrencia(); return; }
  _taskRecOn = true;
  document.getElementById('task-rec-tipo').value = r.tipo;
  if(r.tipo === 'personalizada'){
    _taskRecModo = r.modo === 'diaDoMes' ? 'diaDoMes' : 'dias';
    if(_taskRecModo === 'diaDoMes'){
      document.getElementById('task-rec-dia').value = r.diaDoMes || 1;
      document.getElementById('task-rec-intervalo-meses').value = r.intervalo || 1;
    } else {
      document.getElementById('task-rec-intervalo-dias').value = r.intervalo || 1;
    }
  } else {
    _taskRecAncora = r.ancora === 'conclusao' ? 'conclusao' : 'calendario';
  }
  document.getElementById('task-rec-hora').value = (r.hora === null || r.hora === undefined) ? '' : String(r.hora);
  // A "primeira vez" gravada volta para o campo, no formato da tela.
  if(r.inicio){ var p = r.inicio.split('-'); document.getElementById('task-deadline').value = p[2]+'/'+p[1]+'/'+p[0]; }
  pintarFormRecorrencia();
}

// ═══════════════════════════════════════════════════════════════════════
// ABA RECORRENTES — todas as tarefas que se repetem, inclusive as que
// estao esperando a proxima data (e que por isso nao aparecem na lista).
// ═══════════════════════════════════════════════════════════════════════

var tarefasAba = 'lista';

function setTarefasAba(nome){
  if(nome !== 'lista' && nome !== 'rec') return;
  tarefasAba = nome;
  document.getElementById('tarefas-aba-lista').hidden = nome !== 'lista';
  document.getElementById('tarefas-aba-rec').hidden   = nome !== 'rec';
  marcarAba('tarefas-tab-lista', nome === 'lista');
  marcarAba('tarefas-tab-rec',   nome === 'rec');
  // Excluir/Editar em lote agem sobre os cartoes da lista; aqui cada linha
  // tem os proprios botoes.
  ['tasks-btn-excluir','tasks-btn-editar'].forEach(function(id){
    var b = document.getElementById(id); if(b) b.hidden = nome === 'rec';
  });
  if(nome === 'rec') renderRecorrentes(); else renderTasks();
}

function tarefasRecorrentes(){
  return (state.tasks || []).filter(function(t){ return t.recorrencia && t.proxima; });
}

function pintarContaRecorrentes(){
  var el = document.getElementById('tarefas-rec-conta');
  if(!el) return;
  var n = tarefasRecorrentes().length;
  el.textContent = n ? String(n) : '';
}

var REC_ORDEM = {atrasada:0, aberta:1, aguardando:2};

function renderRecorrentes(){
  var caixa = document.getElementById('rec-lista');
  if(!caixa) return;
  pintarContaRecorrentes();
  var lista = tarefasRecorrentes();
  if(!lista.length){
    caixa.innerHTML = '<div class="empty-state"><p>Nenhuma tarefa se repete ainda. Ao criar ou editar uma tarefa, ligue “Repetir tarefa?”.</p></div>';
    return;
  }
  // Primeiro o que pede atencao: atrasadas, depois abertas, depois as que
  // aguardam — estas pela data em que voltam.
  lista = lista.map(function(t){ return {t:t, est:estadoDaRecorrencia(t)}; });
  lista.sort(function(a,b){
    if(REC_ORDEM[a.est] !== REC_ORDEM[b.est]) return REC_ORDEM[a.est] - REC_ORDEM[b.est];
    return a.t.proxima < b.t.proxima ? -1 : 1;
  });
  caixa.innerHTML = lista.map(function(it){
    var t = it.t, est = it.est, r = t.recorrencia;
    var hora = (r.hora !== null && r.hora !== undefined && r.hora !== '') ? ' às ' + pad(Number(r.hora)) + ':00' : '';
    var selo, quando;
    if(est === 'atrasada'){ selo = '<span class="task-status-badge atrasada">Tarefa atrasada</span>'; quando = 'desde ' + recDDMM(t.proxima); }
    else if(est === 'aberta'){ selo = '<span class="task-status-badge">Em aberto</span>'; quando = 'desde ' + recDDMM(t.proxima); }
    else { selo = '<span class="task-status-badge done">Aguardando</span>'; quando = 'volta em ' + recDDMM(t.proxima) + hora; }
    var n = conclusoesDaTarefa(t).length;
    var feita = n === 0 ? 'ainda não foi feita' : (n === 1 ? 'feita 1 vez' : 'feita ' + n + ' vezes');
    var id = t.id;
    return '<div class="rec-item">'
      + '<div class="rec-item-info">'
        + '<div class="rec-item-nome">' + esc(t.name) + '</div>'
        + '<div class="rec-item-regra">🔁 ' + esc(regraEmPalavras(r)) + '</div>'
        + '<div class="rec-item-meta">' + selo + '<span>' + quando + '</span><span>' + feita + '</span></div>'
      + '</div>'
      + '<div class="rec-item-acoes">'
        + (podeDesfazerConclusao(t) ? '<button type="button" class="btn btn-ghost btn-sm" onclick="recDesfazer(\'' + id + '\')">↩ Desfazer conclusão</button>' : '')
        + '<button type="button" class="btn btn-ghost btn-sm" onclick="recEditar(\'' + id + '\')">✏️ Editar</button>'
        + '<button type="button" class="btn btn-ghost btn-sm" onclick="recParar(\'' + id + '\')">Parar de repetir</button>'
        + '<button type="button" class="btn btn-ghost btn-sm rec-excluir" onclick="recExcluir(\'' + id + '\')">🗑 Excluir</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function recAchar(id){ return (state.tasks || []).find(function(t){ return t.id === id; }); }

function recAtualizarTelas(){ renderRecorrentes(); renderTasks(); renderHome(); }

function recEditar(id){
  var t = recAchar(id); if(!t) return;
  populateTaskForm(t);
  openModal('modal-add-task');
}

function recDesfazer(id){
  var t = recAchar(id); if(!t) return;
  if(desfazerConclusao(t)){ saveState(); recAtualizarTelas(); toast('↩ Conclusão desfeita. A tarefa voltou para a lista.'); }
}

// Parar de repetir nao apaga nada: a regra sai, a tarefa fica, e as vezes
// em que ela foi feita continuam contando no Resumo.
function recParar(id){
  var t = recAchar(id); if(!t) return;
  pararDeRepetir(t);
  saveState(); recAtualizarTelas();
  toast(t.done ? 'Parou de repetir. Ela fica em “Concluídas”.' : 'Parou de repetir. Ela continua na lista.');
}

function recExcluir(id){
  var t = recAchar(id); if(!t) return;
  var n = conclusoesDaTarefa(t).length;
  document.getElementById('confirm-icon').textContent = '🗑';
  document.getElementById('confirm-title').textContent = 'Excluir tarefa';
  // Excluir uma recorrente leva junto o historico dela — dizer isso e o que
  // diferencia esta confirmacao de "Parar de repetir".
  document.getElementById('confirm-body').textContent =
    'Excluir "' + t.name + '" de vez? ' +
    (n ? (n === 1 ? 'A vez em que ela foi feita deixa' : 'As ' + n + ' vezes em que ela foi feita deixam') + ' de contar no Resumo. ' : '') +
    'Se quiser só que ela pare de voltar, use “Parar de repetir”.';
  document.getElementById('confirm-ok-btn').textContent = 'Excluir';
  document.getElementById('confirm-ok-btn').onclick = function(){
    state.tasks = state.tasks.filter(function(x){ return x.id !== id; });
    saveState(); closeModal('modal-confirm'); resetConfirmBtn();
    recAtualizarTelas(); toast('🗑 Tarefa excluída.');
  };
  openModal('modal-confirm');
}
