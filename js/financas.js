// FINANCAS — as abas Ganhos e Geral da area de dinheiro.
//
// A pagina de dinheiro passou a ter tres telas:
//   1. Gastos  — o que ja existia (js/gastos.js), agora com forma de pagamento.
//   2. Ganhos  — entradas separadas por instituicao financeira, criadas pelo
//                proprio usuario (Nubank, Bradesco, o que ele quiser).
//   3. Geral   — o panorama: quanto ele tem, o que entrou, o que saiu.
//
// Este arquivo cuida das duas telas novas e da troca entre as tres.
// A tela de Gastos continua inteira em js/gastos.js — nada foi movido de la.

// ═══════════════════════════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════════════════════════
//
// state.instituicoes  [{id, nome, createdAt}]
// state.ganhos        [{id, instituicaoId, valor, fonte, data, recorrente,
//                       diaRecorrencia, origemId, mesRef, createdAt}]
// state.ganhosPulados {'<origemId>:<aaaa-mm>': true}  — meses que o usuario
//                     apagou na mao e que a recorrencia NAO deve recriar.

function finGarantirEstado(){
  if(!state.instituicoes) state.instituicoes = [];
  if(!state.ganhos) state.ganhos = [];
  if(!state.ganhosPulados) state.ganhosPulados = {};
  if(!state.gastos) state.gastos = [];
  if(!state.categorias) state.categorias = [];
}

// Data de hoje em aaaa-mm-dd no fuso do aparelho.
//
// toISOString() devolve UTC: no Brasil, depois das 21h ele ja aponta para o
// dia seguinte. Toda data que o usuario ve e digita e local, entao comparar
// com a versao UTC lancaria a recorrencia um dia adiantado.
function dataLocalISO(d){
  d = d || new Date();
  return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
}

// ─── RECORRENCIA ────────────────────────────────────────────────────────
//
// Uma entrada marcada como recorrente e a ORIGEM. Todo mes, no mesmo dia,
// ela gera uma copia (origemId apontando para ela). A geracao e idempotente:
// roda quantas vezes quiser que o mes ja lancado nao duplica.
//
// Nao geramos o futuro — so ate hoje. Dinheiro que ainda nao caiu nao pode
// aparecer no saldo.
function materializarRecorrentes(){
  finGarantirEstado();
  var mudou = false;
  var hojeStr = dataLocalISO();
  var hoje = new Date();
  var limiteAno = hoje.getFullYear(), limiteMes = hoje.getMonth();

  // Indice dos meses ja cobertos por origem — montado numa passada so, para
  // nao varrer a lista inteira dentro do laco de cada origem.
  var cobertos = {};
  state.ganhos.forEach(function(g){
    if(!g.origemId) return;
    cobertos[g.origemId + ':' + (g.mesRef || String(g.data||'').slice(0,7))] = true;
  });

  var origens = state.ganhos.filter(function(g){ return g.recorrente && !g.origemId; });

  origens.forEach(function(o){
    if(!o.data) return;
    var base = new Date(o.data + 'T12:00:00');
    if(isNaN(base.getTime())) return;
    var dia = parseInt(o.diaRecorrencia, 10) || base.getDate();
    cobertos[o.id + ':' + o.data.slice(0,7)] = true;   // o mes da propria origem

    var ano = base.getFullYear(), mes = base.getMonth();
    // Teto de seguranca: 600 meses sao 50 anos. Uma data digitada errada
    // (1900, por exemplo) nao pode travar o navegador num laco infinito.
    for(var passo = 0; passo < 600; passo++){
      mes++;
      if(mes > 11){ mes = 0; ano++; }
      if(ano > limiteAno || (ano === limiteAno && mes > limiteMes)) break;

      var mesRef = ano + '-' + ('0'+(mes+1)).slice(-2);
      var chave = o.id + ':' + mesRef;
      if(cobertos[chave]) continue;
      if(state.ganhosPulados[chave]) continue;   // apagado na mao: fica apagado

      // Dia 31 em fevereiro cai no ultimo dia do mes, nao vaza para marco.
      var ultimoDia = new Date(ano, mes+1, 0).getDate();
      var dataStr = mesRef + '-' + ('0'+Math.min(dia, ultimoDia)).slice(-2);
      if(dataStr > hojeStr) continue;            // ainda nao caiu

      state.ganhos.push({
        id: uid(), instituicaoId: o.instituicaoId, valor: o.valor,
        fonte: o.fonte, data: dataStr, recorrente: false,
        origemId: o.id, mesRef: mesRef,
        createdAt: new Date().toISOString()
      });
      cobertos[chave] = true;
      mudou = true;
    }
  });
  return mudou;
}

// Chamado na abertura do app e sempre que a area de dinheiro e desenhada.
function atualizarRecorrentes(){
  if(materializarRecorrentes()){ saveState(); return true; }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// TROCA DE ABA (Gastos / Ganhos / Geral)
// ═══════════════════════════════════════════════════════════════════════

var finAba = 'gastos';

function setFinAba(nome){
  if(['gastos','ganhos','geral'].indexOf(nome) === -1) return;
  finAba = nome;
  ['gastos','ganhos','geral'].forEach(function(n){
    var sec = document.getElementById('fin-aba-' + n);
    if(sec) sec.style.display = (n === nome) ? '' : 'none';
    var acoes = document.getElementById('fin-acoes-' + n);
    if(acoes) acoes.style.display = (n === nome) ? 'flex' : 'none';
    var bt = document.getElementById('fin-tab-' + n);
    if(bt) bt.setAttribute('aria-pressed', n === nome ? 'true' : 'false');
  });
  // Os graficos que medem a propria largura so sabem o tamanho depois que a
  // secao aparece — desenhar antes pintaria num elemento de 0px.
  renderFinancas();
}

// Ponto unico de desenho da area de dinheiro. A navegacao chama isto.
function renderFinancas(){
  if(!document.getElementById('fin-abas')) return;
  finGarantirEstado();
  atualizarRecorrentes();
  renderGastos();
  renderGanhos();
  renderGeral();
}

// ═══════════════════════════════════════════════════════════════════════
// CORES DAS ORIGENS DE ENTRADA
// ═══════════════════════════════════════════════════════════════════════
//
// As "categorias" de entrada nao sao cadastradas: elas nascem do que o
// usuario digita em "de onde veio". A cor entao vem da ordem em que cada
// origem apareceu pela primeira vez — estavel, nao muda ao filtrar.
// A paleta e a mesma das categorias de gasto (PALETA_CATEGORIAS, gastos.js),
// para as duas telas falarem a mesma lingua visual.

function fonteNome(g){
  return (g && String(g.fonte||'').trim()) || 'Sem origem';
}

function mapaCoresFontes(){
  var ordem = state.ganhos.slice().sort(function(a,b){
    return String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  });
  var mapa = {}, i = 0;
  ordem.forEach(function(g){
    var k = fonteNome(g).toLowerCase();
    if(mapa[k]) return;
    mapa[k] = corParaTema(PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length]);
    i++;
  });
  return mapa;
}

// ═══════════════════════════════════════════════════════════════════════
// TOTAIS
// ═══════════════════════════════════════════════════════════════════════

function somaValores(lista){
  return (lista||[]).reduce(function(s,i){
    var v = parseFloat(i.valor);
    return s + (isFinite(v) ? v : 0);
  }, 0);
}

function ganhosDaInstituicao(id){
  return state.ganhos.filter(function(g){ return g.instituicaoId === id; });
}
function totalInstituicao(id){ return somaValores(ganhosDaInstituicao(id)); }
function totalGanhos(){ return somaValores(state.ganhos); }
function totalGastos(){ return somaValores(state.gastos); }

// ═══════════════════════════════════════════════════════════════════════
// ABA GANHOS
// ═══════════════════════════════════════════════════════════════════════

