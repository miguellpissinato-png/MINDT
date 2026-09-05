// SYNC — protege os dados quando o app e usado offline ou em mais de um lugar.
//
// O problema: o estado inteiro vive num unico bloco JSON. O salvamento antigo
// sobrescrevia esse bloco sem olhar o servidor. Editar offline no celular e
// depois reconectar apagava o que tivesse sido feito no computador.
//
// A solucao aqui tem tres partes:
//
// 1. GUARDA DE VERSAO — guardamos o updated_at que vimos do servidor. Ao
//    salvar, exigimos que ele ainda seja aquele. Se nao for, alguem mudou no
//    meio: e conflito, nao sobrescrevemos.
//
// 2. MARCACAO AUTOMATICA — comparamos o estado atual com uma sombra do
//    ultimo estado salvo e marcamos com _upd os itens que mudaram, e em
//    _lixo os que foram apagados. Isso acontece num lugar so, sem precisar
//    mexer nos 41 pontos do app que salvam.
//
// 3. MESCLAGEM — no conflito, unimos as duas versoes item por item: vence o
//    _upd mais recente. Apagado continua apagado, a menos que o item tenha
//    sido editado depois em outro aparelho.
//
// Nada aqui apaga dado sem que exista uma marca de exclusao mais recente.

var COLECOES = ['metas','tasks','notas','gastos','categorias','livros','eventos','contatos'];

var revLocal = null;      // updated_at do servidor que conhecemos
var sombra = null;        // ultimo estado sincronizado, para comparacao
var pendente = false;     // ha mudanca local ainda nao aceita pelo servidor
var salvando = null;      // promessa em andamento, para nao salvar em paralelo

try { revLocal = localStorage.getItem('mindt-rev') || null; } catch(e){}
try { sombra = JSON.parse(localStorage.getItem('mindt-sombra') || 'null'); } catch(e){}

function agoraISO(){ return new Date().toISOString(); }
function guardarLocal(){ try { localStorage.setItem('mindt-local', JSON.stringify(state)); } catch(e){} }
function guardarRev(){ try { revLocal ? localStorage.setItem('mindt-rev', revLocal) : localStorage.removeItem('mindt-rev'); } catch(e){} }
function fixarSombra(){
  sombra = JSON.parse(JSON.stringify(state));
  try { localStorage.setItem('mindt-sombra', JSON.stringify(sombra)); } catch(e){}
}

// Compara um item ignorando a propria marca de tempo.
function semMarca(o){
  var c = Object.assign({}, o);
  delete c._upd;
  return JSON.stringify(c);
}
function porId(lista){
  var m = {};
  (lista || []).forEach(function(i){ if (i && i.id != null) m[i.id] = i; });
  return m;
}

// ─── 2. Marcacao automatica ──────────────────────────────
function marcarMudancas(){
  var t = agoraISO();
  if (!state._lixo) state._lixo = {};
  // Sem sombra (primeira vez neste aparelho), tudo conta como novo e recebe
  // marca. Sem isso os itens ficariam sem _upd e perderiam a mesclagem para
  // qualquer item do servidor que tivesse marca.
  if (!sombra) sombra = {};

  COLECOES.forEach(function(col){
    var atual = porId(state[col]), antes = porId(sombra[col]);
    Object.keys(atual).forEach(function(id){
      if (!antes[id] || semMarca(antes[id]) !== semMarca(atual[id])) atual[id]._upd = t;
    });
    Object.keys(antes).forEach(function(id){
      if (!atual[id]) state._lixo[col + ':' + id] = t;   // apagado
    });
  });

  // grupos e uma lista de nomes, nao de itens
  var gA = state.grupos || [], gB = sombra.grupos || [];
  gB.forEach(function(n){ if (gA.indexOf(n) === -1) state._lixo['grupo:' + n] = t; });

  if (state.perfil && JSON.stringify(sombra.perfil) !== JSON.stringify(state.perfil)) state.perfil._upd = t;
}

