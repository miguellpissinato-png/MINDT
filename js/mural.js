// MURAL — o Quadro no computador e no tablet deitado: um quadro branco
// livre onde a pessoa solta post-its, textos e listas, liga tudo com setas
// e posiciona os blocos de dados do Quadro (Estudos, Gastos, Rotina...).
//
// POR QUE ESTE ARQUIVO EXISTE
// No celular o Quadro e uma coluna de blocos (js/quadro.js). Numa tela
// grande isso desperdica espaco e nao deixa a pessoa organizar do jeito
// dela. O mural e a MESMA pagina e os MESMOS blocos — so muda a forma de
// mostrar. O que e escrito no mural aparece no celular, em lista, embaixo
// dos blocos (htmlMuralNaLista).
//
// FORMATO
//   state.paineis = [{ id, nome, ordem }]
//     Murais a mais ("Faculdade", "Casa"). O principal nao e guardado: ele
//     sempre existe, com id 'principal'. Os blocos de dados moram nele.
//
//   state.mural = [{ id, painel, tipo, z, ...campos do tipo }]
//     postit  x, y, w, h, texto, cor
//     texto   x, y, w, texto, tam ('p'|'m'|'g')
//     lista   x, y, w, titulo, itens: [{ id, t, f }]
//     bloco   x, y, w, bid  — o lugar de um bloco de state.quadro no mural.
//             O id e 'mb' + bid: dois aparelhos que posicionam o mesmo bloco
//             geram o MESMO item, e a mesclagem do sync nao duplica.
//     seta    a, b (ids dos itens ligados, ou nada) e ax, ay, bx, by (as
//             pontas soltas, ou a ultima posicao conhecida).
//     Coordenadas em pixels do "mundo" do mural, sem o zoom.
//
// As duas listas estao em COLECOES (sync.js): item a item, com exclusao.
// A posicao da camera (arrasto e zoom) e de cada aparelho: localStorage.
//
// SEGURANCA: tudo que vem do estado e validado (tipos, numeros dentro de
// limites, ids no formato de uid, textos cortados). Texto da pessoa so
// entra na tela por esc() ou .value. Os itens nao tem onclick: um unico
// ouvinte no mural le data-id/data-acao e procura o item pelo id validado.

var MURAL_MAX = 400;              // itens somando todos os paineis
var MURAL_TEXTO_MAX = 400;
var LISTA_ITENS_MAX = 30, LISTA_ITEM_MAX = 120, LISTA_TITULO_MAX = 60;
var PAINEIS_MAX = 8, PAINEL_NOME_MAX = 30;
var MURAL_COORD = 20000;
var PAINEL_PRINCIPAL = 'principal';
var MURAL_TIPOS = ['postit', 'texto', 'lista', 'bloco', 'seta'];
// largura: minima, maxima, padrao
var MURAL_LARG = { postit: [120, 480, 200], texto: [80, 900, 300], lista: [200, 520, 260], bloco: [300, 760, 380] };
var TEXTO_TAMS = ['p', 'm', 'g'];
var TEXTO_TAM_NOMES = { p: 'Pequeno', m: 'Médio', g: 'Grande' };
var MURAL_ZOOM_MIN = 0.25, MURAL_ZOOM_MAX = 2;
var MURAL_FERRAMENTAS = [
  { id: 'mover',  nome: 'Mover',   tecla: 'V' },
  { id: 'postit', nome: 'Post-it', tecla: 'P' },
  { id: 'texto',  nome: 'Texto',   tecla: 'T' },
  { id: 'lista',  nome: 'Lista',   tecla: 'L' },
  { id: 'seta',   nome: 'Seta',    tecla: 'S' },
  { id: 'bloco',  nome: 'Bloco',   tecla: 'B' }
];

// ─── Utilidades ──────────────────────────────────────────────────────────
function numEntre(v, a, b, padrao){
  v = Number(v);
  return isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : padrao;
}
function idOuNada(v){ return (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v)) ? v : null; }
// Como textoLimpo, mas mantendo as quebras de linha (post-it tem paragrafo).
function textoMural(v, max){
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim().slice(0, max || MURAL_TEXTO_MAX);
}
function lerLocal(chave){ try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch(e){ return null; } }
function gravarLocal(chave, v){ try { localStorage.setItem(chave, JSON.stringify(v)); } catch(e){} }

// ─── Validacao do estado ─────────────────────────────────────────────────
var _paineisRef = null, _muralRef = null;

function garantirPaineis(){
  if(state.paineis && state.paineis === _paineisRef) return _paineisRef;
  var vistos = {}, lista = [];
  vistos[PAINEL_PRINCIPAL] = 1;
  (Array.isArray(state.paineis) ? state.paineis : []).forEach(function(p, i){
    if(!p || typeof p !== 'object') return;
    var id = idOuNada(p.id);
    if(!id || vistos[id]) return;
    vistos[id] = 1;
    var o = { id: id, nome: textoLimpo(p.nome, PAINEL_NOME_MAX) || 'Painel', ordem: isFinite(p.ordem) ? Number(p.ordem) : i };
    if(typeof p._upd === 'string') o._upd = p._upd;
    lista.push(o);
  });
  lista.sort(function(a, b){ return a.ordem - b.ordem; });
  state.paineis = _paineisRef = lista.slice(0, PAINEIS_MAX);
  return _paineisRef;
}
function todosPaineis(){
  return [{ id: PAINEL_PRINCIPAL, nome: 'Principal' }].concat(garantirPaineis());
}
function painelPorId(id){
  var l = todosPaineis();
  for(var i = 0; i < l.length; i++) if(l[i].id === id) return l[i];
  return null;
}

function itemMuralValido(e){
  if(!e || typeof e !== 'object' || MURAL_TIPOS.indexOf(e.tipo) < 0) return null;
  var o = { id: idSeguro(e.id), tipo: e.tipo, painel: idOuNada(e.painel) || PAINEL_PRINCIPAL, z: numEntre(e.z, 0, 1e6, 0) };
  var C = MURAL_COORD;
  if(e.tipo === 'seta'){
    o.a = idOuNada(e.a); o.b = idOuNada(e.b);
    o.ax = numEntre(e.ax, -C, C, 0); o.ay = numEntre(e.ay, -C, C, 0);
    o.bx = numEntre(e.bx, -C, C, 0); o.by = numEntre(e.by, -C, C, 0);
    if(o.a && o.a === o.b) o.b = null;
  } else {
    var L = MURAL_LARG[e.tipo];
    o.x = numEntre(e.x, -C, C, 0); o.y = numEntre(e.y, -C, C, 0);
    o.w = numEntre(e.w, L[0], L[1], L[2]);
    if(e.tipo === 'postit'){
      o.h = numEntre(e.h, 100, 480, 160);
      o.texto = textoMural(e.texto);
      o.cor = POSTIT_CORES.indexOf(e.cor) >= 0 ? e.cor : 'amarelo';
    } else if(e.tipo === 'texto'){
      o.texto = textoMural(e.texto);
      if(!o.texto) return null;
      o.tam = TEXTO_TAMS.indexOf(e.tam) >= 0 ? e.tam : 'm';
    } else if(e.tipo === 'lista'){
      o.titulo = textoLimpo(e.titulo, LISTA_TITULO_MAX) || 'Lista';
      var vistos = {};
      o.itens = (Array.isArray(e.itens) ? e.itens : []).map(function(it){
        var t = it && textoLimpo(it.t, LISTA_ITEM_MAX);
        if(!t) return null;
        var id = idSeguro(it.id);
        if(vistos[id]) id = uid();
        vistos[id] = 1;
        return { id: id, t: t, f: !!it.f };
      }).filter(Boolean).slice(0, LISTA_ITENS_MAX);
    } else if(e.tipo === 'bloco'){
      o.bid = idOuNada(e.bid);
      if(!o.bid) return null;
      o.painel = PAINEL_PRINCIPAL;   // blocos de dados so no principal
    }
  }
  if(typeof e._upd === 'string') o._upd = e._upd;
  return o;
}