var ganhoInstAtual = null;    // id da instituicao aberta
var _ganhosEdit = false;      // modo editar (canto superior direito)
var _ganhosHist = false;      // historico aberto
var _ganhosDash = false;      // dashboard aberto

function instituicaoPorId(id){
  return state.instituicoes.find(function(i){ return i.id === id; }) || null;
}

// Garante que sempre ha uma instituicao valida selecionada.
function normalizarInstAtual(){
  if(ganhoInstAtual && instituicaoPorId(ganhoInstAtual)) return;
  ganhoInstAtual = state.instituicoes.length ? state.instituicoes[0].id : null;
}

function selecionarInstituicao(id){
  ganhoInstAtual = id;
  renderGanhos();
}

function toggleGanhosEdit(){
  _ganhosEdit = !_ganhosEdit;
  renderGanhos();
}
function toggleGanhosHist(){
  _ganhosHist = !_ganhosHist;
  renderGanhos();
}
function toggleGanhosDash(){
  _ganhosDash = !_ganhosDash;
  renderGanhos();
}

function renderGanhos(){
  var raiz = document.getElementById('fin-aba-ganhos');
  if(!raiz) return;
  finGarantirEstado();
  normalizarInstAtual();

  renderInstChips();

  var painel = document.getElementById('ganhos-painel');
  if(!painel) return;

  if(!state.instituicoes.length){
    painel.innerHTML = estadoVazio('rico',
      'Nenhuma instituição ainda. Crie a primeira para começar a lançar suas entradas.',
      '<button class="btn btn-primary btn-sm" onclick="abrirModalInstituicao()">Nova instituição</button>');
    return;
  }

  var inst = instituicaoPorId(ganhoInstAtual);
  var lista = ganhosDaInstituicao(inst.id);
  var total = somaValores(lista);
  var acumulado = totalGanhos();
  var pct = acumulado > 0 ? (total/acumulado*100) : 0;

  painel.innerHTML =
    '<div class="ganhos-saldo">'
      + '<div class="ganhos-saldo-topo">'
        + '<div class="ganhos-saldo-label">Saldo em ' + esc(inst.nome) + '</div>'
        + '<button type="button" class="ganhos-editar-btn' + (_ganhosEdit ? ' ativo' : '') + '" '
          + 'onclick="toggleGanhosEdit()" aria-pressed="' + (_ganhosEdit ? 'true' : 'false') + '">'
          + (_ganhosEdit ? '✓ Concluir' : '✏️ Editar') + '</button>'
      + '</div>'
      + '<div class="ganhos-saldo-valor">' + moeda(total) + '</div>'
      + '<div class="ganhos-saldo-pct">'
        + '<strong>' + pct.toFixed(1).replace('.', ',') + '%</strong> do seu total acumulado ('
        + moeda(acumulado) + ')</div>'
      + '<div class="progress-bar-track" style="margin-top:10px">'
        + '<div class="progress-bar-fill" style="width:' + Math.min(100, pct).toFixed(1) + '%"></div>'
      + '</div>'
      + (_ganhosEdit
          ? '<div class="ganhos-inst-acoes">'
            + '<button class="btn btn-ghost btn-sm" onclick="abrirModalInstituicao(\'' + inst.id + '\')">Renomear instituição</button>'
            + '<button class="btn btn-danger btn-sm" onclick="excluirInstituicao(\'' + inst.id + '\')">Excluir instituição</button>'
          + '</div>'
          : '')
    + '</div>'

    + '<div class="ganhos-acoes">'
      + '<button class="btn btn-primary btn-sm" onclick="abrirModalGanho()">+ Registrar entrada</button>'
      + '<button class="btn btn-ghost btn-sm' + (_ganhosHist ? ' ativo' : '') + '" onclick="toggleGanhosHist()" aria-pressed="'
        + (_ganhosHist ? 'true' : 'false') + '">📜 Histórico</button>'
      + '<button class="btn btn-ghost btn-sm' + (_ganhosDash ? ' ativo' : '') + '" onclick="toggleGanhosDash()" aria-pressed="'
        + (_ganhosDash ? 'true' : 'false') + '">📊 Dashboard</button>'
    + '</div>'

    + (_ganhosHist ? '<div class="glass painel fin-secao">'
        + '<div class="section-title" style="margin:0 0 12px 0">Histórico por origem</div>'
        + historicoGanhosHTML(lista)
      + '</div>' : '')

    + (_ganhosDash ? '<div class="glass painel fin-secao">'
        + '<div class="section-title" style="margin:0 0 16px 0">De onde vem o seu dinheiro</div>'
        + '<div class="fin-pizza-linha">'
          + '<div class="fin-pizza-caixa"><canvas id="pizza-ganhos" width="180" height="180"></canvas></div>'
          + '<div id="pizza-ganhos-legenda" class="fin-legenda"></div>'
        + '</div>'
        + '<div class="section-title">Frequência de cada origem</div>'
        + frequenciaGanhosHTML(lista)
      + '</div>' : '');

  if(_ganhosDash){
    var cores = mapaCoresFontes();
    var fatias = fatiasPorFonte(lista, cores);
    desenharPizza(document.getElementById('pizza-ganhos'), fatias);
    var leg = document.getElementById('pizza-ganhos-legenda');
    if(leg) leg.innerHTML = legendaHTML(fatias, 'Nenhuma entrada registrada nesta instituição.');
  }
}

function renderInstChips(){
  var barra = document.getElementById('ganhos-inst-chips');
  if(!barra) return;
  if(!state.instituicoes.length){ barra.innerHTML = ''; return; }
  barra.innerHTML = state.instituicoes.map(function(i){
    var ativa = i.id === ganhoInstAtual;
    return '<button type="button" class="inst-chip' + (ativa ? ' active' : '') + '" '
      + 'aria-pressed="' + (ativa ? 'true' : 'false') + '" '
      + 'onclick="selecionarInstituicao(\'' + i.id + '\')">'
      + '<span class="inst-chip-nome">' + esc(i.nome) + '</span>'
      + '<span class="inst-chip-valor">' + moeda(totalInstituicao(i.id)) + '</span>'
      + '</button>';
  }).join('');
}

