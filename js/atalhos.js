// ATALHOS DA HOME e CHAMADOS DO TICOLINO
//
// ATALHOS — ate 4 cartoes na Home, escolhidos pela pessoa. Cada cartao mostra
// um dado vivo da area (a materia de hoje, o gasto do mes, a pagina do
// livro...) e uma acao de um toque (iniciar pomodoro, lancar gasto...).
// Tocar no numero abre a aba; tocar no botao faz a acao sem sair da Home.
// Substituem os dois cartoes antigos (Dinheiro e Treinos), que continuam
// como padrao para quem nunca escolheu.
//
//   state.atalhos = ['estudos', 'dinheiro', 'leitura', 'exercicio']
//   (so ids da lista ATALHOS; qualquer outra coisa e ignorada)
//
// CHAMADOS — o Ticolino do anel chama para UMA coisa por vez que ainda
// falta hoje ("Hoje e dia de Psicologia. Bora comecar?"). Freios:
//   - um chamado por vez, na ordem: estudo planejado, leitura, gastos, treino;
//   - "Agora nao" cala aquele assunto ate amanha;
//   - depois de 2 "Agora nao" no dia, nao chama mais nada hoje;
//   - so chama para o que a pessoa faz no app (plano dela, livro dela...).
//
//   state.chamados = { data: 'aaaa-mm-dd', fora: ['leitura'] }

var ATALHOS_MAX = 4;
var ATALHOS_PADRAO = ['estudos', 'dinheiro', 'leitura', 'exercicio'];
var ATALHOS = {
  estudos:   { nome: 'Estudos',  area: 'a-estudos',   icone: 'estudos', pagina: 'estudos',    desc: 'Matéria de hoje e o pomodoro' },
  dinheiro:  { nome: 'Dinheiro', area: 'a-dinheiro',  icone: 'gastos',  pagina: 'gastos',     desc: 'Gasto do mês e novo lançamento' },
  leitura:   { nome: 'Leitura',  area: 'a-leitura',   icone: 'leitura', pagina: 'leitura',    desc: 'Livro atual e registrar páginas' },
  exercicio: { nome: 'Treinos',  area: 'a-exercicio', icone: 'halter',  pagina: 'exercicios', desc: 'Treinos da semana' },
  quadro:    { nome: 'Quadro',   area: 'a-tarefas',   icone: 'quadro',  pagina: 'quadro',     desc: 'O que você já fez na semana' },
  tarefas:   { nome: 'Tarefas',  area: 'a-tarefas',   icone: 'tarefas', pagina: 'tarefas',    desc: 'Pendentes e nova tarefa' },
  metas:     { nome: 'Metas',    area: 'a-metas',     icone: 'metas',   pagina: 'metas',      desc: 'Metas ativas e nova meta' }
};
var ATALHOS_ORDEM = ['estudos', 'dinheiro', 'leitura', 'exercicio', 'quadro', 'tarefas', 'metas'];

function meusAtalhos(){
  var base = Array.isArray(state.atalhos) ? state.atalhos : ATALHOS_PADRAO, vistos = {}, lista = [];
  base.forEach(function(id){
    if(typeof id === 'string' && ATALHOS[id] && !vistos[id]){ vistos[id] = 1; lista.push(id); }
  });
  return lista.slice(0, ATALHOS_MAX);
}

function livroAtivo(){
  return (state.livros || []).find(function(l){ return l && l.lendoAgora && !l.abandonado; }) || null;
}

