// QUADRO — a aba "Quadro" do grupo Rotina: uma tela montada pela pessoa,
// bloco a bloco (plano de estudos, lista da semana, post-its, rotina e
// gastos).
//
// FORMATO
//   state.quadro = [{ id, tipo, ordem, ...campos do tipo }]
//     estudos  — sem campos: desenha state.planoEstudos (estudos-plano.js).
//     semana   — itens: [{ id, data, texto, feito }]
//     postits  — notas: [{ id, texto, cor }]
//     rotina   — auto (bool), habitos: [{ id, nome, dias: { 'aaaa-mm-dd': 1 } }]
//     gastos   — periodo ('semana'|'mes'), mostrar ('categorias'|'total'|'ultimos')
//
// Os blocos de DADOS (gastos, plano, rotina automatica) nao guardam copia
// de nada: leem na hora o que esta nas outras abas. Mudou la, muda aqui, e
// nao existem duas versoes do mesmo numero.
//
// state.quadro esta em COLECOES (sync.js): blocos editados em aparelhos
// diferentes se juntam bloco a bloco.
//
// SEGURANCA: o estado e validado ao ler (tipos, tamanhos, ids no formato
// de uid). Texto da pessoa so entra na tela por esc() e nunca dentro de
// onclick — os botoes levam apenas ids validados e numeros.

var QUADRO_MAX = 12;
var QUADRO_TIPOS = {
  estudos: { nome: 'Plano de estudos', desc: 'Matéria por dia. O Ticolino avisa e o timer conta sozinho.', area: 'a-estudos', icone: 'estudos', unico: true },
  semana:  { nome: 'Lista da semana', desc: 'Um dia embaixo do outro, com checks.', area: 'a-tarefas', icone: 'agenda' },
  postits: { nome: 'Post-its', desc: 'Lembretes soltos, na cor que quiser.', area: 'a-metas', icone: 'file' },
  rotina:  { nome: 'Rotina da semana', desc: 'Hábitos com um quadradinho por dia, e o que o app já registra.', area: 'a-exercicio', icone: 'check', unico: true },
  gastos:  { nome: 'Gastos', desc: 'Total e categorias, direto da aba Dinheiro.', area: 'a-dinheiro', icone: 'gastos', dados: true }
};
var QUADRO_ORDEM_TIPOS = ['estudos', 'semana', 'postits', 'rotina', 'gastos'];
var POSTIT_CORES = ['laranja', 'amarelo', 'azul', 'verde', 'rosa'];
var POSTIT_NOMES = { laranja: 'Laranja', amarelo: 'Amarelo', azul: 'Azul', verde: 'Verde', rosa: 'Rosa' };
var SEMANA_ITENS_MAX = 200, SEMANA_TEXTO_MAX = 120;
var POSTITS_MAX = 12, POSTIT_TEXTO_MAX = 200;
var HABITOS_MAX = 8, HABITO_NOME_MAX = 40;

var quadroOrganizando = false;

function quadroVisivel(){
  var p = document.getElementById('page-quadro');
  return !!(p && p.classList.contains('active'));
}

// ─── Validacao ───────────────────────────────────────────────────────────
var _quadroRef = null;

function blocoValido(b, i){
  if(!b || typeof b !== 'object' || !QUADRO_TIPOS[b.tipo]) return null;
  var o = { id: idSeguro(b.id), tipo: b.tipo, ordem: isFinite(b.ordem) ? Number(b.ordem) : i };
  var corte = isoDe(new Date(Date.now() - 70 * 86400000));
  if(b.tipo === 'semana'){
    o.itens = (Array.isArray(b.itens) ? b.itens : []).map(function(it){
      if(!it || !isoValido(it.data) || it.data < corte) return null;
      var texto = textoLimpo(it.texto, SEMANA_TEXTO_MAX);
      return texto ? { id: idSeguro(it.id), data: it.data, texto: texto, feito: !!it.feito } : null;
    }).filter(Boolean).slice(-SEMANA_ITENS_MAX);
  } else if(b.tipo === 'postits'){
    o.notas = (Array.isArray(b.notas) ? b.notas : []).map(function(n){
      var texto = n && textoLimpo(n.texto, POSTIT_TEXTO_MAX);
      return texto ? { id: idSeguro(n.id), texto: texto, cor: POSTIT_CORES.indexOf(n.cor) >= 0 ? n.cor : 'laranja' } : null;
    }).filter(Boolean).slice(0, POSTITS_MAX);
  } else if(b.tipo === 'rotina'){
    o.auto = b.auto !== false;
    o.habitos = (Array.isArray(b.habitos) ? b.habitos : []).map(function(h){
      var nome = h && textoLimpo(h.nome, HABITO_NOME_MAX);
      if(!nome) return null;
      var dias = {};
      if(h.dias && typeof h.dias === 'object') Object.keys(h.dias).forEach(function(d){ if(isoValido(d) && d >= corte && h.dias[d]) dias[d] = 1; });
      return { id: idSeguro(h.id), nome: nome, dias: dias };
    }).filter(Boolean).slice(0, HABITOS_MAX);
  } else if(b.tipo === 'gastos'){
    o.periodo = b.periodo === 'mes' ? 'mes' : 'semana';
    o.mostrar = ['categorias', 'total', 'ultimos'].indexOf(b.mostrar) >= 0 ? b.mostrar : 'categorias';
  }
  if(typeof b._upd === 'string') o._upd = b._upd;
  return o;
}