// ─── Historico: lista agrupada pelas origens que o usuario cadastrou ────
function historicoGanhosHTML(lista){
  if(!lista.length){
    return '<div class="empty-state"><p>Nenhuma entrada registrada nesta instituição.</p></div>';
  }
  var cores = mapaCoresFontes();
  var porFonte = {};
  lista.forEach(function(g){
    var nome = fonteNome(g);
    var k = nome.toLowerCase();
    if(!porFonte[k]) porFonte[k] = { nome: nome, itens: [] };
    porFonte[k].itens.push(g);
  });

  // Maior origem primeiro: e a informacao que a pessoa procura.
  var chaves = Object.keys(porFonte).sort(function(a,b){
    return somaValores(porFonte[b].itens) - somaValores(porFonte[a].itens);
  });

  return chaves.map(function(k, gi){
    var grupo = porFonte[k];
    var cor = cores[k] || corParaTema(COR_OUTROS);
    var subtotal = somaValores(grupo.itens);
    var grupoId = 'ganho-group-' + gi;
    var itens = grupo.itens.slice().sort(function(a,b){
      return String(b.data||'').localeCompare(String(a.data||''));
    }).map(function(g){
      var dataFmt = g.data ? new Date(g.data+'T12:00:00').toLocaleDateString('pt-BR') : '';
      var marca = g.recorrente ? '<span class="parcela-badge">recorrente</span>'
                : (g.origemId ? '<span class="parcela-badge">automático</span>' : '');
      return '<div class="gasto-item">'
        + '<div class="gasto-cat-dot" style="background:' + cor + '"></div>'
        + '<div class="gasto-item-info">'
          + '<div class="gasto-item-desc">' + esc(grupo.nome) + marca + '</div>'
          + '<div class="gasto-item-meta">' + dataFmt + '</div>'
        + '</div>'
        + '<div class="gasto-item-valor ganho-valor">+ ' + moeda(parseFloat(g.valor)||0) + '</div>'
        + '<div class="gasto-item-actions' + (_ganhosEdit ? ' sempre-visivel' : '') + '">'
          + '<div class="icon-btn ganho-edit-btn" data-id="' + g.id + '" title="Editar">✏️</div>'
          + '<div class="icon-btn danger ganho-del-btn" data-id="' + g.id + '" title="Excluir">🗑</div>'
        + '</div>'
      + '</div>';
    }).join('');

    return '<div class="gasto-group-card">'
      + '<div class="gasto-group-header" data-gid="' + grupoId + '" style="cursor:pointer">'
        + '<div class="gasto-group-dot" style="background:' + cor + '"></div>'
        + '<div class="gasto-group-name">' + esc(grupo.nome) + '</div>'
        + '<span class="gasto-group-count">' + grupo.itens.length + ' entrada' + (grupo.itens.length>1?'s':'') + '</span>'
        + '<div class="gasto-group-total ganho-valor">' + moeda(subtotal) + '</div>'
        + '<div class="gasto-group-arrow" id="arr-' + grupoId + '">›</div>'
      + '</div>'
      + '<div class="gasto-group-body" id="' + grupoId + '">' + itens + '</div>'
    + '</div>';
  }).join('');
}