// ─── 3. Mesclagem ────────────────────────────────────────
function apagadoDepois(lixo, chave, item){
  var quando = lixo && lixo[chave];
  if (!quando) return false;
  // Se o item foi editado depois da exclusao, ele volta.
  return !(item && item._upd && item._upd > quando);
}

function mesclar(local, servidor){
  var lixo = Object.assign({}, servidor._lixo || {}, local._lixo || {});
  var saida = Object.assign({}, servidor, local);
  saida._lixo = lixo;

  COLECOES.forEach(function(col){
    var a = porId(local[col]), b = porId(servidor[col]);
    var ids = Object.keys(a).concat(Object.keys(b).filter(function(i){ return !a[i]; }));
    var res = [];
    ids.forEach(function(id){
      var esc;
      if (a[id] && b[id]) {
        // vence quem tem a marca mais recente; sem marca, fica o local
        esc = (b[id]._upd && (!a[id]._upd || b[id]._upd > a[id]._upd)) ? b[id] : a[id];
      } else {
        esc = a[id] || b[id];
      }
      if (!apagadoDepois(lixo, col + ':' + id, esc)) res.push(esc);
    });
    saida[col] = res;
  });

  // grupos: uniao das duas listas, menos os apagados
  var g = {};
  (local.grupos || []).concat(servidor.grupos || []).forEach(function(n){ g[n] = 1; });
  saida.grupos = Object.keys(g).filter(function(n){ return !lixo['grupo:' + n]; });

  // perfil: o mais recente
  var pa = local.perfil || {}, pb = servidor.perfil || {};
  saida.perfil = (pb._upd && (!pa._upd || pb._upd > pa._upd)) ? pb : pa;

  // XP nunca diminui
  saida.studyXP = Math.max(local.studyXP || 0, servidor.studyXP || 0);

  // sessoes de estudo: mesmo dia soma o maior; dia diferente, vale o mais novo
  if ((local.sessionDate || '') === (servidor.sessionDate || '')) {
    saida.todaySessions = Math.max(local.todaySessions || 0, servidor.todaySessions || 0);
  } else {
    var maisNovo = (local.sessionDate || '') > (servidor.sessionDate || '') ? local : servidor;
    saida.sessionDate = maisNovo.sessionDate;
    saida.todaySessions = maisNovo.todaySessions || 0;
  }

  // streak: vale o registro do dia mais recente
  var sa = local.streak || {count:0,lastDay:null}, sbv = servidor.streak || {count:0,lastDay:null};
  saida.streak = ((sbv.lastDay || '') > (sa.lastDay || '')) ? sbv
               : ((sa.lastDay || '') > (sbv.lastDay || '')) ? sa
               : { count: Math.max(sa.count || 0, sbv.count || 0), lastDay: sa.lastDay || sbv.lastDay };

  // tarefas do dia: mesmo dia, o que foi feito em qualquer aparelho conta
  var da = local.diario, db = servidor.diario;
  if (da && db && da.data === db.data) {
    saida.diario = { data: da.data,
      leitura: !!(da.leitura || db.leitura),
      estudo:  !!(da.estudo  || db.estudo),
      grana:   !!(da.grana   || db.grana) };
  } else {
    saida.diario = ((da && da.data) || '') >= ((db && db.data) || '') ? da : db;
  }
  return saida;
}

// ─── 1. Salvamento com guarda de versao ──────────────────
async function salvarNoServidor(){
  var novoRev = agoraISO();
  var corpo = { data: state, updated_at: novoRev };
  var res;
  if (revLocal) {
    res = await sb.from('user_data').update(corpo)
            .eq('user_id', currentUser.id).eq('updated_at', revLocal).select('updated_at');
  } else {
    res = await sb.from('user_data')
            .upsert(Object.assign({ user_id: currentUser.id }, corpo), { onConflict: 'user_id' })
            .select('updated_at');
  }
  if (res.error) return { ok:false, motivo:'rede', erro:res.error };
  if (!res.data || res.data.length === 0) return { ok:false, motivo:'conflito' };
  revLocal = novoRev; guardarRev(); fixarSombra(); pendente = false;
  return { ok:true, novoRev:novoRev };
}