function garantirQuadro(){
  if(state.quadro && state.quadro === _quadroRef) return _quadroRef;
  var vistos = {}, unicos = {}, lista = [];
  (Array.isArray(state.quadro) ? state.quadro : []).forEach(function(b, i){
    var o = blocoValido(b, i);
    if(!o) return;
    if(QUADRO_TIPOS[o.tipo].unico){ if(unicos[o.tipo]) return; unicos[o.tipo] = 1; }
    if(vistos[o.id]) o.id = uid();
    vistos[o.id] = 1;
    lista.push(o);
  });
  lista.sort(function(a, b){ return a.ordem - b.ordem; });
  state.quadro = _quadroRef = lista.slice(0, QUADRO_MAX);
  return _quadroRef;
}

function blocoPorId(id){
  var l = garantirQuadro();
  for(var i = 0; i < l.length; i++) if(l[i].id === id) return l[i];
  return null;
}
function blocoDoTipo(tipo){
  var l = garantirQuadro();
  for(var i = 0; i < l.length; i++) if(l[i].tipo === tipo) return l[i];
  return null;
}

function novoBloco(tipo){
  var b = { id: uid(), tipo: tipo, ordem: 0 };
  if(tipo === 'semana') b.itens = [];
  if(tipo === 'postits') b.notas = [];
  if(tipo === 'rotina'){ b.auto = true; b.habitos = []; }
  if(tipo === 'gastos'){ b.periodo = 'semana'; b.mostrar = 'categorias'; }
  return b;
}

// Coloca no fim (ou no comeco) e renumera a ordem.
function inserirBloco(b, noComeco){
  var l = garantirQuadro();
  if(noComeco) l.unshift(b); else l.push(b);
  l.forEach(function(x, i){ x.ordem = i; });
  return b;
}

function garantirBlocoEstudos(){
  if(blocoDoTipo('estudos')) return false;
  if(garantirQuadro().length >= QUADRO_MAX) return false;
  inserirBloco(novoBloco('estudos'), true);
  saveState();
  return true;
}

// ─── Numeros da semana (cabecalho e cartao da Home) ──────────────────────
function itensDaSemana(b){
  var de = dataDaSemana(0), ate = dataDaSemana(6);
  return (b.itens || []).filter(function(it){ return it.data >= de && it.data <= ate; });
}

function resumoQuadroSemana(){
  var plano = resumoDaSemana(), feitos = plano.ok, total = plano.metas;
  garantirQuadro().forEach(function(b){
    if(b.tipo !== 'semana') return;
    itensDaSemana(b).forEach(function(it){ total++; if(it.feito) feitos++; });
  });
  return { feitos: feitos, total: total };
}

// Por dia da semana atual: ha algo planejado? esta tudo feito?
function estadoDosDias(){
  var dias = [];
  for(var d = 0; d < 7; d++){
    var iso = dataDaSemana(d), total = 0, feitos = 0;
    resumoDoDia(d).forEach(function(g){ total++; if(g.ok) feitos++; });
    garantirQuadro().forEach(function(b){
      if(b.tipo !== 'semana') return;
      b.itens.forEach(function(it){ if(it.data === iso){ total++; if(it.feito) feitos++; } });
    });
    dias.push({ total: total, feitos: feitos });
  }
  return dias;
}