// ─── Dashboard: com que frequencia cada origem aparece ──────────────────
function frequenciaGanhosHTML(lista){
  if(!lista.length) return '<div class="empty-state"><p>Sem dados para mostrar ainda.</p></div>';

  var porFonte = {};
  lista.forEach(function(g){
    var nome = fonteNome(g), k = nome.toLowerCase();
    if(!porFonte[k]) porFonte[k] = { nome: nome, itens: [], meses: {}, recorrente: false };
    porFonte[k].itens.push(g);
    porFonte[k].meses[String(g.data||'').slice(0,7)] = true;
    if(g.recorrente || g.origemId) porFonte[k].recorrente = true;
  });

  var cores = mapaCoresFontes();
  var chaves = Object.keys(porFonte).sort(function(a,b){
    return porFonte[b].itens.length - porFonte[a].itens.length;
  });

  return '<div class="fin-freq">' + chaves.map(function(k){
    var f = porFonte[k];
    var meses = Object.keys(f.meses).length;
    var porMes = meses ? (f.itens.length / meses) : 0;
    var quando = f.recorrente ? 'Todo mês (recorrente)'
      : (porMes >= 1.5 ? porMes.toFixed(1).replace('.',',') + 'x por mês'
                       : (meses > 1 ? 'Em ' + meses + ' meses diferentes' : 'Uma vez só'));
    return '<div class="fin-freq-item">'
      + '<div class="fin-freq-dot" style="background:' + (cores[k] || corParaTema(COR_OUTROS)) + '"></div>'
      + '<div class="fin-freq-info">'
        + '<div class="fin-freq-nome">' + esc(f.nome) + '</div>'
        + '<div class="fin-freq-meta">' + f.itens.length + ' entrada' + (f.itens.length>1?'s':'') + ' • ' + quando + '</div>'
      + '</div>'
      + '<div class="fin-freq-valor">' + moeda(somaValores(f.itens)) + '</div>'
    + '</div>';
  }).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════
// MODAIS: INSTITUICAO E ENTRADA
// ═══════════════════════════════════════════════════════════════════════

function abrirModalInstituicao(id){
  var editando = id ? instituicaoPorId(id) : null;
  document.getElementById('inst-modal-title').textContent = editando ? 'Renomear instituição' : 'Nova instituição';
  document.getElementById('inst-edit-id').value = editando ? editando.id : '';
  document.getElementById('inst-nome').value = editando ? editando.nome : '';
  openModal('modal-instituicao');
  var campo = document.getElementById('inst-nome');
  if(campo && campo.focus) campo.focus();
}

function salvarInstituicao(){
  finGarantirEstado();
  var nome = document.getElementById('inst-nome').value.trim();
  var id = document.getElementById('inst-edit-id').value;
  if(!nome){ toast('⚠️ Dê um nome para a instituição.'); return; }

  var repetida = state.instituicoes.some(function(i){
    return i.id !== id && i.nome.toLowerCase() === nome.toLowerCase();
  });
  if(repetida){ toast('⚠️ Você já tem uma instituição com esse nome.'); return; }

  if(id){
    var inst = instituicaoPorId(id);
    if(inst) inst.nome = nome;
    toast('✏️ Instituição renomeada!');
  } else {
    var nova = { id: uid(), nome: nome, createdAt: new Date().toISOString() };
    state.instituicoes.push(nova);
    ganhoInstAtual = nova.id;
    toast('🏦 Instituição criada!');
  }
  saveState();
  closeModal('modal-instituicao');
  renderGanhos();
  renderGeral();
}

function excluirInstituicao(id){
  var inst = instituicaoPorId(id);
  if(!inst) return;
  var quantas = ganhosDaInstituicao(id).length;
  document.getElementById('confirm-icon').textContent = '🏦';
  document.getElementById('confirm-title').textContent = 'Excluir ' + inst.nome;
  document.getElementById('confirm-body').textContent = quantas
    ? 'Isso apaga também as ' + quantas + ' entradas lançadas nela. Não dá para desfazer.'
    : 'Excluir esta instituição?';
  document.getElementById('confirm-ok-btn').textContent = 'Excluir';
  document.getElementById('confirm-ok-btn').onclick = function(){
    // As entradas geradas por recorrencia tambem somem, e o registro de
    // "pulados" delas deixa de fazer sentido — limpar evita lixo crescendo
    // para sempre no estado.
    var apagados = {};
    state.ganhos.forEach(function(g){ if(g.instituicaoId === id) apagados[g.id] = true; });
    Object.keys(state.ganhosPulados).forEach(function(k){
      if(apagados[k.split(':')[0]]) delete state.ganhosPulados[k];
    });
    state.ganhos = state.ganhos.filter(function(g){ return g.instituicaoId !== id; });
    state.instituicoes = state.instituicoes.filter(function(i){ return i.id !== id; });
    if(ganhoInstAtual === id) ganhoInstAtual = null;
    saveState();
    closeModal('modal-confirm');
    resetConfirmBtn();
    renderGanhos();
    renderGeral();
    toast('🗑 Instituição excluída!');
  };
  openModal('modal-confirm');
}

var _ganhoRecorrente = false;

function abrirModalGanho(id){
  finGarantirEstado();
  normalizarInstAtual();
  if(!state.instituicoes.length){
    toast('⚠️ Crie uma instituição antes de lançar uma entrada.');
    abrirModalInstituicao();
    return;
  }
  var g = id ? state.ganhos.find(function(x){ return x.id === id; }) : null;

  document.getElementById('ganho-modal-title').textContent = g ? 'Editar entrada' : 'Registrar entrada';
  document.getElementById('ganho-edit-id').value = g ? g.id : '';
  document.getElementById('ganho-valor').value = g ? g.valor : '';
  document.getElementById('ganho-fonte').value = g ? (g.fonte || '') : '';
  document.getElementById('ganho-data').value = g ? g.data : dataLocalISO();

  atualizarSelectInstituicoes(g ? g.instituicaoId : ganhoInstAtual);
  atualizarSugestoesFonte();

  _ganhoRecorrente = !!(g && g.recorrente);
  document.getElementById('ganho-rec-sw').className = 'toggle-switch' + (_ganhoRecorrente ? ' on' : '');
  document.getElementById('ganho-rec-wrap').style.display = _ganhoRecorrente ? 'block' : 'none';
  document.getElementById('ganho-rec-dia').value =
    (g && g.diaRecorrencia) ? g.diaRecorrencia : new Date((g ? g.data : dataLocalISO()) + 'T12:00:00').getDate();

  // Uma copia gerada pela recorrencia nao pode virar origem de outra: o
  // aviso explica por que o interruptor esta fora do ar nesse caso.
  var gerado = !!(g && g.origemId);
  document.getElementById('ganho-rec-toggle').style.display = gerado ? 'none' : '';
  document.getElementById('ganho-rec-aviso').style.display = gerado ? 'block' : 'none';

  openModal('modal-ganho');
}

function atualizarSelectInstituicoes(selecionada){
  var sel = document.getElementById('ganho-instituicao');
  if(!sel) return;
  sel.innerHTML = state.instituicoes.map(function(i){
    return '<option value="' + i.id + '"' + (i.id === selecionada ? ' selected' : '') + '>' + esc(i.nome) + '</option>';
  }).join('');
}

// As origens ja usadas viram sugestao — digitar "Salário" de novo com outra
// grafia criaria uma categoria a mais no historico sem querer.
function atualizarSugestoesFonte(){
  var dl = document.getElementById('ganho-fontes');
  if(!dl) return;
  var vistas = {};
  state.ganhos.forEach(function(g){
    var n = fonteNome(g);
    vistas[n.toLowerCase()] = n;
  });
  dl.innerHTML = Object.keys(vistas).map(function(k){
    return '<option value="' + esc(vistas[k]) + '"></option>';
  }).join('');
}

function toggleGanhoRecorrente(){
  _ganhoRecorrente = !_ganhoRecorrente;
  document.getElementById('ganho-rec-sw').className = 'toggle-switch' + (_ganhoRecorrente ? ' on' : '');
  document.getElementById('ganho-rec-wrap').style.display = _ganhoRecorrente ? 'block' : 'none';
}

function salvarGanho(){
  finGarantirEstado();
  var id = document.getElementById('ganho-edit-id').value;
  var valor = parseFloat(document.getElementById('ganho-valor').value);
  var fonte = document.getElementById('ganho-fonte').value.trim();
  var data = document.getElementById('ganho-data').value;
  var instId = document.getElementById('ganho-instituicao').value;

  if(!valor || valor <= 0){ toast('⚠️ Informe um valor válido.'); return; }
  if(!fonte){ toast('⚠️ Informe de onde veio essa entrada.'); return; }
  if(!data){ toast('⚠️ Informe a data.'); return; }
  if(!instId || !instituicaoPorId(instId)){ toast('⚠️ Escolha uma instituição.'); return; }

  var dia = parseInt(document.getElementById('ganho-rec-dia').value, 10);
  if(!dia || dia < 1 || dia > 31) dia = new Date(data + 'T12:00:00').getDate();

  if(id){
    var g = state.ganhos.find(function(x){ return x.id === id; });
    if(g){
      var eraRecorrente = !!g.recorrente;
      g.valor = valor; g.fonte = fonte; g.data = data; g.instituicaoId = instId;
      if(!g.origemId){
        g.recorrente = _ganhoRecorrente;
        g.diaRecorrencia = _ganhoRecorrente ? dia : null;
      }
      // Desligar a recorrencia nao deve apagar o que ja caiu na conta: os
      // meses passados aconteceram de verdade. So paramos de gerar os novos.
      if(eraRecorrente && !g.recorrente) toast('✏️ Entrada atualizada — não gera mais todo mês.');
      else toast('✏️ Entrada atualizada!');
    }
  } else {
    state.ganhos.push({
      id: uid(), instituicaoId: instId, valor: valor, fonte: fonte, data: data,
      recorrente: _ganhoRecorrente, diaRecorrencia: _ganhoRecorrente ? dia : null,
      origemId: null, mesRef: data.slice(0,7),
      createdAt: new Date().toISOString()
    });
    toast(_ganhoRecorrente ? '🔁 Entrada recorrente registrada!' : '💰 Entrada registrada!');
  }

  ganhoInstAtual = instId;
  materializarRecorrentes();
  saveState();
  closeModal('modal-ganho');
  renderGanhos();
  renderGeral();
}

function excluirGanho(id){
  var g = state.ganhos.find(function(x){ return x.id === id; });
  if(!g) return;
  document.getElementById('confirm-icon').textContent = '🗑';
  document.getElementById('confirm-title').textContent = 'Excluir entrada';
  document.getElementById('confirm-body').textContent = g.recorrente
    ? 'Esta é a entrada que se repete todo mês. Excluir para de gerar as próximas — as já lançadas continuam.'
    : 'Excluir esta entrada permanentemente?';
  document.getElementById('confirm-ok-btn').textContent = 'Excluir';
  document.getElementById('confirm-ok-btn').onclick = function(){
    // Uma copia gerada pela recorrencia voltaria no proximo desenho se
    // simplesmente sumisse: por isso o mes fica registrado como pulado.
    if(g.origemId) state.ganhosPulados[g.origemId + ':' + (g.mesRef || String(g.data||'').slice(0,7))] = true;
    state.ganhos = state.ganhos.filter(function(x){ return x.id !== id; });
    saveState();
    closeModal('modal-confirm');
    resetConfirmBtn();
    renderGanhos();
    renderGeral();
    toast('🗑 Entrada excluída!');
  };
  openModal('modal-confirm');
}

// Editar e excluir das linhas do historico.
document.addEventListener('click', function(e){
  var ed = e.target.closest('.ganho-edit-btn');
  if(ed){ abrirModalGanho(ed.dataset.id); return; }
  var del = e.target.closest('.ganho-del-btn');
  if(del){ excluirGanho(del.dataset.id); return; }
});

// ═══════════════════════════════════════════════════════════════════════
// GRAFICOS
// ═══════════════════════════════════════════════════════════════════════

// ─── BALAO DE INFORMACAO (mouse e dedo) ─────────────────────────────────
//
// Um unico balao para todos os graficos do app — pizza de gastos, pizzas
// da aba Geral, dashboard de ganhos e o grafico de dias da semana. Um so
// elemento no DOM, um so comportamento, uma so aparencia.
//
// No mouse ele acompanha o ponteiro e some ao sair. No dedo aparece ao
// tocar, acompanha o arrasto e fica legivel por um instante depois de
// soltar — sumir junto com o toque nao deixaria tempo de ler.

var _balao = null;
var _balaoTimer = null;

function balaoElemento(){
  if(_balao && document.body.contains(_balao)) return _balao;
  _balao = document.createElement('div');
  _balao.className = 'grafico-balao';
  _balao.setAttribute('role', 'status');
  _balao.setAttribute('aria-live', 'polite');
  document.body.appendChild(_balao);
  return _balao;
}

function balaoMostrar(html, x, y){
  var el = balaoElemento();
  clearTimeout(_balaoTimer);
  el.innerHTML = html;
  el.style.display = 'block';
  // Medir depois de preencher: so ai da para saber se cabe de um lado ou
  // do outro do ponteiro. Sem isto o balao sai da tela na borda direita e
  // no pe da pagina, que e justamente onde os graficos ficam no celular.
  var larg = el.offsetWidth, alt = el.offsetHeight;
  var esq = x + 16, topo = y - 14;
  if(esq + larg > window.innerWidth - 10) esq = x - larg - 16;
  if(esq < 10) esq = Math.max(10, (window.innerWidth - larg) / 2);
  if(topo + alt > window.innerHeight - 10) topo = y - alt - 16;
  if(topo < 10) topo = 10;
  el.style.left = Math.round(esq) + 'px';
  el.style.top = Math.round(topo) + 'px';
}

function balaoEsconder(atraso){
  clearTimeout(_balaoTimer);
  if(!_balao) return;
  if(atraso){ _balaoTimer = setTimeout(function(){ _balao.style.display = 'none'; }, atraso); }
  else _balao.style.display = 'none';
}

// Liga um canvas ao balao. `achar(x, y)` recebe a posicao em pixels de CSS
// dentro do canvas e devolve { html: '...', chave: '...' } ou null.
// A chave evita repintar e reposicionar a cada pixel de movimento.
var _balaoLimpezas = [];   // uma por canvas ligado, para o toque fora fechar tudo

function ligarBalao(canvas, achar, aoEntrar){
  if(!canvas || canvas._balaoLigado) return;
  canvas._balaoLigado = true;
  // pan-y: o dedo continua rolando a pagina na vertical, mas o arrasto
  // horizontal fica com o grafico. Sem isto o navegador engole o gesto e
  // nao ha como percorrer os dados com o dedo.
  canvas.style.touchAction = 'pan-y';

  var ultima = null;     // chave do ponto apontado agora
  var marcado = false;   // aoEntrar foi avisado e ainda nao foi desfeito
  var geracao = 0;       // cancela a limpeza adiada quando algo muda antes

  function marcar(achado){
    geracao++;
    marcado = !!achado;
    if(aoEntrar) aoEntrar(achado);
  }

  function posicao(ev){
    var rect = canvas.getBoundingClientRect();
    if(!rect.width || !rect.height) return null;
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function atualizar(ev){
    var pos = posicao(ev);
    var achado = pos ? achar(pos.x, pos.y) : null;
    if(!achado){
      if(ultima !== null){ ultima = null; if(aoEntrar) aoEntrar(null); }
      balaoEsconder();
      canvas.style.cursor = 'default';
      return false;
    }
    if(achado.chave !== ultima){
      ultima = achado.chave;
      marcar(achado);
    }
    balaoMostrar(achado.html, ev.clientX, ev.clientY);
    canvas.style.cursor = 'pointer';
    return true;
  }

  function limpar(atraso){
    balaoEsconder(atraso);
    canvas.style.cursor = 'default';
    ultima = null;
    if(!marcado) return;
    // No toque o balao fica um instante a mais para dar tempo de ler, e o
    // destaque no desenho tem de sair junto com ele, nao antes. A geracao
    // cancela essa limpeza adiada se algo for apontado nesse meio-tempo —
    // senao ela apagaria o destaque novo.
    if(!atraso){ marcar(null); return; }
    var minha = ++geracao;
    setTimeout(function(){ if(minha === geracao) marcar(null); }, atraso);
  }

  _balaoLimpezas.push(function(){ limpar(); });

  canvas.addEventListener('pointerdown', function(ev){
    if(atualizar(ev) && ev.pointerType !== 'mouse'){
      // Segurar o ponteiro mantem os eventos vindo mesmo se o dedo sair do
      // canvas, entao o arrasto nao trava na borda do grafico.
      try { canvas.setPointerCapture(ev.pointerId); } catch(e){}
    }
  });
  canvas.addEventListener('pointermove', function(ev){
    if(ev.pointerType === 'mouse' || ev.buttons || canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) atualizar(ev);
  });
  canvas.addEventListener('pointerup', function(ev){
    if(ev.pointerType === 'mouse') return;
    limpar(2200);   // tempo de ler antes de sumir
  });
  canvas.addEventListener('pointercancel', function(){ limpar(); });
  canvas.addEventListener('pointerleave', function(ev){
    if(ev.pointerType === 'mouse') limpar();
  });
}

// Tocar fora de qualquer grafico fecha o balao — no celular nao ha
// "sair com o ponteiro" para fecha-lo sozinho.
document.addEventListener('pointerdown', function(e){
  if(e.target && e.target.tagName === 'CANVAS') return;
  _balaoLimpezas.forEach(function(f){ f(); });
});

// ─── PIZZA ──────────────────────────────────────────────────────────────
//
// Desenhador de rosca generico, usado pelas pizzas da aba Geral e pelo
// dashboard de Ganhos. A geometria e as fatias ficam guardadas no proprio
// canvas, que e o que permite descobrir depois qual fatia esta sob o
// ponteiro. A pizza da aba Gastos (js/gastos.js) guarda o mesmo formato e
// usa este mesmo balao.

function conteudoBalaoFatia(f, total){
  var pct = total ? (f.valor / total * 100) : 0;
  return '<div class="balao-topo">'
      + '<span class="balao-dot" style="background:' + f.cor + '"></span>'
      + '<strong>' + esc(f.nome) + '</strong></div>'
    + '<div class="balao-valor">' + moeda(f.valor) + '</div>'
    + '<div class="balao-nota">' + pct.toFixed(1).replace('.', ',') + '% do total</div>';
}

function desenharPizza(canvas, fatias){
  if(!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W/2, cy = H/2, R = Math.min(W,H)/2 - 4, r = R * 0.62;
  ctx.clearRect(0,0,W,H);

  var total = fatias.reduce(function(s,f){ return s + f.valor; }, 0);
  canvas._pizza = { cx:cx, cy:cy, R:R, r:r, total:total, fatias:[] };

  if(!total || !fatias.length){
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.arc(cx,cy,r,0,Math.PI*2,true);
    ctx.fillStyle = 'rgba(128,128,128,0.16)';
    ctx.fill();
    ativarBalaoPizza(canvas);
    return;
  }

  var ini = -Math.PI/2;
  var GAP = 0.03;
  fatias.forEach(function(f){
    var angulo = (f.valor/total) * Math.PI*2;
    var fim = ini + angulo;
    // A fresta nunca pode passar de um terco da fatia: acima disso o inicio
    // ultrapassa o fim e o arco e desenhado pelo caminho longo, pintando o
    // anel inteiro de uma cor so. (Mesma armadilha ja corrigida em gastos.js.)
    var g = Math.min(GAP, angulo/3);
    ctx.beginPath();
    ctx.moveTo(cx + r*Math.cos(ini+g), cy + r*Math.sin(ini+g));
    ctx.arc(cx, cy, R, ini+g, fim-g);
    ctx.arc(cx, cy, r, fim-g, ini+g, true);
    ctx.closePath();
    ctx.fillStyle = f.cor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = corDoCartao();
    ctx.stroke();
    // A area sensivel e a fatia inteira, sem descontar a fresta: senao
    // haveria faixas mortas entre uma fatia e a vizinha.
    canvas._pizza.fatias.push({ a0: ini, a1: fim, nome: f.nome, valor: f.valor, cor: f.cor });
    ini = fim;
  });

  ativarBalaoPizza(canvas);
}

// Descobre a fatia sob o ponteiro. Vale para qualquer canvas que tenha
// guardado `_pizza` — o da aba Gastos inclusive.
function ativarBalaoPizza(canvas){
  ligarBalao(canvas, function(x, y){
    var p = canvas._pizza;
    if(!p || !p.fatias.length) return null;
    var rect = canvas.getBoundingClientRect();
    // O canvas e desenhado no tamanho do atributo e esticado pelo CSS:
    // sem converter, o acerto erra quanto menor for a tela.
    var px = x * (canvas.width / rect.width) - p.cx;
    var py = y * (canvas.height / rect.height) - p.cy;
    var dist = Math.sqrt(px*px + py*py);
    if(dist < p.r || dist > p.R) return null;

    var ang = Math.atan2(py, px);
    // As fatias comecam em -PI/2 e crescem; o atan2 volta a -PI depois de
    // PI. Normalizar para a mesma faixa evita o buraco no lado esquerdo.
    while(ang < -Math.PI/2) ang += Math.PI*2;
    while(ang > -Math.PI/2 + Math.PI*2) ang -= Math.PI*2;

    for(var i = 0; i < p.fatias.length; i++){
      var f = p.fatias[i];
      if(ang >= f.a0 && ang <= f.a1){
        return { chave: 'f' + i, html: conteudoBalaoFatia(f, p.total) };
      }
    }
    return null;
  });
}

function legendaHTML(fatias, fraseVazia){
  var total = fatias.reduce(function(s,f){ return s + f.valor; }, 0);
  if(!total || !fatias.length){
    return '<div class="fin-legenda-vazia">' + (fraseVazia || 'Sem dados ainda.') + '</div>';
  }
  return fatias.map(function(f){
    var pct = (f.valor/total*100);
    return '<div class="fin-legenda-item">'
      + '<span class="fin-legenda-dot" style="background:' + f.cor + '"></span>'
      + '<span class="fin-legenda-nome">' + esc(f.nome) + '</span>'
      + '<span class="fin-legenda-pct">' + pct.toFixed(1).replace('.',',') + '%</span>'
      + '<span class="fin-legenda-valor">' + moeda(f.valor) + '</span>'
    + '</div>';
  }).join('');
}

// Fatias a partir das entradas, agrupadas pela origem.
function fatiasPorFonte(lista, cores){
  cores = cores || mapaCoresFontes();
  var por = {};
  lista.forEach(function(g){
    var nome = fonteNome(g), k = nome.toLowerCase();
    if(!por[k]) por[k] = { nome: nome, valor: 0, cor: cores[k] || corParaTema(COR_OUTROS) };
    por[k].valor += parseFloat(g.valor) || 0;
  });
  return Object.keys(por).map(function(k){ return por[k]; })
    .sort(function(a,b){ return b.valor - a.valor; });
}

// Fatias a partir dos gastos, agrupadas pela categoria.
function fatiasPorCategoria(lista){
  var por = {};
  lista.forEach(function(g){
    var k = g.categoriaId || '__none__';
    if(!por[k]){
      var cat = getCat(k);
      por[k] = { nome: cat ? cat.nome : 'Sem categoria', valor: 0,
                 cor: cat ? corDaCategoria(cat) : corParaTema(COR_OUTROS) };
    }
    por[k].valor += parseFloat(g.valor) || 0;
  });
  return Object.keys(por).map(function(k){ return por[k]; })
    .sort(function(a,b){ return b.valor - a.valor; });
}

// ─── Grafico dos dias da semana ─────────────────────────────────────────
//
// Colunas empilhadas ou linhas, a escolha do usuario, com filtro por
// categoria e balao de informacao no dia apontado.
//
// O desenho esta separado do resto (desenharSemana) porque passar o
// ponteiro de um dia para o outro so precisa repintar o canvas: refazer os
// filtros a cada movimento piscaria a tela e perderia o foco do teclado.

var semanaModo = 'coluna';
var semanaOcultas = {};        // chave da categoria -> escondida do grafico
var _semanaDestaque = null;    // dia sob o ponteiro
var _semanaCache = null;       // dados e medidas do ultimo desenho

var DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
var DIAS_SEMANA_LONGO = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira',
                         'Quinta-feira','Sexta-feira','Sábado'];

function setSemanaModo(modo){
  semanaModo = modo;
  ['coluna','linha'].forEach(function(m){
    var b = document.getElementById('semana-modo-' + m);
    if(b) b.setAttribute('aria-pressed', m === modo ? 'true' : 'false');
  });
  renderGraficoSemana();
}

// Todas as categorias que aparecem em algum gasto, escondidas ou nao.
function dadosSemana(){
  var series = {};   // categoriaId -> {id, nome, cor, dias:[7]}
  (state.gastos||[]).forEach(function(g){
    if(!g.data) return;
    var d = new Date(g.data + 'T12:00:00');
    if(isNaN(d.getTime())) return;
    var k = g.categoriaId || '__none__';
    if(!series[k]){
      var cat = getCat(k);
      series[k] = { id: k,
                    nome: cat ? cat.nome : 'Sem categoria',
                    cor: cat ? corDaCategoria(cat) : corParaTema(COR_OUTROS),
                    dias: [0,0,0,0,0,0,0] };
    }
    series[k].dias[d.getDay()] += parseFloat(g.valor) || 0;
  });
  return Object.keys(series).map(function(k){ return series[k]; })
    .sort(function(a,b){
      var sa = a.dias.reduce(function(s,v){return s+v;},0);
      var sb = b.dias.reduce(function(s,v){return s+v;},0);
      return sb - sa;
    });
}

function toggleSemanaCategoria(id){
  if(semanaOcultas[id]) delete semanaOcultas[id];
  else semanaOcultas[id] = true;
  renderGraficoSemana();
}

function mostrarTodasSemana(){
  semanaOcultas = {};
  renderGraficoSemana();
}

// A legenda E o filtro: uma lista so, em vez de repetir as categorias em
// dois lugares. Clicar tira e devolve a categoria ao grafico.
function renderFiltrosSemana(series){
  var el = document.getElementById('semana-legenda');
  if(!el) return;
  if(!series.length){ el.innerHTML = ''; return; }

  var escondidas = series.filter(function(s){ return semanaOcultas[s.id]; }).length;
  el.innerHTML = '<span class="fin-filtros-rotulo">Mostrar:</span>'
    + series.map(function(s){
        var ativa = !semanaOcultas[s.id];
        return '<button type="button" class="fin-filtro-chip' + (ativa ? '' : ' off') + '" '
          + 'data-cat="' + esc(s.id) + '" aria-pressed="' + (ativa ? 'true' : 'false') + '">'
          + '<span class="fin-legenda-dot" style="background:' + s.cor + '"></span>'
          + esc(s.nome) + '</button>';
      }).join('')
    + (escondidas ? '<button type="button" class="fin-filtro-limpar" data-cat="__todas__">Mostrar todas</button>' : '');
}

document.addEventListener('click', function(e){
  var chip = e.target.closest('#semana-legenda [data-cat]');
  if(!chip) return;
  if(chip.dataset.cat === '__todas__') mostrarTodasSemana();
  else toggleSemanaCategoria(chip.dataset.cat);
});

function renderGraficoSemana(){
  var canvas = document.getElementById('grafico-semana');
  if(!canvas || !canvas.getContext) return;
  var caixa = canvas.parentNode;
  var largura = caixa ? caixa.clientWidth : 0;
  if(!largura) return;   // secao escondida: o proximo desenho pega a medida

  _semanaDestaque = null;
  balaoEsconder();

  var todas = dadosSemana();
  renderFiltrosSemana(todas);

  var series = todas.filter(function(s){ return !semanaOcultas[s.id]; });

  _semanaCache = {
    canvas: canvas,
    largura: largura,
    altura: 260,
    todas: todas,
    series: series,
    padE: 58, padD: 12, padT: 14, padB: 28
  };
  _semanaCache.larguraUtil = Math.max(10, largura - _semanaCache.padE - _semanaCache.padD);
  _semanaCache.alturaUtil  = Math.max(10, _semanaCache.altura - _semanaCache.padT - _semanaCache.padB);
  _semanaCache.passo = _semanaCache.larguraUtil / 7;

  // Teto do eixo: a soma do dia mais caro (colunas empilhadas) ou o maior
  // valor de uma categoria num dia (linhas). Usar o teto errado espremeria
  // o desenho contra o topo ou deixaria metade do quadro vazia. Ele leva em
  // conta so o que esta visivel, entao filtrar aproxima a escala dos dados.
  var maximo = 0;
  for(var d = 0; d < 7; d++){
    if(semanaModo === 'coluna'){
      var soma = series.reduce(function(s,se){ return s + se.dias[d]; }, 0);
      if(soma > maximo) maximo = soma;
    } else {
      series.forEach(function(se){ if(se.dias[d] > maximo) maximo = se.dias[d]; });
    }
  }
  _semanaCache.maximo = maximo > 0 ? maximo : 1;
  _semanaCache.vazio = !todas.length ? 'Nenhum gasto registrado ainda.'
                     : (!series.length ? 'Nenhuma categoria selecionada.' : null);

  desenharSemana();
  ativarBalaoSemana(canvas);
  canvas.setAttribute('aria-label', resumoSemanaTexto());
}

// Resumo em texto do que o grafico mostra, para leitor de tela.
function resumoSemanaTexto(){
  var c = _semanaCache;
  if(!c || c.vazio) return c && c.vazio ? c.vazio : 'Gastos por dia da semana.';
  var melhorDia = 0, melhorValor = -1;
  for(var d = 0; d < 7; d++){
    var soma = c.series.reduce(function(s,se){ return s + se.dias[d]; }, 0);
    if(soma > melhorValor){ melhorValor = soma; melhorDia = d; }
  }
  return 'Gastos por dia da semana, ' + c.series.length + ' categoria'
    + (c.series.length > 1 ? 's' : '') + ' selecionada' + (c.series.length > 1 ? 's' : '')
    + '. Maior gasto em ' + DIAS_SEMANA_LONGO[melhorDia].toLowerCase() + ': ' + moeda(melhorValor) + '.';
}

function desenharSemana(){
  var c = _semanaCache;
  if(!c) return;
  var canvas = c.canvas;
  var dpr = window.devicePixelRatio || 1;
  canvas.style.width = '100%';
  canvas.style.height = c.altura + 'px';
  canvas.width = Math.round(c.largura * dpr);
  canvas.height = Math.round(c.altura * dpr);
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.largura, c.altura);

  var estilo = getComputedStyle(document.documentElement);
  var corTexto = (estilo.getPropertyValue('--text-3') || '').trim() || 'rgba(235,227,167,0.62)';
  var corLinha = (estilo.getPropertyValue('--line') || '').trim() || 'rgba(235,227,167,0.10)';
  var corAcento = (estilo.getPropertyValue('--accent-soft') || '').trim() || 'rgba(235,125,0,0.15)';

  var padE = c.padE, padT = c.padT;
  var larguraUtil = c.larguraUtil, alturaUtil = c.alturaUtil, passo = c.passo;

  if(c.vazio){
    ctx.fillStyle = corTexto;
    ctx.font = '13px Poppins, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.vazio, c.largura/2, c.altura/2);
    return;
  }

  var series = c.series, maximo = c.maximo;

  // Faixa do dia apontado, por baixo de tudo.
  if(_semanaDestaque !== null){
    ctx.fillStyle = corAcento;
    ctx.fillRect(padE + passo*_semanaDestaque, padT, passo, alturaUtil);
  }

  // Grade e rotulos do eixo vertical.
  ctx.font = '10px Poppins, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for(var i = 0; i <= 3; i++){
    var v = maximo * i / 3;
    var y = padT + alturaUtil - (alturaUtil * i / 3);
    ctx.strokeStyle = corLinha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padE, y + 0.5);
    ctx.lineTo(padE + larguraUtil, y + 0.5);
    ctx.stroke();
    ctx.fillStyle = corTexto;
    ctx.fillText(moeda(v).replace(/[.,]00$/, ''), padE - 8, y);
  }

  // Rotulos dos dias.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for(var dd = 0; dd < 7; dd++){
    var apontado = _semanaDestaque === dd;
    ctx.font = (apontado ? '600 11px' : '11px') + ' Poppins, system-ui, sans-serif';
    ctx.fillStyle = apontado ? ((estilo.getPropertyValue('--text') || '').trim() || '#EBE3A7') : corTexto;
    ctx.fillText(DIAS_SEMANA[dd], padE + passo*dd + passo/2, padT + alturaUtil + 8);
  }

  if(semanaModo === 'coluna'){
    var largBarra = Math.min(54, passo * 0.62);
    for(var dia = 0; dia < 7; dia++){
      var base = padT + alturaUtil;
      var x = padE + passo*dia + (passo - largBarra)/2;
      series.forEach(function(se){
        var v2 = se.dias[dia];
        if(v2 <= 0) return;
        var h = (v2 / maximo) * alturaUtil;
        ctx.fillStyle = se.cor;
        ctx.fillRect(x, base - h, largBarra, h);
        base -= h;
      });
    }
  } else {
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    series.forEach(function(se){
      ctx.strokeStyle = se.cor;
      ctx.beginPath();
      for(var dia2 = 0; dia2 < 7; dia2++){
        var px = padE + passo*dia2 + passo/2;
        var py = padT + alturaUtil - (se.dias[dia2] / maximo) * alturaUtil;
        if(dia2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = se.cor;
      for(var dia3 = 0; dia3 < 7; dia3++){
        var cxp = padE + passo*dia3 + passo/2;
        var cyp = padT + alturaUtil - (se.dias[dia3] / maximo) * alturaUtil;
        ctx.beginPath();
        ctx.arc(cxp, cyp, _semanaDestaque === dia3 ? 5 : 3, 0, Math.PI*2);
        ctx.fill();
      }
    });
  }
}

// O balao mostra o dia inteiro, nao so a fatia sob o ponteiro: com colunas
// empilhadas as faixas finas sao impossiveis de acertar no dedo, e ver o
// dia completo e mais util do que ver um valor solto.
function conteudoBalaoDia(dia){
  var c = _semanaCache;
  var linhas = c.series.map(function(se){ return { nome: se.nome, cor: se.cor, valor: se.dias[dia] }; })
    .filter(function(l){ return l.valor > 0; })
    .sort(function(a,b){ return b.valor - a.valor; });
  var total = linhas.reduce(function(s,l){ return s + l.valor; }, 0);

  if(!linhas.length){
    return '<div class="balao-topo"><strong>' + DIAS_SEMANA_LONGO[dia] + '</strong></div>'
      + '<div class="balao-nota">Nenhum gasto neste dia.</div>';
  }
  return '<div class="balao-topo"><strong>' + DIAS_SEMANA_LONGO[dia] + '</strong></div>'
    + '<div class="balao-valor">' + moeda(total) + '</div>'
    + '<div class="balao-linhas">' + linhas.map(function(l){
        return '<div class="balao-linha">'
          + '<span class="balao-dot" style="background:' + l.cor + '"></span>'
          + '<span class="balao-linha-nome">' + esc(l.nome) + '</span>'
          + '<span class="balao-linha-valor">' + moeda(l.valor) + '</span>'
        + '</div>';
      }).join('') + '</div>';
}

function ativarBalaoSemana(canvas){
  ligarBalao(canvas, function(x, y){
    var c = _semanaCache;
    if(!c || c.vazio) return null;
    // As medidas do cache estao em pixels de CSS, e o canvas e esticado
    // para 100% da caixa: converter mantem o acerto certo em qualquer tela.
    var escala = c.largura / (canvas.getBoundingClientRect().width || c.largura);
    var cx = x * escala, cy = y * escala;
    if(cy < c.padT || cy > c.padT + c.alturaUtil) return null;
    if(cx < c.padE || cx > c.padE + c.larguraUtil) return null;
    var dia = Math.floor((cx - c.padE) / c.passo);
    if(dia < 0 || dia > 6) return null;
    return { chave: 'd' + dia, html: conteudoBalaoDia(dia) };
  }, function(achado){
    // Repinta so quando o dia muda — e o que mantem o movimento fluido.
    _semanaDestaque = achado ? parseInt(achado.chave.slice(1), 10) : null;
    desenharSemana();
  });
}

// Redesenhar ao girar o celular ou redimensionar a janela: o canvas guarda
// a largura em pixels, entao sem isto ele fica esticado ou cortado.
var _semanaTimer = null;
window.addEventListener('resize', function(){
  if(finAba !== 'geral') return;
  clearTimeout(_semanaTimer);
  _semanaTimer = setTimeout(renderGraficoSemana, 180);
});

// ═══════════════════════════════════════════════════════════════════════
// ABA GERAL
// ═══════════════════════════════════════════════════════════════════════

function ordenarPorData(lista){
  return lista.slice().sort(function(a,b){
    var c = String(b.data||'').localeCompare(String(a.data||''));
    if(c !== 0) return c;
    return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
  });
}

function dataBR(iso){
  if(!iso) return '—';
  var d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function renderGeral(){
  var raiz = document.getElementById('fin-aba-geral');
  if(!raiz) return;
  finGarantirEstado();

  var entradas = totalGanhos();
  var saidas = totalGastos();
  var saldo = entradas - saidas;

  var elSaldo = document.getElementById('geral-saldo');
  if(elSaldo){
    elSaldo.textContent = moeda(saldo);
    elSaldo.classList.toggle('negativo', saldo < 0);
  }
  var elDet = document.getElementById('geral-saldo-detalhe');
  if(elDet){
    elDet.innerHTML = '<span class="geral-pos">+ ' + moeda(entradas) + ' em entradas</span>'
      + '<span class="geral-sep">•</span>'
      + '<span class="geral-neg">− ' + moeda(saidas) + ' em gastos</span>';
  }

  renderGeralUltimosGastos();
  renderGeralUltimasEntradas();
  renderGeralPizzas();
  renderGeralMedias();
  renderGraficoSemana();
}

function renderGeralUltimosGastos(){
  var el = document.getElementById('geral-ultimos-gastos');
  if(!el) return;
  var lista = ordenarPorData(state.gastos).slice(0,3);
  if(!lista.length){
    el.innerHTML = '<div class="fin-mini-vazio">Nenhum gasto registrado ainda.</div>';
    return;
  }
  el.innerHTML = lista.map(function(g){
    var cat = getCat(g.categoriaId);
    var cor = cat ? corDaCategoria(cat) : corParaTema(COR_OUTROS);
    var pag = getPagamento(g.pagamento);
    return '<div class="fin-mini-item">'
      + '<span class="fin-mini-dot" style="background:' + cor + '"></span>'
      + '<div class="fin-mini-info">'
        + '<div class="fin-mini-nome">' + esc(g.desc) + '</div>'
        + '<div class="fin-mini-meta">' + esc(cat ? cat.nome : 'Sem categoria') + ' • ' + dataBR(g.data)
          + (pag ? ' • ' + pag.emoji + ' ' + esc(pag.nome) : '') + '</div>'
      + '</div>'
      + '<div class="fin-mini-valor negativo">− ' + moeda(parseFloat(g.valor)||0) + '</div>'
    + '</div>';
  }).join('');
}

function renderGeralUltimasEntradas(){
  var el = document.getElementById('geral-ultimas-entradas');
  if(!el) return;
  var lista = ordenarPorData(state.ganhos).slice(0,5);
  if(!lista.length){
    el.innerHTML = '<div class="fin-mini-vazio">Nenhuma entrada registrada ainda.</div>';
    return;
  }
  var cores = mapaCoresFontes();
  el.innerHTML = lista.map(function(g){
    var inst = instituicaoPorId(g.instituicaoId);
    var nome = fonteNome(g);
    return '<div class="fin-mini-item">'
      + '<span class="fin-mini-dot" style="background:' + (cores[nome.toLowerCase()] || corParaTema(COR_OUTROS)) + '"></span>'
      + '<div class="fin-mini-info">'
        + '<div class="fin-mini-nome">' + esc(nome) + '</div>'
        + '<div class="fin-mini-meta">' + esc(inst ? inst.nome : 'Sem instituição') + ' • ' + dataBR(g.data) + '</div>'
      + '</div>'
      + '<div class="fin-mini-valor positivo">+ ' + moeda(parseFloat(g.valor)||0) + '</div>'
    + '</div>';
  }).join('');
}

function renderGeralPizzas(){
  var fg = fatiasPorCategoria(state.gastos);
  desenharPizza(document.getElementById('pizza-geral-gastos'), fg);
  var lg = document.getElementById('legenda-geral-gastos');
  if(lg) lg.innerHTML = legendaHTML(fg, 'Nenhum gasto registrado ainda.');

  var fe = fatiasPorFonte(state.ganhos);
  desenharPizza(document.getElementById('pizza-geral-entradas'), fe);
  var le = document.getElementById('legenda-geral-entradas');
  if(le) le.innerHTML = legendaHTML(fe, 'Nenhuma entrada registrada ainda.');

  // Investimentos ainda nao existem como modulo: a rosca fica vazia de
  // proposito, com o aviso do lado.
  desenharPizza(document.getElementById('pizza-geral-investimentos'), []);
}

// Medias: a geral da aba e a de cada classificacao dentro dela.
function mediasHTML(grupos, totalGeral, qtdGeral, fraseVazia){
  if(!qtdGeral) return '<div class="fin-legenda-vazia">' + fraseVazia + '</div>';
  var linhas = grupos.sort(function(a,b){ return b.media - a.media; }).map(function(g){
    return '<div class="fin-media-item">'
      + '<span class="fin-legenda-dot" style="background:' + g.cor + '"></span>'
      + '<span class="fin-media-nome">' + esc(g.nome) + '</span>'
      + '<span class="fin-media-qtd">' + g.qtd + 'x</span>'
      + '<span class="fin-media-valor">' + moeda(g.media) + '</span>'
    + '</div>';
  }).join('');
  return '<div class="fin-media-geral">'
      + '<span>Média por lançamento</span>'
      + '<strong>' + moeda(totalGeral/qtdGeral) + '</strong>'
    + '</div>' + linhas;
}

function renderGeralMedias(){
  var elG = document.getElementById('geral-medias-gastos');
  if(elG){
    var porCat = {};
    state.gastos.forEach(function(g){
      var k = g.categoriaId || '__none__';
      if(!porCat[k]){
        var cat = getCat(k);
        porCat[k] = { nome: cat ? cat.nome : 'Sem categoria', total: 0, qtd: 0,
                      cor: cat ? corDaCategoria(cat) : corParaTema(COR_OUTROS) };
      }
      porCat[k].total += parseFloat(g.valor) || 0;
      porCat[k].qtd++;
    });
    var gruposG = Object.keys(porCat).map(function(k){
      var c = porCat[k];
      return { nome: c.nome, cor: c.cor, qtd: c.qtd, media: c.total / c.qtd };
    });
    elG.innerHTML = mediasHTML(gruposG, totalGastos(), state.gastos.length, 'Nenhum gasto registrado ainda.');
  }

  var elE = document.getElementById('geral-medias-entradas');
  if(elE){
    var cores = mapaCoresFontes();
    var porFonte = {};
    state.ganhos.forEach(function(g){
      var nome = fonteNome(g), k = nome.toLowerCase();
      if(!porFonte[k]) porFonte[k] = { nome: nome, total: 0, qtd: 0, cor: cores[k] || corParaTema(COR_OUTROS) };
      porFonte[k].total += parseFloat(g.valor) || 0;
      porFonte[k].qtd++;
    });
    var gruposE = Object.keys(porFonte).map(function(k){
      var f = porFonte[k];
      return { nome: f.nome, cor: f.cor, qtd: f.qtd, media: f.total / f.qtd };
    });
    elE.innerHTML = mediasHTML(gruposE, totalGanhos(), state.ganhos.length, 'Nenhuma entrada registrada ainda.');
  }
}