// ─── Os dados de cada cartao ─────────────────────────────────────────────
// Devolve { rotulo, valor, extra (HTML ja seguro), meta, botao, primario }.
// valor e meta sao TEXTO: quem pinta usa esc().
function dadosAtalho(id){
  var hoje = new Date();
  if(id === 'estudos'){
    if(typeof timerRunning !== 'undefined' && timerRunning){
      return { rotulo: 'Estudos · agora', valor: estMateria || 'Pomodoro', meta: 'Sessão em andamento', botao: 'Ver o timer' };
    }
    var m = (typeof materiaDeHoje === 'function') ? materiaDeHoje() : null;
    if(m){
      return { rotulo: 'Estudos · hoje', valor: m.materia,
        meta: m.feito ? progressoTxt(m.feito, m.plan) + ' no seu quadro' : tempoTxt(m.plan) + ' no seu quadro',
        botao: 'Iniciar 25 min', primario: true };
    }
    var temHoje = (typeof resumoDoDia === 'function') && resumoDoDia(idxHoje()).length;
    var ses = (typeof todaySessions === 'number') ? todaySessions : 0;
    return { rotulo: 'Estudos · hoje', valor: temHoje ? 'Plano feito' : (ses ? plural(ses, 'sessão', 'sessões') : 'Pomodoro'),
      meta: temHoje ? 'Tudo que você planejou para hoje' : 'Monte seu plano no Quadro',
      botao: temHoje ? 'Mais 25 min' : 'Iniciar 25 min', primario: !temHoje };
  }
  if(id === 'dinheiro'){
    var mes = hoje.getMonth(), ano = hoje.getFullYear();
    var doMes = function(l){ return (l || []).filter(function(g){
      var d = new Date(g.data + 'T12:00:00'); return d.getMonth() === mes && d.getFullYear() === ano;
    }); };
    var soma = function(l){ return l.reduce(function(s, g){ return s + (parseFloat(g.valor) || 0); }, 0); };
    var gastos = doMes(state.gastos), gasto = soma(gastos), entrou = soma(doMes(state.ganhos));
    var pct = entrou > 0 ? Math.round(gasto / entrou * 100) : 0;
    var mesCurto = hoje.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return { rotulo: 'Dinheiro · ' + mesCurto, valor: moeda(gasto),
      extra: entrou > 0 ? mdBarra(Math.min(100, pct), '', 'md-pb--sm t-dinheiro') : '',
      meta: entrou > 0 ? pct + '% do que entrou' : plural(gastos.length, 'lançamento', 'lançamentos'),
      botao: 'Novo gasto' };
  }
  if(id === 'leitura'){
    var l = livroAtivo();
    if(!l) return { rotulo: 'Leitura', valor: 'Nenhum livro', meta: 'Escolha o que ler agora', botao: 'Adicionar livro' };
    var total = parseInt(l.paginas, 10) || 0, lidas = l.paginasLidas || 0;
    return { rotulo: 'Leitura', valor: total ? 'p. ' + lidas + ' de ' + total : lidas + ' páginas',
      extra: total ? mdBarra(lidas / total * 100, '', 'md-pb--sm t-leitura') : '',
      meta: l.titulo || 'Livro atual', botao: 'Registrar' };
  }
  if(id === 'exercicio'){
    var seg = (typeof exSegunda === 'function') ? exSegunda(new Date()) : null, feitos = 0, meta = 5;
    if(seg && state.exercicios && typeof exDiasTreinados === 'function'){
      var fim = new Date(seg.getTime()); fim.setDate(seg.getDate() + 6);
      feitos = exDiasTreinados(seg, fim);
      meta = state.exercicios.metaSemanal || 5;
    }
    var falta = Math.max(0, meta - feitos);
    return { rotulo: 'Treinos · semana', valor: feitos + ' de ' + meta,
      extra: mdBarra(meta ? feitos / meta * 100 : 0, '', 'md-pb--sm t-exercicio'),
      meta: falta ? 'faltam ' + plural(falta, 'dia', 'dias') : 'meta da semana batida', botao: 'Treinar' };
  }
  if(id === 'quadro'){
    var r = (typeof resumoQuadroSemana === 'function') ? resumoQuadroSemana() : { feitos: 0, total: 0 };
    var dias = (typeof estadoDosDias === 'function') ? estadoDosDias() : [];
    var ih = idxHoje();
    var fita = '<span class="at-sem" aria-hidden="true">' + dias.map(function(d, i){
      var c = d.total && d.feitos >= d.total ? ' ok' : '';
      return '<i class="' + c + (i === ih ? ' hoje' : '') + '">' + DIAS_LETRA[i] + '</i>';
    }).join('') + '</span>';
    return { rotulo: 'Quadro', valor: r.total ? r.feitos + ' de ' + r.total : 'Semana livre', extra: dias.length ? fita : '',
      meta: r.total ? 'itens da semana feitos' : 'Monte sua semana', botao: 'Abrir quadro' };
  }
  if(id === 'tarefas'){
    var pend = (state.tasks || []).filter(function(t){ return !t.done && (typeof tarefaVisivel !== 'function' || tarefaVisivel(t)); });
    return { rotulo: 'Tarefas', valor: plural(pend.length, 'pendente', 'pendentes'),
      meta: pend.length ? 'Toque no número para ver' : 'Nada pendente', botao: 'Nova tarefa' };
  }
  if(id === 'metas'){
    var ativas = (state.metas || []).filter(function(m2){ return !m2.done; }).length;
    var feitas = (state.metas || []).length - ativas;
    return { rotulo: 'Metas', valor: plural(ativas, 'ativa', 'ativas'),
      meta: feitas ? plural(feitas, 'concluída', 'concluídas') : 'Nenhuma concluída ainda', botao: 'Nova meta' };
  }
  return null;
}