function garantirMural(){
  if(state.mural && state.mural === _muralRef) return _muralRef;
  var paineis = {}, vistos = {}, blocos = {}, lista = [];
  todosPaineis().forEach(function(p){ paineis[p.id] = 1; });
  garantirQuadro().forEach(function(b){ blocos[b.id] = 1; });
  (Array.isArray(state.mural) ? state.mural : []).forEach(function(e){
    var o = itemMuralValido(e);
    if(!o) return;
    if(!paineis[o.painel]) o.painel = PAINEL_PRINCIPAL;   // painel apagado em outro aparelho
    if(o.tipo === 'bloco' && !blocos[o.bid]) return;      // bloco que saiu do quadro
    if(vistos[o.id]){ if(o.tipo === 'bloco') return; o.id = uid(); }
    vistos[o.id] = 1;
    lista.push(o);
  });
  // Seta ligada a um item que nao existe (ou de outro painel) fica solta.
  var onde = {};
  lista.forEach(function(o){ if(o.tipo !== 'seta') onde[o.id] = o.painel; });
  lista.forEach(function(o){
    if(o.tipo !== 'seta') return;
    if(o.a && onde[o.a] !== o.painel) o.a = null;
    if(o.b && onde[o.b] !== o.painel) o.b = null;
  });
  state.mural = _muralRef = lista.slice(0, MURAL_MAX);
  return _muralRef;
}

function itemMural(id){
  var l = garantirMural();
  for(var i = 0; i < l.length; i++) if(l[i].id === id) return l[i];
  return null;
}
function itensDoPainel(pid){
  return garantirMural().filter(function(e){ return e.painel === pid; });
}
function zMaximo(pid){
  return itensDoPainel(pid).reduce(function(m, e){ return Math.max(m, e.z); }, 0);
}
function tirarDoMural(ids){
  var fora = {};
  ids.forEach(function(id){ fora[id] = 1; });
  state.mural = _muralRef = garantirMural().filter(function(e){ return !fora[e.id]; });
}

// ─── Estado da tela (de cada aparelho, nao sincroniza) ───────────────────
var _mu = {
  painel: PAINEL_PRINCIPAL,
  ferramenta: 'mover',
  sel: null,          // id do item selecionado
  editando: null,     // { id, campo: 'texto'|'titulo'|'item', iid }
  novo: null,         // id do item recem-criado (vazio ao sair = some)
  vistas: {},         // painel -> { x, y, s }
  desfazer: [],       // pilhas de itens apagados (Ctrl+Z)
  gesto: null,
  dedos: {},
  arrumar: null       // blocos recem-posicionados, arrumados depois de medir
};

(function carregarVistas(){
  var salvo = lerLocal('mindt-mural');
  if(!salvo || typeof salvo !== 'object') return;
  if(idOuNada(salvo.painel)) _mu.painel = salvo.painel;
  if(salvo.vistas && typeof salvo.vistas === 'object'){
    Object.keys(salvo.vistas).slice(0, 20).forEach(function(k){
      var v = salvo.vistas[k];
      if(!idOuNada(k) || !v) return;
      _mu.vistas[k] = {
        x: numEntre(v.x, -1e5, 1e5, 40), y: numEntre(v.y, -1e5, 1e5, 40),
        s: Math.min(MURAL_ZOOM_MAX, Math.max(MURAL_ZOOM_MIN, Number(v.s) || 1))
      };
    });
  }
})();
var _vistaTimer = null;
function guardarVistas(){
  clearTimeout(_vistaTimer);
  _vistaTimer = setTimeout(function(){ gravarLocal('mindt-mural', { painel: _mu.painel, vistas: _mu.vistas }); }, 300);
}
function vista(){
  var v = _mu.vistas[_mu.painel];
  if(!v) v = _mu.vistas[_mu.painel] = { x: 40, y: 40, s: 1 };
  return v;
}

// Mural no computador (e tablet deitado), a nao ser que a pessoa peca lista.
var _muLargo = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null;
function telaLarga(){ return !!(_muLargo && _muLargo.matches); }
function modoQuadro(){ return lerLocal('mindt-quadro-modo') === 'lista' ? 'lista' : 'mural'; }
function muralAtivo(){ return telaLarga() && modoQuadro() === 'mural'; }
function alternarModoQuadro(){
  gravarLocal('mindt-quadro-modo', modoQuadro() === 'mural' ? 'lista' : 'mural');
  _mu.sel = null; _mu.editando = null;
  renderQuadro();
}
if(_muLargo){
  var _aoMudarLargura = function(){ if(typeof quadroVisivel === 'function' && quadroVisivel()) renderQuadro(); };
  if(_muLargo.addEventListener) _muLargo.addEventListener('change', _aoMudarLargura);
  else if(_muLargo.addListener) _muLargo.addListener(_aoMudarLargura);
}

// ─── Pintura ─────────────────────────────────────────────────────────────
var ICO_FERR = {
  mover:  '<path d="M4 3l7 17 2.5-7.5L21 10z"/>',
  postit: '<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2z"/><polyline points="14 21 14 14 21 14"/>',
  texto:  '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  lista:  '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  seta:   '<line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/>',
  bloco:  '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'
};
function svgFerr(nome, tam){
  return '<svg class="md-ico" viewBox="0 0 24 24" width="' + (tam || 20) + '" height="' + (tam || 20) + '" stroke-width="2.2" aria-hidden="true">' + ICO_FERR[nome] + '</svg>';
}

// Chamado por renderQuadro quando o mural esta ativo.
function renderMural(){
  var caixa = document.getElementById('qd-mural');
  if(!caixa) return;
  if(!painelPorId(_mu.painel)) _mu.painel = PAINEL_PRINCIPAL;
  if(!document.getElementById('mu')) montarMural(caixa);
  ajustarAltura();
  if(_mu.editando) { pintarChrome(); return; }   // nao destruir o campo aberto
  posicionarBlocos();
  pintarMundo();
  aplicarVista();
  pintarChrome();
}

// O mural ocupa o que sobra da janela abaixo do cabecalho: a barra de
// ferramentas fica sempre a vista, sem precisar rolar a pagina.
function ajustarAltura(){
  var mu = document.getElementById('mu'), main = document.getElementById('main');
  if(!mu || !main) return;
  var topo = mu.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
  mu.style.height = Math.max(480, Math.round(main.clientHeight - topo - 20)) + 'px';
}
window.addEventListener('resize', function(){
  if(document.getElementById('mu') && muralAtivo() && quadroVisivel()){ ajustarAltura(); posicionarCtx(); }
});

function montarMural(caixa){
  caixa.innerHTML =
      '<div class="mu" id="mu" tabindex="-1" aria-label="Mural">'
    +   '<div class="mu-mundo" id="mu-mundo"></div>'
    +   '<div class="mu-dica" id="mu-dica" hidden></div>'
    +   '<div class="mu-topo"><button type="button" class="mu-painel-bt" data-acao="paineis" aria-haspopup="dialog"></button></div>'
    +   '<div class="mu-ctx" id="mu-ctx" role="toolbar" aria-label="Item selecionado" hidden></div>'
    +   '<div class="mu-ferr" role="toolbar" aria-label="Ferramentas do mural">'
    +     MURAL_FERRAMENTAS.map(function(f){
            return '<button type="button" class="mu-fb" data-acao="ferr" data-f="' + f.id + '" aria-pressed="false" title="' + f.nome + ' (' + f.tecla + ')">'
              + svgFerr(f.id) + '<span>' + f.nome + '</span></button>';
          }).join('')
    +   '</div>'
    +   '<div class="mu-zoom">'
    +     '<button type="button" data-acao="zoom-menos" aria-label="Diminuir o zoom"><svg class="md-ico" viewBox="0 0 24 24" width="16" height="16" stroke-width="2.6" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
    +     '<button type="button" class="mu-zoom-v md-num" data-acao="zoom-ajustar" title="Ajustar tudo na tela" aria-label="Ajustar tudo na tela"></button>'
    +     '<button type="button" data-acao="zoom-mais" aria-label="Aumentar o zoom"><svg class="md-ico" viewBox="0 0 24 24" width="16" height="16" stroke-width="2.6" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
    +   '</div>'
    + '</div>';
  var mu = document.getElementById('mu');
  mu.addEventListener('pointerdown', muDown);
  mu.addEventListener('pointermove', muMove);
  mu.addEventListener('pointerup', muUp);
  mu.addEventListener('pointercancel', muUp);
  mu.addEventListener('click', muClick);
  mu.addEventListener('dblclick', muDblClick);
  mu.addEventListener('wheel', muWheel, { passive: false });
  mu.addEventListener('focusin', function(e){
    var d = e.target.classList && e.target.classList.contains('mu-el') ? e.target : null;
    if(d && d.dataset.id !== _mu.sel){ _mu.sel = d.dataset.id; marcarSelecao(); }
  });
}