// ─── Pintura da pagina ───────────────────────────────────────────────────
function renderQuadro(){
  var box = document.getElementById('qd-blocos');
  if(!box) return;
  var blocos = garantirQuadro();
  var r = resumoQuadroSemana();

  var hero = document.getElementById('qd-hero');
  hero.textContent = r.total ? r.feitos + ' de ' + r.total : 'Sua semana';
  // Numero e herói de 40px; frase vai menor, senao quebra em duas linhas.
  hero.classList.toggle('qd-hero-txt', !r.total);
  document.getElementById('qd-sub').textContent = r.total
    ? 'itens da semana feitos · ' + plural(blocos.length, 'bloco', 'blocos')
    : (blocos.length ? 'Nada planejado ainda para esta semana.' : 'Escolha os blocos da sua semana.');
  var tico = document.getElementById('qd-tico');
  if(tico) tico.innerHTML = ticolino(r.total && r.feitos * 2 >= r.total ? 'orgulhoso' : 'focado', 96);

  var org = document.getElementById('qd-organizar');
  if(org){
    org.hidden = !blocos.length;
    org.setAttribute('aria-pressed', quadroOrganizando ? 'true' : 'false');
    org.innerHTML = quadroOrganizando ? ico('check', 18, 2.6) + 'Pronto' : ico('edit', 18, 2) + 'Organizar';
  }
  document.getElementById('page-quadro').classList.toggle('qd-org', quadroOrganizando);

  if(!blocos.length){
    box.innerHTML = '<div class="md-vazio qd-vazio">'
      + '<p>Seu quadro está vazio. O modelo <b>Semana de estudos</b> já vem com plano de estudos, lista da semana e rotina. Ou escolha os blocos um a um.</p>'
      + '<button type="button" class="md-btn md-btn--primary" onclick="aplicarModeloSemana()">' + ico('estudos', 18, 2.2) + 'Usar o modelo</button>'
      + '<button type="button" class="md-btn md-btn--secondary" onclick="abrirAdicionarBloco()">' + ico('plus', 18, 2.4) + 'Escolher blocos</button>'
      + '</div>';
    return;
  }

  _materiasNaTela = [];
  box.innerHTML = blocos.map(function(b, i){ return htmlBloco(b, i, blocos.length); }).join('')
    + (blocos.length < QUADRO_MAX
      ? '<button type="button" class="qd-add" onclick="abrirAdicionarBloco()">' + ico('plus', 18, 2.6) + 'Adicionar bloco</button>'
      : '<p class="md-meta qd-cheio">O quadro tem espaço para ' + QUADRO_MAX + ' blocos.</p>');
}

function htmlBloco(b, i, n){
  var t = QUADRO_TIPOS[b.tipo];
  var acoes;
  if(quadroOrganizando){
    acoes = '<div class="qd-org-bts">'
      + '<button type="button" class="qd-ic" onclick="moverBloco(\'' + b.id + '\',-1)"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir ' + t.nome + '">' + seta('cima') + '</button>'
      + '<button type="button" class="qd-ic" onclick="moverBloco(\'' + b.id + '\',1)"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Descer ' + t.nome + '">' + seta('baixo') + '</button>'
      + '<button type="button" class="qd-ic qd-ic--perigo" onclick="pedirRemoverBloco(\'' + b.id + '\')" aria-label="Tirar ' + t.nome + ' do quadro">' + ico('trash', 18, 2) + '</button>'
      + '</div>';
  } else {
    acoes = acaoDoBloco(b);
  }
  var corpo = '';
  if(b.tipo === 'estudos') corpo = htmlPlanoSemana('quadro');
  else if(b.tipo === 'semana') corpo = htmlSemana(b);
  else if(b.tipo === 'postits') corpo = htmlPostits(b);
  else if(b.tipo === 'rotina') corpo = htmlRotina(b);
  else if(b.tipo === 'gastos') corpo = htmlGastos(b);
  return '<section class="qd-blk qd-blk--' + b.tipo + ' ' + t.area + '" aria-label="' + t.nome + '">'
    + '<div class="qd-blk-h"><span class="md-tile md-tile--sm ' + t.area + '">' + ico(t.icone, 18, 2.2) + '</span>'
    + '<h2>' + tituloDoBloco(b) + '</h2>' + acoes + '</div>'
    + '<div class="qd-blk-c">' + corpo + '</div></section>';
}

function tituloDoBloco(b){
  if(b.tipo === 'gastos') return b.periodo === 'mes' ? 'Gastos do mês' : 'Gastos da semana';
  return QUADRO_TIPOS[b.tipo].nome;
}

function acaoDoBloco(b){
  if(b.tipo === 'estudos') return '<button type="button" class="md-link-bt" onclick="abrirEditorPlano(' + idxHoje() + ')">Editar</button>';
  if(b.tipo === 'semana') return '<button type="button" class="qd-ic" onclick="abrirTextoQuadro(\'semana\',\'' + b.id + '\')" aria-label="Adicionar item na lista">' + ico('plus', 18, 2.6) + '</button>';
  if(b.tipo === 'postits') return '<button type="button" class="qd-ic" onclick="abrirTextoQuadro(\'postit\',\'' + b.id + '\')" aria-label="Novo post-it">' + ico('plus', 18, 2.6) + '</button>';
  if(b.tipo === 'rotina') return '<button type="button" class="qd-ic" onclick="abrirTextoQuadro(\'habito\',\'' + b.id + '\')" aria-label="Novo hábito">' + ico('plus', 18, 2.6) + '</button>';
  if(b.tipo === 'gastos') return '<button type="button" class="qd-ic" onclick="abrirConfigGastos(\'' + b.id + '\')" aria-label="Escolher o que o bloco de gastos mostra">' + ico('settings', 18, 2) + '</button>';
  return '';
}