function renderAtalhos(){
  var box = document.getElementById('home-atalhos');
  if(!box) return;
  var ids = meusAtalhos();
  var html = ids.map(function(id){
    var a = ATALHOS[id], d = dadosAtalho(id);
    if(!d) return '';
    return '<article class="lv ' + a.area + '">'
      + '<div class="lv-top"><span class="md-label md-a-txt">' + esc(d.rotulo) + '</span>'
      + '<span class="md-tile lv-ico ' + a.area + '">' + ico(a.icone, 16, 2.2) + '</span></div>'
      + '<button type="button" class="lv-val md-num" onclick="goToPage(\'' + a.pagina + '\')" aria-label="' + esc(d.valor) + '. Abrir ' + a.nome + '">' + esc(d.valor) + '</button>'
      + (d.extra || '')
      + '<span class="lv-meta">' + esc(d.meta) + '</span>'
      + '<button type="button" class="lv-bt' + (d.primario ? ' lv-bt--pri' : '') + '" onclick="acaoAtalho(\'' + id + '\')">'
      + (d.primario ? ico('play', 14, 2.6) : '') + esc(d.botao) + '</button>'
      + '</article>';
  }).join('');
  if(ids.length < ATALHOS_MAX){
    html += '<button type="button" class="at-add" onclick="abrirPersonalizarAtalhos()">' + ico('plus', 18, 2.6) + 'Adicionar atalho</button>';
  }
  box.innerHTML = html;
}

// Repinta a Home quando um modal aberto por um atalho fecha (salvou ou nao),
// para o cartao ja mostrar o gasto novo, a pagina nova...
function aoFecharModal(id, fn){
  var ov = document.getElementById(id);
  if(!ov || typeof MutationObserver !== 'function') return;
  var obs = new MutationObserver(function(){
    if(ov.classList.contains('open')) return;
    obs.disconnect();
    try { fn(); } catch(e){ console.error('atalhos:', e); }
  });
  obs.observe(ov, { attributes: true, attributeFilter: ['class'] });
}
function repintarHomeSeVisivel(){
  var p = document.getElementById('page-home');
  if(p && p.classList.contains('active')) renderHome();
}

function acaoAtalho(id){
  if(id === 'estudos'){
    if(typeof timerRunning !== 'undefined' && timerRunning){ goToPage('estudos'); return; }
    var m = (typeof materiaDeHoje === 'function') ? materiaDeHoje() : null;
    if(m){ iniciarMateria(m.materia); return; }
    goToPage('estudos');
    escolherMateriaTimer(null);
    setTimerPreset(25, document.querySelector('.timer-preset-btn'));
    startTimer();
  } else if(id === 'dinheiro'){
    openModal_addGasto();
    aoFecharModal('modal-add-gasto', repintarHomeSeVisivel);
  } else if(id === 'leitura'){
    if(livroAtivo()){
      openModal_registrarLeitura();
      aoFecharModal('modal-registrar-leitura', repintarHomeSeVisivel);
    } else {
      goToPage('leitura');
      abrirNovoLivro();
    }
  } else if(id === 'exercicio'){
    goToPage('exercicios');
  } else if(id === 'quadro'){
    goToPage('quadro');
  } else if(id === 'tarefas'){
    abrirNovaTarefa();
    aoFecharModal('modal-add-task', repintarHomeSeVisivel);
  } else if(id === 'metas'){
    if(typeof resetMetaForm === 'function') resetMetaForm();
    openModal('modal-add-meta');
    aoFecharModal('modal-add-meta', repintarHomeSeVisivel);
  }
}