async function resolverConflito(){
  var res = await sb.from('user_data').select('data,updated_at').eq('user_id', currentUser.id).single();
  if (res.error || !res.data) return { ok:false, motivo:'rede' };
  var doServidor = res.data.data || {};
  state = mesclar(state, doServidor);
  if (state.metas) state.metas.forEach(function(m){ m._type = 'meta'; });
  if (state.tasks) state.tasks.forEach(function(t){ t._type = 'task'; });
  revLocal = res.data.updated_at; guardarRev();
  var r = await salvarNoServidor();
  if (r.ok) r.mesclou = true;
  return r;
}

// Ponto unico de gravacao. Serializa as chamadas para nao correrem juntas.
function gravar(){
  salvando = (salvando || Promise.resolve()).then(async function(){
    marcarMudancas();
    guardarLocal();
    if (!currentUser) return { ok:false, motivo:'sem-login' };
    if (!navigator.onLine) { pendente = true; statusSync('offline'); return { ok:false, motivo:'offline' }; }
    statusSync('salvando');
    var r = await salvarNoServidor();
    if (!r.ok && r.motivo === 'conflito') r = await resolverConflito();
    if (r.ok) {
      statusSync('salvo');
      if (r.mesclou) {
        if (typeof renderHome === 'function' && document.getElementById('home-today-list')) renderHome();
        if (typeof toast === 'function') toast(T('mesclado'));
      }
    } else {
      pendente = true;
      statusSync(navigator.onLine ? 'erro' : 'offline');
    }
    return r;
  }).catch(function(e){
    console.error('sync:', e); pendente = true; statusSync('erro');
    return { ok:false, motivo:'excecao' };
  });
  return salvando;
}

// Chamado ao voltar a ficar online e na abertura do app.
async function sincronizar(){
  if (!currentUser || !navigator.onLine) return;
  if (!pendente) {
    // Sem mudanca local: so confere se o servidor tem algo mais novo.
    var res = await sb.from('user_data').select('data,updated_at').eq('user_id', currentUser.id).single();
    if (res.error || !res.data) return;
    if (res.data.updated_at !== revLocal) {
      state = mesclar(state, res.data.data || {});
      if (state.metas) state.metas.forEach(function(m){ m._type = 'meta'; });
      if (state.tasks) state.tasks.forEach(function(t){ t._type = 'task'; });
      revLocal = res.data.updated_at; guardarRev(); fixarSombra(); guardarLocal();
      if (typeof renderHome === 'function' && document.getElementById('home-today-list')) renderHome();
      statusSync('salvo');
    }
    return;
  }
  await gravar();
}

// ─── Indicador de estado ─────────────────────────────────
function statusSync(estado){
  var el = document.getElementById('sync-status');
  if (!el) return;
  var mapa = {
    salvando: ['sincronizando', T('sincronizando')],
    salvo:    ['ok',            T('salvo')],
    offline:  ['offline',       T('offline')],
    erro:     ['erro',          T('erroSalvar')]
  };
  var m = mapa[estado] || mapa.salvo;
  el.className = 'sync-status ' + m[0];
  el.textContent = m[1];
  // No erro, oferecer saida: informar a falha sem dar o que fazer deixa o
  // usuario sem acao a nao ser recarregar e torcer.
  if (estado === 'erro') {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sync-retry';
    b.textContent = T('reenviar');
    b.onclick = function(){ statusSync('salvando'); sincronizar(); };
    el.appendChild(b);
  }
  el.style.display = (estado === 'salvo') ? 'none' : 'flex';
}

window.addEventListener('online',  function(){ statusSync('salvando'); sincronizar(); });
window.addEventListener('offline', function(){ statusSync('offline'); });