function seta(lado){
  var d = lado === 'cima' ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
  return '<svg class="md-ico" viewBox="0 0 24 24" width="18" height="18" stroke-width="2.6" aria-hidden="true">' + d + '</svg>';
}

// ─── Bloco: lista da semana ──────────────────────────────────────────────
function htmlSemana(b){
  var ih = idxHoje(), hoje = hojeStr(), h = '<div class="sm-dias">';
  for(var d = 0; d < 7; d++){
    var iso = dataDaSemana(d);
    var itens = b.itens.filter(function(it){ return it.data === iso; });
    var feitos = itens.filter(function(it){ return it.feito; }).length;
    var dt = new Date(iso + 'T12:00:00');
    h += '<div class="sm-dia' + (d === ih ? ' hoje' : '') + (iso < hoje ? ' passado' : '') + '">'
      + '<div class="sm-dia-h"><b>' + DIAS_SEMANA[d] + (d === ih ? ' · hoje' : '') + '</b><span class="md-meta">' + dt.getDate() + '/' + pad(dt.getMonth() + 1) + '</span>'
      + (itens.length ? '<span class="md-meta sm-conta">' + feitos + ' de ' + itens.length + '</span>' : '')
      + '<button type="button" class="qd-ic qd-ic--sm" onclick="abrirTextoQuadro(\'semana\',\'' + b.id + '\',null,' + d + ')" aria-label="Adicionar em ' + DIAS_SEMANA[d].toLowerCase() + '">' + ico('plus', 16, 2.6) + '</button></div>';
    if(itens.length){
      h += '<ul class="sm-itens">' + itens.map(function(it){
        return '<li class="sm-it' + (it.feito ? ' feito' : '') + '">'
          + '<button type="button" class="md-check md-check--sm' + (it.feito ? ' md-check--on' : '') + '" role="switch" aria-checked="' + it.feito + '"'
          + ' onclick="alternarItemSemana(\'' + b.id + '\',\'' + it.id + '\')" aria-label="' + esc(it.texto) + '">' + ico('check', 16, 3) + '</button>'
          + '<span class="sm-txt">' + esc(it.texto) + '</span>'
          + '<button type="button" class="qd-ic qd-ic--sm sm-tirar" onclick="tirarItemSemana(\'' + b.id + '\',\'' + it.id + '\')" aria-label="Apagar ' + esc(it.texto) + '">' + ico('close', 14, 2.6) + '</button>'
          + '</li>';
      }).join('') + '</ul>';
    }
    h += '</div>';
  }
  return h + '</div>';
}

function alternarItemSemana(bid, iid){
  var b = blocoPorId(bid); if(!b) return;
  var it = b.itens.find(function(x){ return x.id === iid; }); if(!it) return;
  it.feito = !it.feito;
  saveState();
  renderQuadro();
}
function tirarItemSemana(bid, iid){
  var b = blocoPorId(bid); if(!b) return;
  b.itens = b.itens.filter(function(x){ return x.id !== iid; });
  saveState();
  renderQuadro();
}

// ─── Bloco: post-its ─────────────────────────────────────────────────────
function htmlPostits(b){
  if(!b.notas.length){
    return '<button type="button" class="pt-vazio" onclick="abrirTextoQuadro(\'postit\',\'' + b.id + '\')">' + ico('plus', 18, 2.6) + 'Escrever o primeiro post-it</button>';
  }
  return '<div class="pt-grade">' + b.notas.map(function(n, i){
    return '<button type="button" class="pt pt--' + n.cor + '" style="--giro:' + ((i % 3) - 1) * 1.3 + 'deg"'
      + ' onclick="abrirTextoQuadro(\'postit\',\'' + b.id + '\',\'' + n.id + '\')" aria-label="Post-it: ' + esc(n.texto) + '. Toque para editar">'
      + '<span>' + esc(n.texto) + '</span></button>';
  }).join('') + '</div>';
}