// ─── Personalizar (modal-atalhos) ────────────────────────────────────────
var _atEdit = null;

function abrirPersonalizarAtalhos(){
  _atEdit = meusAtalhos().slice();
  pintarPersonalizarAtalhos();
  openModal('modal-atalhos');
}

function pintarPersonalizarAtalhos(){
  var l = _atEdit;
  document.getElementById('at-conta').textContent = l.length + ' de ' + ATALHOS_MAX + ' na tela Hoje · use as setas para mudar a ordem';
  var na = document.getElementById('at-na-home');
  na.innerHTML = l.length ? l.map(function(id, i){
    var a = ATALHOS[id];
    return '<div class="at-ed">'
      + '<span class="md-tile md-tile--sm ' + a.area + '">' + ico(a.icone, 18, 2.2) + '</span>'
      + '<span class="at-ed-txt"><b>' + a.nome + '</b><span>' + a.desc + '</span></span>'
      + '<button type="button" class="qd-ic" onclick="moverAtalho(' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir ' + a.nome + '">' + seta('cima') + '</button>'
      + '<button type="button" class="qd-ic" onclick="moverAtalho(' + i + ',1)"' + (i === l.length - 1 ? ' disabled' : '') + ' aria-label="Descer ' + a.nome + '">' + seta('baixo') + '</button>'
      + '<button type="button" class="qd-ic" onclick="tirarAtalho(' + i + ')" aria-label="Tirar ' + a.nome + ' da tela Hoje"><svg class="md-ico" viewBox="0 0 24 24" width="18" height="18" stroke-width="3" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
      + '</div>';
  }).join('') : '<p class="md-meta">Nenhum atalho. A tela Hoje fica só com os itens do dia.</p>';

  var fora = ATALHOS_ORDEM.filter(function(id){ return l.indexOf(id) === -1; });
  var cheio = l.length >= ATALHOS_MAX;
  document.getElementById('at-disponiveis').innerHTML = fora.map(function(id){
    var a = ATALHOS[id];
    return '<button type="button" class="at-disp"' + (cheio ? ' disabled' : '') + ' onclick="porAtalho(\'' + id + '\')" aria-label="Pôr ' + a.nome + ' na tela Hoje">'
      + '<span class="md-tile md-tile--sm ' + a.area + '">' + ico(a.icone, 18, 2.2) + '</span>'
      + '<span class="at-ed-txt"><b>' + a.nome + '</b><span>' + a.desc + '</span></span>'
      + '<span class="ab-mais" aria-hidden="true">' + ico('plus', 16, 3) + '</span></button>';
  }).join('');
  document.getElementById('at-cheio').hidden = !cheio || !fora.length;
}

function moverAtalho(i, dir){
  var j = i + dir;
  if(!_atEdit || j < 0 || j >= _atEdit.length) return;
  var t = _atEdit[i]; _atEdit[i] = _atEdit[j]; _atEdit[j] = t;
  pintarPersonalizarAtalhos();
}
function tirarAtalho(i){
  if(!_atEdit) return;
  _atEdit.splice(i, 1);
  pintarPersonalizarAtalhos();
}
function porAtalho(id){
  if(!_atEdit || !ATALHOS[id] || _atEdit.indexOf(id) >= 0 || _atEdit.length >= ATALHOS_MAX) return;
  _atEdit.push(id);
  pintarPersonalizarAtalhos();
}
function salvarAtalhos(){
  if(!_atEdit) return;
  state.atalhos = _atEdit.filter(function(id){ return !!ATALHOS[id]; }).slice(0, ATALHOS_MAX);
  _atEdit = null;
  saveState();
  closeModal('modal-atalhos');
  renderHome();
  toast('Atalhos salvos.');
}

// ─── Chamados do Ticolino ────────────────────────────────────────────────
var CHAMADOS_DISPENSAS_DIA = 2;

function chamadosDeHoje(){
  var hoje = hojeStr(), c = state.chamados;
  if(!c || typeof c !== 'object' || c.data !== hoje || !Array.isArray(c.fora)) return { data: hoje, fora: [] };
  return { data: hoje, fora: c.fora.filter(function(x){ return typeof x === 'string'; }).slice(0, 10) };
}