// Cada bloco do quadro tem um lugar no painel principal. Bloco novo (ou
// vindo de outro aparelho) ganha um lugar livre automaticamente.
function posicionarBlocos(){
  var blocos = garantirQuadro(), existe = {};
  blocos.forEach(function(b){ existe[b.id] = 1; });
  // Bloco que saiu do quadro (aqui ou em outro aparelho): o lugar sai junto.
  var orfaos = garantirMural().filter(function(e){ return e.tipo === 'bloco' && !existe[e.bid]; });
  if(orfaos.length){ tirarDoMural(orfaos.map(function(e){ return e.id; })); saveState(); }
  if(_mu.painel !== PAINEL_PRINCIPAL) return;
  var tem = {};
  garantirMural().forEach(function(e){ if(e.tipo === 'bloco') tem[e.bid] = 1; });
  var faltam = blocos.filter(function(b){ return !tem[b.id]; });
  if(!faltam.length) return;
  if(garantirMural().length + faltam.length > MURAL_MAX) return;
  var vazio = !itensDoPainel(PAINEL_PRINCIPAL).length;
  var v = vista(), mu = document.getElementById('mu');
  var cx = mu ? (mu.clientWidth / 2 - v.x) / v.s : 400, cy = mu ? (mu.clientHeight / 3 - v.y) / v.s : 200;
  var z = zMaximo(PAINEL_PRINCIPAL);
  _mu.arrumar = vazio ? [] : null;
  faltam.forEach(function(b, k){
    var w = (b.tipo === 'estudos' || b.tipo === 'semana') ? 400 : 360;
    var e = vazio
      ? { id: ('mb' + b.id).slice(0, 40), tipo: 'bloco', painel: PAINEL_PRINCIPAL, bid: b.id, x: 0, y: 0, w: w, z: ++z }
      : { id: ('mb' + b.id).slice(0, 40), tipo: 'bloco', painel: PAINEL_PRINCIPAL, bid: b.id, x: Math.round(cx - w / 2 + k * 30), y: Math.round(cy + k * 30), w: w, z: ++z };
    garantirMural().push(e);
    if(_mu.arrumar) _mu.arrumar.push(e.id);
  });
  saveState();
}

// Primeira vez no mural: os blocos em colunas, cada um embaixo do outro,
// medindo a altura de verdade (so da para saber depois de pintar).
function arrumarEmColunas(){
  var ids = _mu.arrumar; _mu.arrumar = null;
  if(!ids || !ids.length) return;
  var mu = document.getElementById('mu');
  var cols = Math.max(1, Math.min(3, Math.floor(((mu ? mu.clientWidth : 1200) - 40) / 440)));
  var fundo = []; for(var c = 0; c < cols; c++) fundo.push(72);   // abaixo do botao do painel
  ids.forEach(function(id){
    var e = itemMural(id), d = domDe(id);
    if(!e || !d) return;
    var col = fundo.indexOf(Math.min.apply(null, fundo));
    e.x = 32 + col * 440; e.y = fundo[col];
    fundo[col] += d.offsetHeight + 28;
    d.style.left = e.x + 'px'; d.style.top = e.y + 'px';
  });
  var v = vista(); v.x = 24; v.y = 24; v.s = 1;
  aplicarVista(); pintarSetas();
  saveState();
}

function domDe(id){ return document.querySelector('#mu-mundo .mu-el[data-id="' + id + '"]'); }

function pintarMundo(){
  var mundo = document.getElementById('mu-mundo');
  if(!mundo) return;
  var itens = itensDoPainel(_mu.painel).slice().sort(function(a, b){ return a.z - b.z; });
  if(_mu.sel && !itemMural(_mu.sel)) _mu.sel = null;
  if(typeof _materiasNaTela !== 'undefined') _materiasNaTela = [];
  var blocos = garantirQuadro();
  mundo.innerHTML = '<svg class="mu-setas" id="mu-setas" aria-hidden="true"></svg>'
    + itens.filter(function(e){ return e.tipo !== 'seta'; }).map(function(e){ return htmlItemMural(e, blocos); }).join('');
  if(_mu.arrumar) arrumarEmColunas();
  pintarSetas();
  marcarSelecao();
  var dica = document.getElementById('mu-dica');
  if(dica){
    dica.hidden = itens.length > 0;
    dica.innerHTML = '<b>Mural vazio</b><span>Escolha <b>Post-it</b>, <b>Texto</b> ou <b>Lista</b> embaixo e clique no mural. Dois cliques no fundo também criam um post-it.</span>';
  }
}

function estiloPos(e){
  return 'left:' + e.x + 'px;top:' + e.y + 'px;width:' + e.w + 'px;z-index:' + (e.z + 1) + (e.tipo === 'postit' ? ';height:' + e.h + 'px' : '');
}

function htmlItemMural(e, blocos){
  var base = ' data-id="' + e.id + '" tabindex="0" style="' + estiloPos(e) + '"';
  if(e.tipo === 'postit'){
    return '<div class="mu-el mu-postit pt--' + e.cor + '"' + base + ' role="group" aria-label="Post-it' + (e.texto ? ': ' + esc(e.texto) : ' vazio') + '">'
      + '<div class="mu-txt">' + esc(e.texto) + '</div></div>';
  }
  if(e.tipo === 'texto'){
    return '<div class="mu-el mu-texto mu-t-' + e.tam + '"' + base + ' role="group" aria-label="Texto: ' + esc(e.texto) + '">'
      + '<div class="mu-txt">' + esc(e.texto) + '</div></div>';
  }
  if(e.tipo === 'lista'){
    var feitos = e.itens.filter(function(it){ return it.f; }).length;
    return '<div class="mu-el mu-lista"' + base + ' role="group" aria-label="Lista ' + esc(e.titulo) + '">'
      + '<div class="mu-lista-h"><span class="mu-lista-tit">' + esc(e.titulo) + '</span>'
      + (e.itens.length ? '<span class="md-meta">' + feitos + ' de ' + e.itens.length + '</span>' : '') + '</div>'
      + '<ul class="mu-li">' + e.itens.map(function(it){
          return '<li class="mu-li-i' + (it.f ? ' feito' : '') + '" data-iid="' + it.id + '">'
            + '<button type="button" class="md-check md-check--sm' + (it.f ? ' md-check--on' : '') + '" role="switch" aria-checked="' + it.f + '" data-acao="item-check" aria-label="' + esc(it.t) + '">' + ico('check', 16, 3) + '</button>'
            + '<span class="mu-li-t">' + esc(it.t) + '</span>'
            + '<button type="button" class="mu-li-x" data-acao="item-tirar" aria-label="Apagar ' + esc(it.t) + '">' + ico('close', 14, 2.6) + '</button>'
            + '</li>';
        }).join('') + '</ul>'
      + (e.itens.length < LISTA_ITENS_MAX ? '<button type="button" class="mu-li-add" data-acao="item-add">' + ico('plus', 16, 2.6) + 'Item</button>' : '')
      + '</div>';
  }
  if(e.tipo === 'bloco'){
    var b = null;
    for(var i = 0; i < blocos.length; i++) if(blocos[i].id === e.bid) b = blocos[i];
    if(!b) return '';
    return '<div class="mu-el mu-bloco"' + base + ' role="group" aria-label="' + tituloDoBloco(b) + '">' + htmlBloco(b, 0, 1) + '</div>';
  }
  return '';
}

// ─── Setas ───────────────────────────────────────────────────────────────
function caixaDe(id){
  var e = itemMural(id), d = domDe(id);
  if(!e || !d || e.tipo === 'seta') return null;
  return { x: e.x, y: e.y, w: d.offsetWidth, h: d.offsetHeight };
}
function centro(c){ return { x: c.x + c.w / 2, y: c.y + c.h / 2 }; }

// Onde a linha que sai do centro do item, rumo ao alvo, cruza a borda dele.
function naBorda(c, alvo, folga){
  var m = centro(c), dx = alvo.x - m.x, dy = alvo.y - m.y;
  if(!dx && !dy) return m;
  var t = Math.min(dx ? (c.w / 2) / Math.abs(dx) : Infinity, dy ? (c.h / 2) / Math.abs(dy) : Infinity);
  var len = Math.sqrt(dx * dx + dy * dy);
  return { x: m.x + dx * t + dx / len * folga, y: m.y + dy * t + dy / len * folga };
}

function pontasDaSeta(s){
  var ca = s.a && caixaDe(s.a), cb = s.b && caixaDe(s.b);
  var pa = ca ? centro(ca) : { x: s.ax, y: s.ay };
  var pb = cb ? centro(cb) : { x: s.bx, y: s.by };
  return { a: ca ? naBorda(ca, pb, 8) : pa, b: cb ? naBorda(cb, pa, 10) : pb };
}