// ─── Bloco: rotina da semana ─────────────────────────────────────────────
// O que o app ja sabe sozinho, dia a dia. Nada aqui e guardado: cada
// quadradinho e lido das abas de origem na hora de pintar.
var ROTINA_AUTO = [
  { chave: 'estudo',    nome: 'Estudou' },
  { chave: 'leitura',   nome: 'Leu' },
  { chave: 'grana',     nome: 'Lançou gastos' },
  { chave: 'exercicio', nome: 'Treinou' }
];
function fezNoDia(chave, iso){
  var d = (typeof garantirDiario === 'function' && iso === hojeStr()) ? garantirDiario() : null;
  if(d && d[chave]) return true;
  if(chave === 'estudo'){
    var h = state.historico && state.historico[iso];
    if(h && h.e > 0) return true;
    return garantirSessoes().some(function(s){ return s.data === iso && (s.min + s.manual) > 0; });
  }
  if(chave === 'leitura'){
    return (state.livros || []).some(function(l){
      return (l.logLeitura || []).some(function(r){ var t = new Date(r.data); return !isNaN(t) && isoDe(t) === iso; });
    });
  }
  if(chave === 'grana') return (state.gastos || []).some(function(g){ return g.data === iso; });
  if(chave === 'exercicio') return typeof exTemTreino === 'function' && exTemTreino(iso);
  return false;
}

function htmlRotina(b){
  var hoje = hojeStr(), ih = idxHoje(), dias = [];
  for(var d = 0; d < 7; d++) dias.push(dataDaSemana(d));
  var h = '<div class="rt" role="table" aria-label="Rotina da semana"><div class="rt-l rt-cab" role="row"><span role="columnheader"></span>';
  dias.forEach(function(iso, i){ h += '<span class="rt-dd' + (i === ih ? ' hoje' : '') + '" role="columnheader">' + DIAS_LETRA[i] + '</span>'; });
  h += '</div>';
  if(b.auto){
    ROTINA_AUTO.forEach(function(a){
      h += '<div class="rt-l" role="row"><span class="rt-n rt-n--auto" role="rowheader">' + a.nome + '</span>';
      dias.forEach(function(iso, i){
        var on = iso <= hoje && fezNoDia(a.chave, iso);
        h += '<span role="cell" class="rt-q' + (on ? ' on' : '') + (i === ih ? ' hoje' : '') + (iso > hoje ? ' futuro' : '') + '" aria-label="' + a.nome + ', ' + DIAS_SEMANA[i] + ': ' + (on ? 'sim' : 'não') + '"></span>';
      });
      h += '</div>';
    });
  }
  b.habitos.forEach(function(hb){
    h += '<div class="rt-l" role="row"><span class="rt-n" role="rowheader">'
      + '<button type="button" class="qd-ic qd-ic--sm rt-tirar" onclick="pedirRemoverHabito(\'' + b.id + '\',\'' + hb.id + '\')" aria-label="Apagar o hábito ' + esc(hb.nome) + '">' + ico('close', 14, 2.6) + '</button>'
      + '<span class="rt-n-txt">' + esc(hb.nome) + '</span></span>';
    dias.forEach(function(iso, i){
      var on = !!hb.dias[iso];
      if(iso > hoje){
        h += '<span role="cell" class="rt-q futuro" aria-label="' + esc(hb.nome) + ', ' + DIAS_SEMANA[i] + ': ainda não chegou"></span>';
      } else {
        h += '<span role="cell"><button type="button" class="rt-q rt-q--bt' + (on ? ' on' : '') + (i === ih ? ' hoje' : '') + '" role="switch" aria-checked="' + on + '"'
          + ' onclick="alternarHabito(\'' + b.id + '\',\'' + hb.id + '\',' + i + ')" aria-label="' + esc(hb.nome) + ', ' + DIAS_SEMANA[i] + '"></button></span>';
      }
    });
    h += '</div>';
  });
  h += '</div>';
  if(!b.auto && !b.habitos.length) h += '<p class="md-meta">Toque no + para criar um hábito.</p>';
  h += '<label class="rt-auto"><input type="checkbox"' + (b.auto ? ' checked' : '') + ' onchange="alternarRotinaAuto(\'' + b.id + '\',this.checked)"> Mostrar o que o app já registra (estudo, leitura, gastos e treino)</label>';
  return h;
}

function alternarHabito(bid, hid, idx){
  var b = blocoPorId(bid); if(!b) return;
  var hb = b.habitos.find(function(x){ return x.id === hid; }); if(!hb) return;
  var iso = dataDaSemana(idx);
  if(iso > hojeStr()) return;
  if(hb.dias[iso]) delete hb.dias[iso]; else hb.dias[iso] = 1;
  saveState();
  renderQuadro();
}
function alternarRotinaAuto(bid, ligado){
  var b = blocoPorId(bid); if(!b) return;
  b.auto = !!ligado;
  saveState();
  renderQuadro();
}
function pedirRemoverHabito(bid, hid){
  var b = blocoPorId(bid); if(!b) return;
  var hb = b.habitos.find(function(x){ return x.id === hid; }); if(!hb) return;
  confirmarAcao('Apagar hábito', 'Apagar "' + hb.nome + '" e as marcações dele?', 'Apagar', function(){
    b.habitos = b.habitos.filter(function(x){ return x.id !== hid; });
    saveState();
    renderQuadro();
  });
}