// A lista do que ainda falta hoje, na ordem de prioridade. Cada item tem
// titulo/sub (TEXTO), o rotulo do botao e a chave do assunto.
function candidatosChamado(){
  var d = garantirDiario(), h = new Date().getHours(), lista = [];
  if(h < 6) return lista;   // de madrugada, ninguem quer ser chamado
  var m = (typeof materiaDeHoje === 'function') ? materiaDeHoje() : null;
  var planoHoje = (typeof resumoDoDia === 'function') ? resumoDoDia(idxHoje()) : [];
  if(m){
    var falta = Math.max(0, m.plan - m.feito);
    lista.push({ chave: 'estudo', titulo: 'Hoje é dia de ' + m.materia + '. Bora começar?',
      sub: m.feito ? 'Falta ' + tempoTxt(falta) + ' do que você planejou.' : 'Você planejou ' + tempoTxt(m.plan) + ' no seu quadro.',
      botao: 'Começar 25 min' });
  } else if(!d.estudo && !planoHoje.length){
    lista.push({ chave: 'estudo', titulo: 'Que tal 25 minutos de estudo?', sub: 'Um pomodoro já fecha o item de estudos do dia.', botao: 'Começar' });
  }
  var l = livroAtivo();
  if(!d.leitura && l){
    var total = parseInt(l.paginas, 10) || 0;
    lista.push({ chave: 'leitura', titulo: 'Que tal 20 minutos de leitura?',
      sub: total ? 'Você está na página ' + (l.paginasLidas || 0) + ' de ' + total + '.' : 'Seu livro está esperando.',
      botao: 'Registrar leitura' });
  }
  if(!d.grana && h >= 17){
    lista.push({ chave: 'grana', titulo: 'Já lançou os gastos de hoje?', sub: 'Leva menos de um minuto.', botao: 'Lançar gasto' });
  }
  if(!d.exercicio && h >= 7){
    lista.push({ chave: 'exercicio', titulo: 'Você já se exercitou hoje?', sub: 'Até uma caminhada conta.', botao: 'Treinar' });
  }
  return lista;
}

function chamadoDaVez(){
  var c = chamadosDeHoje();
  if(c.fora.length >= CHAMADOS_DISPENSAS_DIA) return null;
  var lista = candidatosChamado();
  for(var i = 0; i < lista.length; i++) if(c.fora.indexOf(lista[i].chave) === -1) return lista[i];
  return null;
}

var _chamadoAtual = null;
function renderChamado(){
  var box = document.getElementById('home-chamado');
  if(!box) return;
  var ch = chamadoDaVez();
  _chamadoAtual = ch;
  if(!ch){ box.hidden = true; box.innerHTML = ''; return; }
  // A estrutura e fixa; o texto (que pode ter o nome do livro ou da
  // materia) entra por textContent.
  if(!box.firstChild){
    box.innerHTML = '<b class="hc-tit"></b><span class="hc-sub"></span>'
      + '<div class="hc-acoes"><button type="button" class="md-btn md-btn--header hc-ir" onclick="aceitarChamado()"></button>'
      + '<button type="button" class="hc-nao" onclick="dispensarChamado()">Agora não</button></div>';
  }
  box.querySelector('.hc-tit').textContent = ch.titulo;
  box.querySelector('.hc-sub').textContent = ch.sub;
  box.querySelector('.hc-ir').innerHTML = ico('play', 16, 2.6) + esc(ch.botao);
  box.dataset.chave = ch.chave;
  box.hidden = false;
}

function aceitarChamado(){
  var ch = _chamadoAtual;
  if(!ch) return;
  if(ch.chave === 'estudo') acaoAtalho('estudos');
  else if(ch.chave === 'leitura') acaoAtalho('leitura');
  else if(ch.chave === 'grana') acaoAtalho('dinheiro');
  else if(ch.chave === 'exercicio') goToPage('exercicios');
}

function dispensarChamado(){
  var ch = _chamadoAtual;
  if(!ch) return;
  var c = chamadosDeHoje();
  if(c.fora.indexOf(ch.chave) === -1) c.fora.push(ch.chave);
  state.chamados = c;
  saveState();
  var box = document.getElementById('home-chamado');
  var depois = function(){ if(box) box.classList.remove('saindo'); renderChamado(); };
  if(box && !(typeof menosMovimento === 'function' && menosMovimento())){
    box.classList.add('saindo');
    setTimeout(depois, 220);
  } else depois();
}