function caminhoSeta(a, b){
  var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
  var ux = dx / len, uy = dy / len, t = 13, abre = 0.5;
  var c1x = b.x - t * (ux * Math.cos(abre) - uy * Math.sin(abre)), c1y = b.y - t * (uy * Math.cos(abre) + ux * Math.sin(abre));
  var c2x = b.x - t * (ux * Math.cos(-abre) - uy * Math.sin(-abre)), c2y = b.y - t * (uy * Math.cos(-abre) + ux * Math.sin(-abre));
  var r = function(n){ return Math.round(n * 10) / 10; };
  return {
    linha: 'M' + r(a.x) + ' ' + r(a.y) + 'L' + r(b.x) + ' ' + r(b.y),
    ponta: 'M' + r(c1x) + ' ' + r(c1y) + 'L' + r(b.x) + ' ' + r(b.y) + 'L' + r(c2x) + ' ' + r(c2y)
  };
}

function pintarSetas(){
  var svg = document.getElementById('mu-setas');
  if(!svg) return;
  var h = '';
  itensDoPainel(_mu.painel).forEach(function(s){
    if(s.tipo !== 'seta') return;
    var p = pontasDaSeta(s), c = caminhoSeta(p.a, p.b), sel = s.id === _mu.sel;
    h += '<g class="mu-seta-g' + (sel ? ' sel' : '') + '">'
      + '<path class="mu-seta" d="' + c.linha + '"/><path class="mu-seta" d="' + c.ponta + '"/>'
      + '<path class="mu-seta-hit" data-seta="' + s.id + '" d="' + c.linha + '"/>';
    if(sel){
      h += '<circle class="mu-ponta" data-ponta="a" cx="' + p.a.x + '" cy="' + p.a.y + '" r="7"/>'
        + '<circle class="mu-ponta" data-ponta="b" cx="' + p.b.x + '" cy="' + p.b.y + '" r="7"/>';
    }
    h += '</g>';
  });
  var g = _mu.gesto;
  if(g && g.tipo === 'seta' && g.moveu){
    var c = caminhoSeta(g.pa, g.agora);
    h += '<g class="mu-seta-g sel"><path class="mu-seta" d="' + c.linha + '"/><path class="mu-seta" d="' + c.ponta + '"/></g>';
  }
  svg.innerHTML = h;
}

// ─── Selecao, barra do item e cromo ──────────────────────────────────────
function marcarSelecao(){
  document.querySelectorAll('#mu-mundo .mu-el').forEach(function(d){
    var on = d.dataset.id === _mu.sel;
    d.classList.toggle('sel', on);
    var alca = d.querySelector(':scope > .mu-alca');
    if(on && !alca){
      alca = document.createElement('span');
      alca.className = 'mu-alca';
      alca.setAttribute('aria-hidden', 'true');
      d.appendChild(alca);
    } else if(!on && alca) alca.remove();
  });
  pintarSetas();
  pintarCtx();
}

function pintarCtx(){
  var ctx = document.getElementById('mu-ctx');
  if(!ctx) return;
  var e = _mu.sel && itemMural(_mu.sel);
  if(!e || _mu.editando || (_mu.gesto && _mu.gesto.moveu)){ ctx.hidden = true; return; }
  var h = '';
  if(e.tipo === 'postit'){
    h += POSTIT_CORES.map(function(c){
      return '<button type="button" class="mu-cor pt--' + c + '" data-acao="cor" data-cor="' + c + '" aria-pressed="' + (c === e.cor) + '" aria-label="' + POSTIT_NOMES[c] + '"></button>';
    }).join('') + '<span class="mu-ctx-sep"></span>';
  }
  if(e.tipo === 'texto'){
    h += TEXTO_TAMS.map(function(t){
      return '<button type="button" class="mu-ctx-bt mu-tam" data-acao="tam" data-tam="' + t + '" aria-pressed="' + (t === e.tam) + '" aria-label="' + TEXTO_TAM_NOMES[t] + '">' + t.toUpperCase() + '</button>';
    }).join('') + '<span class="mu-ctx-sep"></span>';
  }
  if(e.tipo === 'postit' || e.tipo === 'texto' || e.tipo === 'lista'){
    h += '<button type="button" class="mu-ctx-bt" data-acao="editar">' + ico('edit', 16, 2.2) + (e.tipo === 'lista' ? 'Título' : 'Editar') + '</button>';
  }
  h += e.tipo === 'bloco'
    ? '<button type="button" class="mu-ctx-bt mu-ctx-bt--perigo" data-acao="apagar">' + ico('trash', 16, 2.2) + 'Tirar do quadro</button>'
    : '<button type="button" class="mu-ctx-bt mu-ctx-bt--perigo" data-acao="apagar" aria-label="Apagar">' + ico('trash', 16, 2.2) + '</button>';
  ctx.innerHTML = h;
  ctx.hidden = false;
  posicionarCtx();
}

// A barra fica acima do item (ou do meio da seta), dentro do mural.
function posicionarCtx(){
  var ctx = document.getElementById('mu-ctx'), mu = document.getElementById('mu');
  var e = _mu.sel && itemMural(_mu.sel);
  if(!ctx || ctx.hidden || !mu || !e) return;
  var v = vista(), px, py, baixo;
  if(e.tipo === 'seta'){
    var p = pontasDaSeta(e);
    px = (p.a.x + p.b.x) / 2; py = Math.min(p.a.y, p.b.y); baixo = Math.max(p.a.y, p.b.y);
  } else {
    var c = caixaDe(e.id); if(!c) return;
    px = c.x + c.w / 2; py = c.y; baixo = c.y + c.h;
  }
  var sx = px * v.s + v.x, sy = py * v.s + v.y - 14;
  var w = ctx.offsetWidth, hh = ctx.offsetHeight;
  if(sy - hh < 56) sy = baixo * v.s + v.y + 14 + hh;   // sem espaco em cima: vai embaixo
  ctx.style.left = Math.max(8, Math.min(mu.clientWidth - w - 8, sx - w / 2)) + 'px';
  ctx.style.top = Math.max(56, Math.min(mu.clientHeight - hh - 90, sy - hh)) + 'px';
}

function pintarChrome(){
  var mu = document.getElementById('mu');
  if(!mu) return;
  mu.dataset.ferr = _mu.ferramenta;
  var principal = _mu.painel === PAINEL_PRINCIPAL;
  mu.querySelectorAll('.mu-fb').forEach(function(bt){
    bt.setAttribute('aria-pressed', bt.dataset.f === _mu.ferramenta ? 'true' : 'false');
    if(bt.dataset.f === 'bloco') bt.hidden = !principal;
  });
  var p = painelPorId(_mu.painel);
  var bt = mu.querySelector('.mu-painel-bt');
  bt.innerHTML = ico('quadro', 16, 2.2) + '<span></span>' + ico('chevronDown', 16, 2.4);
  bt.querySelector('span').textContent = p ? p.nome : 'Principal';
  bt.setAttribute('aria-label', 'Painel: ' + (p ? p.nome : 'Principal') + '. Trocar de painel');
}

function aplicarVista(){
  var v = vista(), mundo = document.getElementById('mu-mundo'), mu = document.getElementById('mu');
  if(!mundo || !mu) return;
  mundo.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.s + ')';
  var g = 22 * v.s;
  mu.style.backgroundSize = g + 'px ' + g + 'px';
  mu.style.backgroundPosition = v.x + 'px ' + v.y + 'px';
  var z = mu.querySelector('.mu-zoom-v');
  if(z) z.textContent = Math.round(v.s * 100) + '%';
  posicionarCtx();
  guardarVistas();
}

function zoomEm(fator, sx, sy){
  var v = vista(), novo = Math.min(MURAL_ZOOM_MAX, Math.max(MURAL_ZOOM_MIN, v.s * fator));
  var mu = document.getElementById('mu');
  if(sx == null){ sx = mu.clientWidth / 2; sy = mu.clientHeight / 2; }
  v.x = sx - (sx - v.x) * novo / v.s;
  v.y = sy - (sy - v.y) * novo / v.s;
  v.s = novo;
  aplicarVista();
}