// ─── Bloco: gastos ───────────────────────────────────────────────────────
function gastosDoBloco(b){
  var de, ate;
  if(b.periodo === 'mes'){
    var h = new Date();
    de = isoDe(new Date(h.getFullYear(), h.getMonth(), 1, 12));
    ate = isoDe(new Date(h.getFullYear(), h.getMonth() + 1, 0, 12));
  } else {
    de = dataDaSemana(0); ate = dataDaSemana(6);
  }
  return (state.gastos || []).filter(function(g){
    return g && isoValido(g.data) && g.data >= de && g.data <= ate && isFinite(parseFloat(g.valor));
  });
}

function htmlGastos(b){
  var lista = gastosDoBloco(b);
  var total = lista.reduce(function(s, g){ return s + (parseFloat(g.valor) || 0); }, 0);
  var h = '<span class="gb-total md-num">' + moeda(total) + '</span>';
  if(!lista.length){
    h += '<p class="md-meta">Nenhum gasto ' + (b.periodo === 'mes' ? 'neste mês' : 'nesta semana') + '.</p>';
  } else if(b.mostrar === 'categorias'){
    var por = {}, ordem = [];
    lista.forEach(function(g){
      var c = (typeof getCat === 'function') ? getCat(g.categoriaId) : null;
      var k = c ? c.id : '__sem__';
      if(!por[k]){ por[k] = { nome: c ? c.nome : 'Sem categoria', valor: 0 }; ordem.push(k); }
      por[k].valor += parseFloat(g.valor) || 0;
    });
    ordem.sort(function(a, b2){ return por[b2].valor - por[a].valor; });
    h += '<div class="gb-cats">' + ordem.slice(0, 5).map(function(k){
      var c = por[k];
      return '<div class="gb-cat"><span>' + esc(c.nome) + '</span><b class="md-num">' + moeda(c.valor) + '</b>'
        + mdBarra(total ? c.valor / total * 100 : 0, '', 'md-pb--sm t-dinheiro') + '</div>';
    }).join('') + '</div>';
    if(ordem.length > 5) h += '<p class="md-meta">e mais ' + plural(ordem.length - 5, 'categoria', 'categorias') + '.</p>';
  } else if(b.mostrar === 'ultimos'){
    var ult = lista.slice().sort(function(a, b2){ return a.data < b2.data ? 1 : a.data > b2.data ? -1 : 0; }).slice(0, 5);
    h += '<ul class="gb-ult">' + ult.map(function(g){
      var dt = new Date(g.data + 'T12:00:00');
      return '<li><span class="gb-ult-txt">' + esc(g.desc || 'Gasto') + '</span><span class="md-meta">' + dt.getDate() + '/' + pad(dt.getMonth() + 1) + '</span><b class="md-num">' + moeda(parseFloat(g.valor) || 0) + '</b></li>';
    }).join('') + '</ul>';
  } else {
    h += '<p class="md-meta">' + plural(lista.length, 'lançamento', 'lançamentos') + '</p>';
  }
  h += '<p class="gb-fonte">' + ico('lock', 13, 2.4) + 'Lido da sua aba Dinheiro. Só você vê.</p>';
  return h;
}

var _gastosBloco = null;
function abrirConfigGastos(bid){
  var b = blocoPorId(bid); if(!b) return;
  _gastosBloco = { id: bid, periodo: b.periodo, mostrar: b.mostrar };
  pintarConfigGastos();
  openModal('modal-bloco-gastos');
}
function pintarConfigGastos(){
  var c = _gastosBloco; if(!c) return;
  document.querySelectorAll('#bg-periodo button').forEach(function(bt){ bt.setAttribute('aria-pressed', bt.dataset.v === c.periodo ? 'true' : 'false'); });
  document.querySelectorAll('#bg-mostrar button').forEach(function(bt){ bt.setAttribute('aria-checked', bt.dataset.v === c.mostrar ? 'true' : 'false'); });
}
function escolherConfigGastos(campo, valor){
  if(!_gastosBloco) return;
  if(campo === 'periodo' && (valor === 'semana' || valor === 'mes')) _gastosBloco.periodo = valor;
  if(campo === 'mostrar' && ['categorias', 'total', 'ultimos'].indexOf(valor) >= 0) _gastosBloco.mostrar = valor;
  pintarConfigGastos();
}
function salvarConfigGastos(){
  var c = _gastosBloco, b = c && blocoPorId(c.id);
  if(!b){ closeModal('modal-bloco-gastos'); return; }
  b.periodo = c.periodo; b.mostrar = c.mostrar;
  saveState();
  closeModal('modal-bloco-gastos');
  renderQuadro();
}

// ─── Modal de texto (item da lista, post-it, habito) ─────────────────────
var _qt = null;   // { modo, blocoId, itemId, dia, cor }

function abrirTextoQuadro(modo, bid, iid, dia){
  var b = blocoPorId(bid); if(!b) return;
  _qt = { modo: modo, blocoId: bid, itemId: iid || null, dia: (dia >= 0 && dia <= 6) ? dia : idxHoje(), cor: 'laranja' };
  var titulo = '', rotulo = '', max = 120, valor = '', apagar = false;
  if(modo === 'semana'){
    if(b.itens.length >= SEMANA_ITENS_MAX){ toast('A lista já está cheia.'); return; }
    titulo = 'Novo item'; rotulo = 'O que fazer'; max = SEMANA_TEXTO_MAX;
  } else if(modo === 'postit'){
    var n = iid && b.notas.find(function(x){ return x.id === iid; });
    if(!n && b.notas.length >= POSTITS_MAX){ toast('Cabem ' + POSTITS_MAX + ' post-its no bloco.'); return; }
    titulo = n ? 'Post-it' : 'Novo post-it'; rotulo = 'Lembrete'; max = POSTIT_TEXTO_MAX;
    if(n){ valor = n.texto; _qt.cor = n.cor; apagar = true; }
  } else if(modo === 'habito'){
    if(b.habitos.length >= HABITOS_MAX){ toast('Cabem ' + HABITOS_MAX + ' hábitos no bloco.'); return; }
    titulo = 'Novo hábito'; rotulo = 'Hábito'; max = HABITO_NOME_MAX;
  } else return;

  document.getElementById('qt-titulo').textContent = titulo;
  document.getElementById('qt-label').textContent = rotulo;
  var campo = document.getElementById('qt-texto');
  campo.maxLength = max;
  campo.value = valor;
  campo.placeholder = modo === 'habito' ? 'Ex.: Academia, dormir até 23h' : modo === 'semana' ? 'Ex.: Separar a roupa da semana' : 'Ex.: Prova de Direito na quinta';
  document.getElementById('qt-dia-wrap').hidden = modo !== 'semana';
  document.getElementById('qt-dia').innerHTML = DIAS_SEMANA.map(function(n, i){
    return '<option value="' + i + '"' + (i === _qt.dia ? ' selected' : '') + '>' + n + ', ' + new Date(dataDaSemana(i) + 'T12:00:00').getDate() + '</option>';
  }).join('');
  document.getElementById('qt-cores-wrap').hidden = modo !== 'postit';
  pintarCoresPostit();
  document.getElementById('qt-apagar').hidden = !apagar;
  openModal('modal-quadro-texto');
  setTimeout(function(){ campo.focus(); }, 60);
}

function pintarCoresPostit(){
  var box = document.getElementById('qt-cores');
  if(!box || !_qt) return;
  box.innerHTML = POSTIT_CORES.map(function(c){
    return '<button type="button" class="pt-cor pt--' + c + '" aria-pressed="' + (c === _qt.cor) + '" onclick="escolherCorPostit(\'' + c + '\')" aria-label="' + POSTIT_NOMES[c] + '"></button>';
  }).join('');
}
function escolherCorPostit(c){
  if(_qt && POSTIT_CORES.indexOf(c) >= 0){ _qt.cor = c; pintarCoresPostit(); }
}

function salvarTextoQuadro(){
  var q = _qt, b = q && blocoPorId(q.blocoId);
  if(!b){ closeModal('modal-quadro-texto'); return; }
  var campo = document.getElementById('qt-texto');
  if(q.modo === 'semana'){
    var texto = textoLimpo(campo.value, SEMANA_TEXTO_MAX);
    if(!texto){ toast('Escreva o item.'); return; }
    var dia = parseInt(document.getElementById('qt-dia').value, 10);
    if(!(dia >= 0 && dia <= 6)) dia = idxHoje();
    b.itens.push({ id: uid(), data: dataDaSemana(dia), texto: texto, feito: false });
  } else if(q.modo === 'postit'){
    var tp = textoLimpo(campo.value, POSTIT_TEXTO_MAX);
    if(!tp){ toast('Escreva o lembrete.'); return; }
    var n = q.itemId && b.notas.find(function(x){ return x.id === q.itemId; });
    if(n){ n.texto = tp; n.cor = q.cor; }
    else b.notas.push({ id: uid(), texto: tp, cor: q.cor });
  } else if(q.modo === 'habito'){
    var nome = textoLimpo(campo.value, HABITO_NOME_MAX);
    if(!nome){ toast('Dê um nome ao hábito.'); return; }
    b.habitos.push({ id: uid(), nome: nome, dias: {} });
  }
  saveState();
  closeModal('modal-quadro-texto');
  renderQuadro();
}