function ajustarNaTela(){
  var mu = document.getElementById('mu'), v = vista();
  var cs = itensDoPainel(_mu.painel).map(function(e){
    if(e.tipo === 'seta'){ var p = pontasDaSeta(e); return { x: Math.min(p.a.x, p.b.x), y: Math.min(p.a.y, p.b.y), w: Math.abs(p.a.x - p.b.x), h: Math.abs(p.a.y - p.b.y) }; }
    return caixaDe(e.id);
  }).filter(Boolean);
  if(!cs.length){ v.x = 40; v.y = 40; v.s = 1; aplicarVista(); return; }
  var x0 = Math.min.apply(null, cs.map(function(c){ return c.x; })), y0 = Math.min.apply(null, cs.map(function(c){ return c.y; }));
  var x1 = Math.max.apply(null, cs.map(function(c){ return c.x + c.w; })), y1 = Math.max.apply(null, cs.map(function(c){ return c.y + c.h; }));
  var W = mu.clientWidth - 80, H = mu.clientHeight - 170;
  v.s = Math.min(1, Math.max(MURAL_ZOOM_MIN, Math.min(W / Math.max(1, x1 - x0), H / Math.max(1, y1 - y0))));
  v.x = 40 + (W - (x1 - x0) * v.s) / 2 - x0 * v.s;
  v.y = 64 + (H - (y1 - y0) * v.s) / 2 - y0 * v.s;
  aplicarVista();
}

// ─── Ponteiro (mouse, toque e caneta) ────────────────────────────────────
function noMundo(cx, cy){
  var r = document.getElementById('mu').getBoundingClientRect(), v = vista();
  return { x: (cx - r.left - v.x) / v.s, y: (cy - r.top - v.y) / v.s };
}
var SEL_INTERATIVO = 'button,input,textarea,select,a,label,[data-acao]';

function muDown(e){
  var mu = document.getElementById('mu');
  // Dois dedos: arrastar e pinçar para dar zoom, em qualquer ferramenta.
  if(e.pointerType === 'touch'){
    _mu.dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
    if(Object.keys(_mu.dedos).length === 2){
      _mu.gesto = { tipo: 'pinca', v0: Object.assign({}, vista()), d0: distDedos(), m0: meioDedos() };
      return;
    }
  }
  if(e.target.closest('.mu-ferr,.mu-zoom,.mu-ctx,.mu-topo,.mu-dica')) return;
  if(e.target.closest('.mu-edit')) return;
  if(_mu.editando) fecharEdicao(true);
  if(e.button === 1){ e.preventDefault(); iniciar(e, { tipo: 'pan' }); return; }
  if(e.button !== 0) return;

  var p = noMundo(e.clientX, e.clientY);
  var d = e.target.closest('.mu-el');
  var id = d && d.dataset.id;
  var f = _mu.ferramenta;

  if(f === 'seta'){
    e.preventDefault();
    iniciar(e, { tipo: 'seta', de: id || null, pa: id ? centro(caixaDe(id)) : p, agora: p });
    return;
  }
  if(f === 'postit' || f === 'texto' || f === 'lista'){
    e.preventDefault();
    iniciar(e, { tipo: 'criar', f: f, p: p });
    return;
  }
  // Ferramenta Mover
  var ponta = e.target.closest('[data-ponta]');
  if(ponta && _mu.sel){
    e.preventDefault();
    iniciar(e, { tipo: 'ponta', lado: ponta.dataset.ponta, id: _mu.sel });
    return;
  }
  var hit = e.target.closest('[data-seta]');
  if(hit){
    e.preventDefault();
    selecionar(hit.dataset.seta);
    return;
  }
  if(e.target.closest('.mu-alca') && id){
    e.preventDefault();
    var it = itemMural(id);
    iniciar(e, { tipo: 'tamanho', id: id, w0: it.w, h0: it.h || 0, x0: p.x, y0: p.y });
    return;
  }
  if(d){
    var ja = _mu.sel === id;
    if(!ja) selecionar(id, true);
    var it2 = itemMural(id);
    var interativo = e.target.closest(SEL_INTERATIVO);
    // Bloco de dados: arrasta pelo cabecalho (o resto tem botoes e checks).
    var pega = it2.tipo === 'bloco' ? (e.target.closest('.qd-blk-h') && !interativo) : !interativo;
    if(!interativo) d.focus({ preventScroll: true });
    if(pega){
      e.preventDefault();
      iniciar(e, { tipo: 'mover', id: id, ja: ja, alvo: e.target, x0: it2.x, y0: it2.y, px: p.x, py: p.y });
    }
    return;
  }
  // Fundo: tira a selecao e arrasta a vista.
  if(_mu.sel){ _mu.sel = null; marcarSelecao(); }
  mu.focus({ preventScroll: true });
  iniciar(e, { tipo: 'pan' });
}

function iniciar(e, g){
  g.sx = e.clientX; g.sy = e.clientY; g.moveu = false; g.pid = e.pointerId;
  var v = vista(); g.vx = v.x; g.vy = v.y;
  _mu.gesto = g;
  try { document.getElementById('mu').setPointerCapture(e.pointerId); } catch(x){}
}

function distDedos(){
  var k = Object.keys(_mu.dedos), a = _mu.dedos[k[0]], b = _mu.dedos[k[1]];
  return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
}
function meioDedos(){
  var k = Object.keys(_mu.dedos), a = _mu.dedos[k[0]], b = _mu.dedos[k[1]];
  var r = document.getElementById('mu').getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
}