function apagarTextoQuadro(){
  var q = _qt, b = q && blocoPorId(q.blocoId);
  if(!b || q.modo !== 'postit' || !q.itemId){ closeModal('modal-quadro-texto'); return; }
  b.notas = b.notas.filter(function(x){ return x.id !== q.itemId; });
  saveState();
  closeModal('modal-quadro-texto');
  renderQuadro();
}

// ─── Adicionar, mover e tirar blocos ─────────────────────────────────────
function abrirAdicionarBloco(){
  var blocos = garantirQuadro();
  var cheio = blocos.length >= QUADRO_MAX;
  document.getElementById('ab-lista').innerHTML = QUADRO_ORDEM_TIPOS.map(function(tipo){
    var t = QUADRO_TIPOS[tipo];
    var jaTem = t.unico && blocoDoTipo(tipo);
    var bloqueado = cheio || jaTem;
    return '<button type="button" class="ab-op"' + (bloqueado ? ' disabled' : '') + ' onclick="adicionarBloco(\'' + tipo + '\')">'
      + '<span class="md-tile ' + t.area + '">' + ico(t.icone, 22, 2) + '</span>'
      + '<span class="ab-txt"><b>' + t.nome + '</b><span>' + (jaTem ? 'Já está no seu quadro.' : t.desc) + '</span></span>'
      + (bloqueado ? '' : '<span class="ab-mais" aria-hidden="true">' + ico('plus', 16, 3) + '</span>')
      + '</button>';
  }).join('');
  document.getElementById('ab-cheio').hidden = !cheio;
  openModal('modal-add-bloco');
}

function adicionarBloco(tipo){
  if(!QUADRO_TIPOS[tipo]) return;
  if(garantirQuadro().length >= QUADRO_MAX){ toast('O quadro tem espaço para ' + QUADRO_MAX + ' blocos.'); return; }
  if(QUADRO_TIPOS[tipo].unico && blocoDoTipo(tipo)) return;
  inserirBloco(novoBloco(tipo));
  saveState();
  closeModal('modal-add-bloco');
  renderQuadro();
  toast(QUADRO_TIPOS[tipo].nome + ' no quadro.');
  // O plano vazio nao mostra nada: ja abre o editor do dia de hoje.
  if(tipo === 'estudos' && !garantirPlano().length) abrirEditorPlano(idxHoje());
}

function aplicarModeloSemana(){
  ['estudos', 'semana', 'rotina'].forEach(function(tipo){
    if(!blocoDoTipo(tipo) && garantirQuadro().length < QUADRO_MAX) inserirBloco(novoBloco(tipo));
  });
  saveState();
  renderQuadro();
  if(!garantirPlano().length) abrirEditorPlano(idxHoje());
}

function moverBloco(bid, dir){
  var l = garantirQuadro();
  var i = l.findIndex(function(b){ return b.id === bid; });
  var j = i + dir;
  if(i < 0 || j < 0 || j >= l.length) return;
  var t = l[i]; l[i] = l[j]; l[j] = t;
  l.forEach(function(b, k){ b.ordem = k; });
  saveState();
  renderQuadro();
}

function pedirRemoverBloco(bid){
  var b = blocoPorId(bid); if(!b) return;
  var nome = tituloDoBloco(b);
  var aviso = QUADRO_TIPOS[b.tipo].dados || b.tipo === 'estudos'
    ? 'O bloco sai do quadro. ' + (b.tipo === 'estudos' ? 'Seu plano continua salvo e aparece em Estudos.' : 'Seus gastos continuam na aba Dinheiro.')
    : 'O bloco e o que está escrito nele vão ser apagados.';
  confirmarAcao('Tirar ' + nome.toLowerCase(), aviso, 'Tirar', function(){
    state.quadro = _quadroRef = garantirQuadro().filter(function(x){ return x.id !== bid; });
    state.quadro.forEach(function(x, k){ x.ordem = k; });
    if(!state.quadro.length) quadroOrganizando = false;
    saveState();
    renderQuadro();
  });
}

function alternarOrganizarQuadro(){
  quadroOrganizando = !quadroOrganizando;
  renderQuadro();
}

// Caixa de confirmacao do app (modal-confirm), com o texto montado por
// textContent: o nome que a pessoa escreveu nao vira HTML.
function confirmarAcao(titulo, corpo, botao, fn){
  document.getElementById('confirm-icon').textContent = '';
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-body').textContent = corpo;
  var ok = document.getElementById('confirm-ok-btn');
  ok.textContent = botao;
  ok.onclick = function(){
    closeModal('modal-confirm');
    resetConfirmBtn();
    fn();
  };
  openModal('modal-confirm');
}