function muMove(e){
  if(e.pointerType === 'touch' && _mu.dedos[e.pointerId]) _mu.dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
  var g = _mu.gesto;
  if(!g) return;
  if(g.tipo === 'pinca'){
    if(Object.keys(_mu.dedos).length < 2) return;
    var v = vista(), s = Math.min(MURAL_ZOOM_MAX, Math.max(MURAL_ZOOM_MIN, g.v0.s * distDedos() / g.d0)), m = meioDedos();
    v.x = m.x - (g.m0.x - g.v0.x) * s / g.v0.s;
    v.y = m.y - (g.m0.y - g.v0.y) * s / g.v0.s;
    v.s = s;
    aplicarVista();
    return;
  }
  if(e.pointerId !== g.pid) return;
  var dx = e.clientX - g.sx, dy = e.clientY - g.sy;
  if(!g.moveu){
    if(Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    g.moveu = true;
    if(g.tipo === 'pan') document.getElementById('mu').classList.add('arrastando');
    if(g.tipo === 'mover'){
      var it = itemMural(g.id), zm = zMaximo(_mu.painel);
      if(it && it.z < zm){ it.z = zm + 1; var dd = domDe(g.id); if(dd) dd.style.zIndex = it.z + 1; }
      pintarCtx();
    }
  }
  var v2 = vista(), p = noMundo(e.clientX, e.clientY);
  if(g.tipo === 'pan'){
    v2.x = g.vx + dx; v2.y = g.vy + dy;
    aplicarVista();
  } else if(g.tipo === 'mover'){
    var it2 = itemMural(g.id), d = domDe(g.id);
    if(!it2 || !d) return;
    it2.x = numEntre(g.x0 + (p.x - g.px), -MURAL_COORD, MURAL_COORD, it2.x);
    it2.y = numEntre(g.y0 + (p.y - g.py), -MURAL_COORD, MURAL_COORD, it2.y);
    d.style.left = it2.x + 'px'; d.style.top = it2.y + 'px';
    pintarSetas();
  } else if(g.tipo === 'tamanho'){
    var it3 = itemMural(g.id), d3 = domDe(g.id);
    if(!it3 || !d3) return;
    var L = MURAL_LARG[it3.tipo];
    it3.w = numEntre(g.w0 + (p.x - g.x0), L[0], L[1], it3.w);
    d3.style.width = it3.w + 'px';
    if(it3.tipo === 'postit'){ it3.h = numEntre(g.h0 + (p.y - g.y0), 100, 480, it3.h); d3.style.height = it3.h + 'px'; }
    pintarSetas(); posicionarCtx();
  } else if(g.tipo === 'seta'){
    g.agora = p;
    pintarSetas();
  } else if(g.tipo === 'ponta'){
    var s = itemMural(g.id);
    if(!s) return;
    var alvo = itemSobPonto(e.clientX, e.clientY);
    var outro = g.lado === 'a' ? s.b : s.a;
    s[g.lado] = (alvo && alvo !== outro) ? alvo : null;
    s[g.lado + 'x'] = Math.round(p.x); s[g.lado + 'y'] = Math.round(p.y);
    pintarSetas();
  }
}

function itemSobPonto(cx, cy){
  var el = document.elementFromPoint(cx, cy);
  var d = el && el.closest && el.closest('#mu-mundo .mu-el');
  return d ? d.dataset.id : null;
}

function muUp(e){
  if(e.pointerType === 'touch') delete _mu.dedos[e.pointerId];
  var g = _mu.gesto;
  if(!g) return;
  if(g.tipo === 'pinca'){ if(Object.keys(_mu.dedos).length < 2) _mu.gesto = null; return; }
  if(e.pointerId !== g.pid) return;
  _mu.gesto = null;
  document.getElementById('mu').classList.remove('arrastando');
  try { document.getElementById('mu').releasePointerCapture(e.pointerId); } catch(x){}
  if(e.type === 'pointercancel') { renderMural(); return; }
  var p = noMundo(e.clientX, e.clientY);

  if(g.tipo === 'mover'){
    if(g.moveu){ saveState(); pintarCtx(); return; }
    // Clique num item que ja estava selecionado: edita (bom no toque).
    if(g.ja) editarPeloAlvo(g.id, g.alvo);
  } else if(g.tipo === 'tamanho' || g.tipo === 'ponta'){
    if(g.moveu) saveState();
    pintarCtx();
  } else if(g.tipo === 'seta'){
    var para = itemSobPonto(e.clientX, e.clientY);
    if(!g.moveu && !g.de) return;
    if(!g.moveu && g.de && (!para || para === g.de)) return;
    if(para === g.de) para = null;
    var dist = Math.hypot(p.x - g.pa.x, p.y - g.pa.y);
    if(!para && dist < 24) return;
    criarSeta(g.de, g.pa, para, p);
  } else if(g.tipo === 'criar'){
    criarItem(g.f, g.p);
  }
}

// Atalhos de clique: botoes dentro do mural (ferramentas, zoom, barra do
// item, itens de lista). O mural nao tem onclick no HTML.
function muClick(e){
  var bt = e.target.closest('[data-acao]');
  if(!bt || !document.getElementById('mu').contains(bt)) return;
  var acao = bt.dataset.acao;
  var sel = _mu.sel && itemMural(_mu.sel);
  if(acao === 'ferr') return escolherFerramenta(bt.dataset.f);
  if(acao === 'zoom-mais') return zoomEm(1.2);
  if(acao === 'zoom-menos') return zoomEm(1 / 1.2);
  if(acao === 'zoom-ajustar') return ajustarNaTela();
  if(acao === 'paineis') return abrirPaineis();
  if(acao === 'apagar') return apagarSelecionado();
  if(acao === 'editar' && sel) return editarItem(sel.id, sel.tipo === 'lista' ? 'titulo' : 'texto');
  if(acao === 'cor' && sel && sel.tipo === 'postit' && POSTIT_CORES.indexOf(bt.dataset.cor) >= 0){
    sel.cor = bt.dataset.cor; saveState(); pintarMundo(); return;
  }
  if(acao === 'tam' && sel && sel.tipo === 'texto' && TEXTO_TAMS.indexOf(bt.dataset.tam) >= 0){
    sel.tam = bt.dataset.tam; saveState(); pintarMundo(); return;
  }
  // Acoes de um item de lista
  var d = bt.closest('.mu-el'), lista = d && itemMural(d.dataset.id);
  if(!lista || lista.tipo !== 'lista') return;
  var li = bt.closest('[data-iid]'), iid = li && li.dataset.iid;
  var item = iid && lista.itens.find(function(x){ return x.id === iid; });
  if(acao === 'item-check' && item){ item.f = !item.f; saveState(); pintarMundo(); }
  else if(acao === 'item-tirar' && item){ lista.itens = lista.itens.filter(function(x){ return x.id !== iid; }); saveState(); pintarMundo(); }
  else if(acao === 'item-add') novoItemLista(lista);
}

// O alvo vem do ponto, nao do evento: com o ponteiro capturado pelo mural
// durante o arrasto, o evento chega com o proprio mural como alvo.
function muDblClick(e){
  if(_mu.ferramenta !== 'mover' || _mu.editando) return;
  var alvo = document.elementFromPoint(e.clientX, e.clientY);
  if(!alvo || !alvo.closest || alvo.closest('.mu-ferr,.mu-zoom,.mu-ctx,.mu-topo,.mu-edit,[data-seta],[data-ponta]')) return;
  var d = alvo.closest('#mu-mundo .mu-el');
  if(d){
    if(alvo.closest(SEL_INTERATIVO)) return;
    editarPeloAlvo(d.dataset.id, alvo);
    return;
  }
  if(!alvo.closest('#mu')) return;
  criarItem('postit', noMundo(e.clientX, e.clientY));
}

function muWheel(e){
  if(e.target.closest('.mu-edit')) return;
  e.preventDefault();
  var r = document.getElementById('mu').getBoundingClientRect();
  if(e.ctrlKey || e.metaKey){
    zoomEm(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    return;
  }
  var v = vista(), k = e.deltaMode === 1 ? 16 : 1;
  var dx = e.deltaX * k, dy = e.deltaY * k;
  if(e.shiftKey && !dx){ dx = dy; dy = 0; }
  v.x -= dx; v.y -= dy;
  aplicarVista();
}

// ─── Acoes ───────────────────────────────────────────────────────────────
function escolherFerramenta(f){
  if(!MURAL_FERRAMENTAS.some(function(x){ return x.id === f; })) return;
  if(f === 'bloco'){
    if(_mu.painel !== PAINEL_PRINCIPAL){ toast('Os blocos de dados ficam no painel Principal.'); return; }
    _mu.ferramenta = 'mover';
    pintarChrome();
    abrirAdicionarBloco();
    return;
  }
  _mu.ferramenta = f;
  pintarChrome();
}

// Seta nao tem elemento proprio para receber o foco: o foco vai para o
// mural, e o Delete do teclado continua valendo para ela.
function selecionar(id, semFoco){
  _mu.sel = id;
  marcarSelecao();
  if(!semFoco){
    var d = domDe(id) || document.getElementById('mu');
    if(d) d.focus({ preventScroll: true });
  }
}

function cabeNoMural(n){
  if(garantirMural().length + (n || 1) > MURAL_MAX){ toast('O mural tem espaço para ' + MURAL_MAX + ' itens.'); return false; }
  return true;
}

function criarItem(tipo, p){
  if(!cabeNoMural()) return;
  var L = MURAL_LARG[tipo], z = zMaximo(_mu.painel) + 1;
  var e = { id: uid(), tipo: tipo, painel: _mu.painel, z: z, w: L[2] };
  if(tipo === 'postit'){ e.h = 180; e.texto = ''; e.cor = 'amarelo'; e.x = Math.round(p.x - e.w / 2); e.y = Math.round(p.y - e.h / 2); }
  if(tipo === 'texto'){ e.texto = ''; e.tam = 'm'; e.x = Math.round(p.x - 12); e.y = Math.round(p.y - 18); }
  if(tipo === 'lista'){ e.titulo = 'Lista'; e.itens = []; e.x = Math.round(p.x - e.w / 2); e.y = Math.round(p.y - 30); }
  garantirMural().push(e);
  _mu.ferramenta = 'mover';
  _mu.sel = e.id;
  _mu.novo = e.id;
  pintarChrome();
  pintarMundo();
  // Texto vazio nao e salvo (sumiria na validacao): so depois de escrito.
  if(tipo !== 'texto') saveState();
  editarItem(e.id, tipo === 'lista' ? 'titulo' : 'texto');
}

function criarSeta(de, pa, para, pb){
  if(!cabeNoMural()) return;
  var s = { id: uid(), tipo: 'seta', painel: _mu.painel, z: zMaximo(_mu.painel) + 1,
            a: de, b: para, ax: Math.round(pa.x), ay: Math.round(pa.y), bx: Math.round(pb.x), by: Math.round(pb.y) };
  if(para){ var c = caixaDe(para); if(c){ var m = centro(c); s.bx = Math.round(m.x); s.by = Math.round(m.y); } }
  garantirMural().push(s);
  _mu.ferramenta = 'mover';
  _mu.sel = s.id;
  saveState();
  pintarChrome();
  pintarSetas();
  marcarSelecao();
}

function novoItemLista(lista){
  if(lista.itens.length >= LISTA_ITENS_MAX){ toast('Cabem ' + LISTA_ITENS_MAX + ' itens na lista.'); return; }
  var it = { id: uid(), t: '', f: false };
  lista.itens.push(it);
  _mu.sel = lista.id;
  pintarMundo();
  editarItem(lista.id, 'item', it.id);
}

// Antes de apagar, guarda o item e as setas presas a ele (Ctrl+Z volta).
function apagarSelecionado(){
  var e = _mu.sel && itemMural(_mu.sel);
  if(!e) return;
  if(e.tipo === 'bloco'){
    var b = blocoPorId(e.bid);
    if(b) pedirRemoverBloco(b.id);
    return;
  }
  var presas = garantirMural().filter(function(s){ return s.tipo === 'seta' && (s.a === e.id || s.b === e.id); });
  var fora = [e].concat(e.tipo === 'seta' ? [] : presas);
  _mu.desfazer.push(JSON.parse(JSON.stringify(fora)));
  if(_mu.desfazer.length > 20) _mu.desfazer.shift();
  tirarDoMural(fora.map(function(x){ return x.id; }));
  _mu.sel = null;
  saveState();
  pintarMundo();
  var mu = document.getElementById('mu'); if(mu) mu.focus({ preventScroll: true });
  toast('Apagado. Ctrl+Z desfaz.');
}

function desfazerApagar(){
  var volta = _mu.desfazer.pop();
  if(!volta) return;
  if(!cabeNoMural(volta.length)) return;
  var l = garantirMural(), tem = {};
  l.forEach(function(e){ tem[e.id] = 1; });
  volta.forEach(function(e){ var o = itemMuralValido(e); if(o && !tem[o.id]){ delete o._upd; l.push(o); } });
  _mu.sel = volta[0] && volta[0].id;
  saveState();
  pintarMundo();
}

// ─── Edicao no lugar ─────────────────────────────────────────────────────
function editarPeloAlvo(id, alvo){
  var e = itemMural(id);
  if(!e) return;
  if(e.tipo === 'postit' || e.tipo === 'texto') return editarItem(id, 'texto');
  if(e.tipo === 'lista'){
    var li = alvo && alvo.closest && alvo.closest('.mu-li-t');
    if(li){ var iid = li.parentNode.dataset.iid; if(iid) return editarItem(id, 'item', iid); }
    if(alvo && alvo.closest && alvo.closest('.mu-lista-h')) return editarItem(id, 'titulo');
  }
}

function editarItem(id, campo, iid){
  var e = itemMural(id), d = domDe(id);
  if(!e || !d) return;
  if(_mu.editando) fecharEdicao(true);
  var alvo, valor, max, multi = false;
  if(campo === 'texto'){ alvo = d.querySelector('.mu-txt'); valor = e.texto; max = MURAL_TEXTO_MAX; multi = true; }
  else if(campo === 'titulo'){ alvo = d.querySelector('.mu-lista-tit'); valor = e.titulo; max = LISTA_TITULO_MAX; }
  else if(campo === 'item'){
    var li = d.querySelector('[data-iid="' + iid + '"] .mu-li-t');
    var it = e.itens && e.itens.find(function(x){ return x.id === iid; });
    if(!li || !it) return;
    alvo = li; valor = it.t; max = LISTA_ITEM_MAX;
  }
  if(!alvo) return;
  _mu.editando = { id: id, campo: campo, iid: iid || null };
  _mu.sel = id;
  marcarSelecao();
  d.classList.add('editando');
  var campoEl = document.createElement(multi ? 'textarea' : 'input');
  campoEl.className = 'mu-edit';
  campoEl.maxLength = max;
  campoEl.value = valor || '';
  campoEl.setAttribute('aria-label', campo === 'texto' ? (e.tipo === 'postit' ? 'Texto do post-it' : 'Texto') : campo === 'titulo' ? 'Título da lista' : 'Item da lista');
  if(campo === 'texto' && e.tipo === 'postit') campoEl.placeholder = 'Escreva aqui';
  if(campo === 'item') campoEl.placeholder = 'Novo item';
  alvo.textContent = '';
  alvo.appendChild(campoEl);
  if(multi) autoAltura(campoEl);
  campoEl.addEventListener('input', function(){ if(multi) autoAltura(campoEl); pintarSetas(); });
  campoEl.addEventListener('keydown', function(ev){
    ev.stopPropagation();
    if(ev.key === 'Escape'){ ev.preventDefault(); fecharEdicao(true, true); }
    else if(ev.key === 'Enter' && (!multi || ev.ctrlKey || ev.metaKey)){
      ev.preventDefault();
      var era = _mu.editando;
      fecharEdicao(true, true);
      // Enter num item ja abre o proximo, como numa lista de verdade.
      if(era && era.campo === 'item' && !ev.ctrlKey && !ev.metaKey){
        var l = itemMural(era.id);
        if(l && l.itens.some(function(x){ return x.id === era.iid; })) novoItemLista(l);
      } else if(era && era.campo === 'titulo'){
        var l2 = itemMural(era.id);
        if(l2 && !l2.itens.length) novoItemLista(l2);
      }
    }
  });
  campoEl.addEventListener('blur', function(){
    // O blur tambem acontece quando a tela e redesenhada: so fecha se for
    // este o campo aberto.
    if(_mu.editando && campoEl.isConnected) fecharEdicao(true);
  });
  pintarCtx();
  campoEl.focus({ preventScroll: true });
  if(campo === 'titulo' && valor === 'Lista') campoEl.select();
}

function autoAltura(t){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

// Guarda o que foi escrito. Post-it novo deixado em branco, texto vazio ou
// item de lista vazio somem — sao cliques sem querer, nao conteudo.
function fecharEdicao(gravar, focarItem){
  var ed = _mu.editando;
  if(!ed) return;
  _mu.editando = null;
  var e = itemMural(ed.id), d = domDe(ed.id);
  var campoEl = d && d.querySelector('.mu-edit');
  var valor = campoEl ? campoEl.value : '';
  if(e && gravar){
    if(ed.campo === 'texto'){
      e.texto = textoMural(valor);
      if(!e.texto && (e.tipo === 'texto' || _mu.novo === e.id)){
        tirarDoMural([e.id].concat(garantirMural().filter(function(s){ return s.tipo === 'seta' && (s.a === e.id || s.b === e.id); }).map(function(s){ return s.id; })));
        _mu.sel = null;
      }
    } else if(ed.campo === 'titulo'){
      e.titulo = textoLimpo(valor, LISTA_TITULO_MAX) || 'Lista';
    } else if(ed.campo === 'item'){
      var t = textoLimpo(valor, LISTA_ITEM_MAX);
      if(t) e.itens.forEach(function(x){ if(x.id === ed.iid) x.t = t; });
      else e.itens = e.itens.filter(function(x){ return x.id !== ed.iid; });
    }
  }
  if(_mu.novo === ed.id && ed.campo !== 'titulo') _mu.novo = null;
  saveState();
  pintarMundo();
  if(focarItem && _mu.sel){ var dd = domDe(_mu.sel); if(dd) dd.focus({ preventScroll: true }); }
}

// ─── Teclado ─────────────────────────────────────────────────────────────
var _moverTimer = null;
document.addEventListener('keydown', function(e){
  if(!document.getElementById('mu') || !muralAtivo() || !quadroVisivel()) return;
  if(document.querySelector('.modal-overlay.open')) return;
  var t = e.target;
  if(t && t.matches && t.matches('input,textarea,select,[contenteditable="true"]')) return;
  var noMuralFoco = t === document.body || (t.closest && t.closest('#mu'));
  if(!noMuralFoco) return;
  var noItem = t.classList && t.classList.contains('mu-el');
  var e2 = _mu.sel && itemMural(_mu.sel);
  var k = e.key;

  if((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z') && !e.shiftKey){ e.preventDefault(); desfazerApagar(); return; }
  if(e.ctrlKey || e.metaKey || e.altKey) return;

  if(k === 'Escape'){
    if(_mu.ferramenta !== 'mover'){ _mu.ferramenta = 'mover'; pintarChrome(); }
    else if(_mu.sel){ _mu.sel = null; marcarSelecao(); document.getElementById('mu').focus({ preventScroll: true }); }
    return;
  }
  // Teclas que mexem no item so valem com o proprio item em foco (dentro
  // de um bloco, as setas do teclado continuam nos botoes do bloco).
  if(e2 && (noItem || t.id === 'mu')){
    if(k === 'Delete' || k === 'Backspace'){ e.preventDefault(); apagarSelecionado(); return; }
    if(k === 'Enter' && e2.tipo !== 'seta' && e2.tipo !== 'bloco'){ e.preventDefault(); editarItem(e2.id, e2.tipo === 'lista' ? 'titulo' : 'texto'); return; }
    var passo = e.shiftKey ? 50 : 10;
    var mov = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[k];
    if(mov && e2.tipo !== 'seta'){
      e.preventDefault();
      e2.x = numEntre(e2.x + mov[0], -MURAL_COORD, MURAL_COORD, e2.x);
      e2.y = numEntre(e2.y + mov[1], -MURAL_COORD, MURAL_COORD, e2.y);
      var d = domDe(e2.id); if(d){ d.style.left = e2.x + 'px'; d.style.top = e2.y + 'px'; }
      pintarSetas(); posicionarCtx();
      clearTimeout(_moverTimer); _moverTimer = setTimeout(saveState, 400);
      return;
    }
  }
  if(noItem && e2 && e2.tipo === 'bloco') return;
  var atalho = { v: 'mover', p: 'postit', t: 'texto', l: 'lista', s: 'seta', b: 'bloco' }[k.toLowerCase()];
  if(atalho){ e.preventDefault(); escolherFerramenta(atalho); return; }
  if(k === '+' || k === '='){ zoomEm(1.2); return; }
  if(k === '-'){ zoomEm(1 / 1.2); return; }
});

// ─── Paineis ─────────────────────────────────────────────────────────────
function abrirPaineis(){
  pintarPaineis();
  openModal('modal-paineis');
}

function pintarPaineis(){
  var box = document.getElementById('pn-lista');
  if(!box) return;
  box.textContent = '';
  todosPaineis().forEach(function(p){
    var n = itensDoPainel(p.id).length;
    var bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'pn-op';
    bt.setAttribute('role', 'radio');
    bt.setAttribute('aria-checked', p.id === _mu.painel ? 'true' : 'false');
    bt.dataset.painel = p.id;
    bt.innerHTML = '<i aria-hidden="true"></i><span class="pn-txt"><b></b><span class="md-meta"></span></span>';
    bt.querySelector('b').textContent = p.nome;
    bt.querySelector('.md-meta').textContent = p.id === PAINEL_PRINCIPAL ? 'Com os blocos do quadro' : plural(n, 'item', 'itens');
    bt.addEventListener('click', function(){ trocarPainel(p.id); closeModal('modal-paineis'); });
    box.appendChild(bt);
  });
  var atual = painelPorId(_mu.painel);
  var extra = _mu.painel !== PAINEL_PRINCIPAL;
  document.getElementById('pn-editar').hidden = !extra;
  if(extra) document.getElementById('pn-nome').value = atual ? atual.nome : '';
  var cheio = garantirPaineis().length >= PAINEIS_MAX;
  document.getElementById('pn-novo-wrap').hidden = cheio;
  document.getElementById('pn-cheio').hidden = !cheio;
  document.getElementById('pn-novo').value = '';
}

function trocarPainel(id){
  if(!painelPorId(id)) return;
  if(_mu.editando) fecharEdicao(true);
  _mu.painel = id; _mu.sel = null; _mu.ferramenta = 'mover';
  guardarVistas();
  renderMural();
  if(typeof quadroVisivel === 'function' && quadroVisivel() && !muralAtivo()) renderQuadro();
}

function criarPainel(){
  var nome = textoLimpo(document.getElementById('pn-novo').value, PAINEL_NOME_MAX);
  if(!nome){ toast('Dê um nome ao painel.'); return; }
  var l = garantirPaineis();
  if(l.length >= PAINEIS_MAX){ toast('Cabem ' + PAINEIS_MAX + ' painéis além do principal.'); return; }
  var p = { id: uid(), nome: nome, ordem: l.length };
  l.push(p);
  saveState();
  closeModal('modal-paineis');
  trocarPainel(p.id);
  toast('Painel ' + nome + ' criado.');
}

function renomearPainel(){
  var p = garantirPaineis().find(function(x){ return x.id === _mu.painel; });
  if(!p) return;
  var nome = textoLimpo(document.getElementById('pn-nome').value, PAINEL_NOME_MAX);
  if(!nome){ toast('Dê um nome ao painel.'); return; }
  p.nome = nome;
  saveState();
  closeModal('modal-paineis');
  pintarChrome();
}

function pedirApagarPainel(){
  var p = garantirPaineis().find(function(x){ return x.id === _mu.painel; });
  if(!p) return;
  var n = itensDoPainel(p.id).length;
  closeModal('modal-paineis');
  confirmarAcao('Apagar o painel ' + p.nome, n ? 'O painel e ' + plural(n, 'item', 'itens') + ' dele vão ser apagados.' : 'O painel está vazio e vai ser apagado.', 'Apagar', function(){
    tirarDoMural(itensDoPainel(p.id).map(function(e){ return e.id; }));
    state.paineis = _paineisRef = garantirPaineis().filter(function(x){ return x.id !== p.id; });
    delete _mu.vistas[p.id];
    saveState();
    trocarPainel(PAINEL_PRINCIPAL);
    toast('Painel apagado.');
  });
}

// ─── No celular (ou "Ver como lista"): o mural em lista ──────────────────
// Post-its, textos e listas, na ordem de leitura do mural (de cima para
// baixo, da esquerda para a direita). Setas nao fazem sentido em lista.
var _painelNaLista = PAINEL_PRINCIPAL;

function htmlMuralNaLista(){
  var temItens = function(pid){ return itensDoPainel(pid).some(function(e){ return e.tipo === 'postit' || e.tipo === 'texto' || e.tipo === 'lista'; }); };
  var paineis = todosPaineis().filter(function(p){ return temItens(p.id); });
  if(!paineis.length) return '';
  if(!paineis.some(function(p){ return p.id === _painelNaLista; })) _painelNaLista = paineis[0].id;
  var itens = itensDoPainel(_painelNaLista).filter(function(e){ return e.tipo !== 'seta' && e.tipo !== 'bloco'; })
    .sort(function(a, b){ return Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x; });
  var h = '<section class="qd-blk mu-nalista" aria-label="Do mural">'
    + '<div class="qd-blk-h"><span class="md-tile md-tile--sm a-metas">' + ico('quadro', 18, 2.2) + '</span><h2>Do mural</h2></div>';
  if(paineis.length > 1){
    h += '<div class="md-chips mu-nl-paineis" role="group" aria-label="Painel">' + paineis.map(function(p, i){
      return '<button type="button" class="md-chip md-chip--leve" aria-pressed="' + (p.id === _painelNaLista) + '" onclick="verPainelNaLista(' + i + ')">' + esc(p.nome) + '</button>';
    }).join('') + '</div>';
  }
  h += '<div class="mu-nl">' + itens.map(function(e){
    if(e.tipo === 'postit') return e.texto ? '<div class="pt pt--' + e.cor + ' mu-nl-pt"><span>' + esc(e.texto) + '</span></div>' : '';
    if(e.tipo === 'texto') return '<p class="mu-nl-tx mu-t-' + e.tam + '">' + esc(e.texto) + '</p>';
    return '<div class="mu-nl-lista"><b>' + esc(e.titulo) + '</b>'
      + (e.itens.length ? '<ul class="sm-itens">' + e.itens.map(function(it){
          return '<li class="sm-it' + (it.f ? ' feito' : '') + '">'
            + '<button type="button" class="md-check md-check--sm' + (it.f ? ' md-check--on' : '') + '" role="switch" aria-checked="' + it.f + '"'
            + ' onclick="alternarItemMural(\'' + e.id + '\',\'' + it.id + '\')" aria-label="' + esc(it.t) + '">' + ico('check', 16, 3) + '</button>'
            + '<span class="sm-txt">' + esc(it.t) + '</span></li>';
        }).join('') + '</ul>' : '<p class="md-meta">Lista vazia.</p>')
      + '</div>';
  }).join('') + '</div>'
    + (telaLarga() ? '' : '<p class="md-meta mu-nl-nota">Para mover, ligar com setas e criar itens, abra o Quadro num computador ou tablet deitado.</p>')
    + '</section>';
  return h;
}

function verPainelNaLista(i){
  var paineis = todosPaineis().filter(function(p){ return itensDoPainel(p.id).some(function(e){ return e.tipo === 'postit' || e.tipo === 'texto' || e.tipo === 'lista'; }); });
  if(paineis[i]){ _painelNaLista = paineis[i].id; renderQuadro(); }
}

function alternarItemMural(eid, iid){
  var e = itemMural(eid);
  if(!e || e.tipo !== 'lista') return;
  var it = e.itens.find(function(x){ return x.id === iid; });
  if(!it) return;
  it.f = !it.f;
  saveState();
  renderQuadro();
}
