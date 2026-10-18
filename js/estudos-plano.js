// PLANO DE ESTUDOS — o que a pessoa vai estudar em cada dia da semana e
// quanto ja estudou de cada materia.
//
// POR QUE ESTE ARQUIVO EXISTE
// O plano aparece em tres lugares: no Quadro (onde e montado), na aba
// Estudos (onde o timer conta) e na Home (cartao de atalho e chamado do
// Ticolino). Os tres leem DAQUI. Se cada tela guardasse a sua copia, a
// pessoa mudaria a materia de terca no Quadro e a Home continuaria falando
// da antiga.
//
// FORMATO
//   state.planoEstudos = [{ id, dia, materia, min, inicio?, topico? }]
//     dia     0 = segunda ... 6 = domingo. O plano se repete toda semana.
//     min     tempo planejado em minutos (25, 50... sao pomodoros).
//     inicio  "10:00", opcional.     topico  "Freud", opcional.
//
//   state.sessoesEstudo = [{ id, data, materia, min, manual }]
//     Um item por DIA e MATERIA (nao por sessao): fica pequeno e o id e o
//     mesmo em qualquer aparelho, entao a mesclagem do sync.js junta certo.
//     min     minutos contados pelo timer.
//     manual  minutos marcados a mao no check do plano (estudou sem timer).
//
// As duas listas estao em COLECOES (sync.js): edicoes em aparelhos
// diferentes se juntam item por item, e o que foi apagado continua apagado.
//
// SEGURANCA: tudo que vem do estado e validado aqui antes de qualquer tela
// usar (tipos, tamanhos, ids). Texto da pessoa so entra na tela por esc().
// Nenhum onclick recebe texto digitado: so indices e ids validados.

var PLANO_MAX = 60;            // itens no plano da semana inteira
var SESSOES_DIAS = 120;        // quantos dias de sessoes guardar
var MATERIA_MAX = 40;
var TOPICO_MAX = 80;
var DIAS_SEMANA = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
var DIAS_CURTOS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
var DIAS_LETRA  = ['S','T','Q','Q','S','S','D'];

// ─── Utilidades pequenas (usadas tambem por quadro.js e atalhos.js) ──────
function idSeguro(v){ return (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v)) ? v : uid(); }
// Tira caracteres de controle e corta no tamanho. NAO escapa HTML: quem
// pinta usa esc(). Guardar ja escapado faria o texto aparecer com &amp;.
function textoLimpo(v, max){
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function isoDe(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function isoValido(v){ return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function idxDiaSemana(d){ return (d.getDay() + 6) % 7; }
function segundaDe(d){
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - idxDiaSemana(x));
  return x;
}
// A data (aaaa-mm-dd) do dia idx na semana de ref (hoje, sem ref).
function dataDaSemana(idx, ref){
  var s = segundaDe(ref || new Date());
  s.setDate(s.getDate() + idx);
  return isoDe(s);
}
function idxHoje(){ return idxDiaSemana(new Date()); }
function chaveMateria(m){ return textoLimpo(m, MATERIA_MAX).toLocaleLowerCase('pt-BR'); }
function horaValida(v){ return (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) ? v : ''; }

// 25, 50, 75... viram pomodoros; o resto, horas e minutos.
function tempoTxt(min){
  min = Math.max(0, Math.round(min || 0));
  if(min && min % 25 === 0) return plural(min / 25, 'pomodoro', 'pomodoros');
  if(min >= 60){
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }
  return min + ' min';
}
// "1 de 2 pomodoros", "40 de 60 min": o feito na mesma unidade do plano.
function progressoTxt(feito, plan){
  if(plan % 25 === 0) return Math.min(Math.floor(feito / 25), plan / 25) + ' de ' + plural(plan / 25, 'pomodoro', 'pomodoros');
  return Math.min(feito, plan) + ' de ' + plan + ' min';
}

// ─── Leitura e validacao do estado ───────────────────────────────────────
// A validacao roda uma vez por lista: quando o sync troca o state, a
// referencia muda e roda de novo. Sem isso cada pintura recriaria os itens.
var _planoRef = null, _sessRef = null;

function itemDoPlano(p){
  if(!p || typeof p !== 'object') return null;
  var dia = parseInt(p.dia, 10);
  var materia = textoLimpo(p.materia, MATERIA_MAX);
  var min = Math.round(Number(p.min));
  if(!(dia >= 0 && dia <= 6) || !materia || !(min >= 5 && min <= 600)) return null;
  var e = { id: idSeguro(p.id), dia: dia, materia: materia, min: min };
  var ini = horaValida(p.inicio); if(ini) e.inicio = ini;
  var top = textoLimpo(p.topico, TOPICO_MAX); if(top) e.topico = top;
  if(typeof p._upd === 'string') e._upd = p._upd;
  return e;
}

function garantirPlano(){
  if(state.planoEstudos && state.planoEstudos === _planoRef) return _planoRef;
  var vistos = {}, limpa = [];
  (Array.isArray(state.planoEstudos) ? state.planoEstudos : []).forEach(function(p){
    var e = itemDoPlano(p);
    if(!e) return;
    if(vistos[e.id]) e.id = uid();
    vistos[e.id] = 1;
    limpa.push(e);
  });
  state.planoEstudos = _planoRef = limpa.slice(0, PLANO_MAX);
  return _planoRef;
}

function garantirSessoes(){
  if(state.sessoesEstudo && state.sessoesEstudo === _sessRef) return _sessRef;
  var corte = isoDe(new Date(Date.now() - SESSOES_DIAS * 86400000));
  var vistos = {}, limpa = [];
  (Array.isArray(state.sessoesEstudo) ? state.sessoesEstudo : []).forEach(function(s){
    if(!s || typeof s !== 'object' || !isoValido(s.data) || s.data < corte) return;
    var materia = textoLimpo(s.materia, MATERIA_MAX);
    var min = Math.max(0, Math.min(1440, Math.round(Number(s.min) || 0)));
    var manual = Math.max(0, Math.min(1440, Math.round(Number(s.manual) || 0)));
    if(!materia || (!min && !manual)) return;
    var id = idSeguro(s.id);
    if(vistos[id]) return;
    vistos[id] = 1;
    var e = { id: id, data: s.data, materia: materia, min: min, manual: manual };
    if(typeof s._upd === 'string') e._upd = s._upd;
    limpa.push(e);
  });
  state.sessoesEstudo = _sessRef = limpa;
  return _sessRef;
}

// O id de uma sessao e o mesmo em qualquer aparelho: dia + materia.
function idSessao(iso, materia){
  var k = chaveMateria(materia), h = 5381;
  for(var i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0;
  return 's' + iso.replace(/-/g, '') + h.toString(36);
}
// Acha pelo dia + materia (e nao so pelo id): um item gravado por outra
// versao, ou importado, com id diferente, continua sendo encontrado.
function sessoesDoDia(iso, materia){
  var k = chaveMateria(materia);
  return garantirSessoes().filter(function(s){ return s.data === iso && chaveMateria(s.materia) === k; });
}
function sessaoDe(iso, materia, criar){
  var achadas = sessoesDoDia(iso, materia), id = idSessao(iso, materia);
  for(var i = 0; i < achadas.length; i++) if(achadas[i].id === id) return achadas[i];
  if(achadas.length) return achadas[0];
  if(!criar) return null;
  var s = { id: id, data: iso, materia: textoLimpo(materia, MATERIA_MAX), min: 0, manual: 0 };
  garantirSessoes().push(s);
  return s;
}
function minutosEstudados(materia, iso){
  return sessoesDoDia(iso, materia).reduce(function(t, s){ return t + (s.min || 0) + (s.manual || 0); }, 0);
}

// ─── Consultas ───────────────────────────────────────────────────────────
function planoDoDia(idx){
  return garantirPlano().filter(function(p){ return p.dia === idx; }).sort(function(a, b){
    var ha = a.inicio || '99:99', hb = b.inicio || '99:99';
    if(ha !== hb) return ha < hb ? -1 : 1;
    return a.materia.localeCompare(b.materia, 'pt-BR');
  });
}

// O dia agrupado por materia: Psicologia 10h e Psicologia 11h viram uma
// materia com 2 pomodoros, que e como o timer conta.
function resumoDoDia(idx, ref){
  var iso = dataDaSemana(idx, ref), grupos = {}, ordem = [];
  planoDoDia(idx).forEach(function(p){
    var k = chaveMateria(p.materia);
    if(!grupos[k]){ grupos[k] = { materia: p.materia, plan: 0, itens: [] }; ordem.push(k); }
    grupos[k].plan += p.min;
    grupos[k].itens.push(p);
  });
  return ordem.map(function(k){
    var g = grupos[k];
    g.data = iso;
    g.feito = minutosEstudados(g.materia, iso);
    g.ok = g.feito >= g.plan;
    return g;
  });
}

// A semana em numeros: materia-dia planejadas e cumpridas, e minutos.
function resumoDaSemana(ref){
  var r = { metas: 0, ok: 0, plan: 0, feito: 0 };
  for(var i = 0; i < 7; i++){
    resumoDoDia(i, ref).forEach(function(g){
      r.metas++; if(g.ok) r.ok++;
      r.plan += g.plan; r.feito += Math.min(g.feito, g.plan);
    });
  }
  return r;
}

// A primeira materia de hoje que ainda falta. null se nao ha plano ou se
// tudo ja foi feito.
function materiaDeHoje(){
  var hoje = resumoDoDia(idxHoje());
  for(var i = 0; i < hoje.length; i++) if(!hoje[i].ok) return hoje[i];
  return null;
}

// Materias ja usadas, para sugerir ao digitar.
function materiasConhecidas(){
  var vistas = {}, lista = [];
  garantirPlano().concat(garantirSessoes()).forEach(function(p){
    var k = chaveMateria(p.materia);
    if(!vistas[k]){ vistas[k] = 1; lista.push(p.materia); }
  });
  return lista.sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
}

// ─── Timer da aba Estudos ligado a uma materia ───────────────────────────
var estMateria = null;   // materia que o timer esta contando agora

// Chamado por timerFinished() (estudos.js) quando a sessao vale como estudo.
function registrarSessaoMateria(minutos){
  if(!estMateria || !(minutos > 0)) return;
  var s = sessaoDe(hojeStr(), estMateria, true);
  s.min = Math.min(1440, (s.min || 0) + Math.round(minutos));
  if(typeof renderQuadro === 'function' && quadroVisivel()) renderQuadro();
}

function escolherMateriaTimer(m){
  estMateria = m ? textoLimpo(m, MATERIA_MAX) : null;
  pintarMateriaTimer();
}

// "Iniciar" do plano, do cartao da Home ou do chamado do Ticolino: abre
// Estudos com a materia escolhida e ja comeca um pomodoro de 25.
function iniciarMateria(m){
  if(typeof goToPage === 'function') goToPage('estudos');
  if(timerRunning){
    toast('Já tem uma sessão rolando. Termine ou pause antes de trocar de matéria.');
    return;
  }
  escolherMateriaTimer(m);
  setTimerPreset(25, document.querySelector('.timer-preset-btn'));
  startTimer();
}

// Os botoes recebem um indice, nunca o nome da materia: texto da pessoa
// dentro de onclick seria uma porta para injetar codigo.
var _materiasNaTela = [];
function materiaPorIndice(i){ return _materiasNaTela[i] || null; }
function iniciarMateriaIdx(i){ var m = materiaPorIndice(i); if(m) iniciarMateria(m); }
function escolherMateriaIdx(i){ var m = materiaPorIndice(i); if(m) escolherMateriaTimer(m); }
function guardarMateriaNaTela(m){
  var i = _materiasNaTela.indexOf(m);
  if(i === -1){ _materiasNaTela.push(m); i = _materiasNaTela.length - 1; }
  return i;
}

// Check do plano: estudou sem o timer. Marca o que falta como feito a mao;
// tocar de novo desfaz so o que foi marcado a mao (o timer nunca e apagado).
function alternarFeitoPlano(idx, gi){
  var iso = dataDaSemana(idx);
  if(iso > hojeStr()){ toast('Esse dia ainda não chegou.'); return; }
  var g = resumoDoDia(idx)[gi];
  if(!g) return;
  if(g.ok){
    var manuais = sessoesDoDia(iso, g.materia).filter(function(s){ return s.manual; });
    if(!manuais.length){ toast('Essa já foi contada pelo timer.'); return; }
    manuais.forEach(function(s){ s.manual = 0; });
  } else {
    var s = sessaoDe(iso, g.materia, true);
    s.manual = (s.manual || 0) + Math.max(0, g.plan - g.feito);
  }
  saveState();
  repintarPlano();
}

// ─── Pinturas na aba Estudos ─────────────────────────────────────────────
function pintarMateriaTimer(){
  var el = document.getElementById('est-materia');
  if(!el) return;
  var hoje = materiaDeHoje();
  if(estMateria){
    el.hidden = false;
    el.innerHTML = '<span class="est-materia-txt">Estudando: <b>' + esc(estMateria) + '</b></span>'
      + '<button type="button" class="est-materia-x" onclick="escolherMateriaTimer(null)" aria-label="Estudar sem matéria">' + ico('close', 14, 2.6) + '</button>';
  } else if(hoje){
    el.hidden = false;
    el.innerHTML = '<button type="button" class="est-materia-bt" onclick="escolherMateriaIdx(' + guardarMateriaNaTela(hoje.materia) + ')">'
      + ico('estudos', 15, 2.4) + '<span>Hoje no seu quadro: <b>' + esc(hoje.materia) + '</b></span></button>';
  } else {
    el.hidden = true;
    el.innerHTML = '';
  }
}

function renderPlanoEstudos(){
  pintarMateriaTimer();
  var box = document.getElementById('est-plano');
  if(!box) return;
  box.innerHTML = htmlPlanoSemana('estudos');
}

// O mesmo desenho serve o bloco do Quadro e o cartao da aba Estudos.
// onde: 'quadro' mostra a semana inteira com check; 'estudos' mostra a
// faixa da semana e so o dia de hoje, com o botao de iniciar.
function htmlPlanoSemana(onde){
  var plano = garantirPlano(), ih = idxHoje();
  if(!plano.length){
    return '<div class="pl-vazio"><p>Diga o que você vai estudar em cada dia. O Ticolino lembra você na Home e o timer conta sozinho.</p>'
      + '<button type="button" class="md-btn md-btn--primary md-btn--sm" onclick="abrirEditorPlano(' + ih + ')">' + ico('plus', 16, 2.6) + 'Montar meu plano</button></div>';
  }
  var sem = resumoDaSemana(), h = '';
  if(onde === 'estudos'){
    h += '<div class="pl-topo"><h2>Plano desta semana</h2><button type="button" class="md-link-bt" onclick="abrirPlanoNoQuadro()">Editar no quadro</button></div>';
    h += '<div class="pl-faixa" role="list" aria-label="Semana">';
    for(var d = 0; d < 7; d++){
      var gs = resumoDoDia(d), cls = 'pl-cel', txt = '—', rot = DIAS_SEMANA[d] + ': ';
      if(gs.length){
        txt = esc(gs[0].materia.slice(0, 3).toUpperCase());
        var todos = gs.every(function(g){ return g.ok; });
        cls += todos ? ' ok' : (d < ih ? ' falta' : '');
        rot += gs.map(function(g){ return g.materia + (g.ok ? ' feito' : ''); }).join(', ');
      } else { cls += ' livre'; rot += 'livre'; }
      if(d === ih) cls += ' hoje';
      h += '<div class="pl-dia" role="listitem" aria-label="' + esc(rot) + '"><span class="' + cls + '">' + txt + '</span><small>' + DIAS_LETRA[d] + '</small></div>';
    }
    h += '</div>';
    var hoje = resumoDoDia(ih);
    if(hoje.length){
      h += '<div class="pl-hoje">' + hoje.map(function(g, gi){ return linhaMateria(ih, g, gi, true); }).join('') + '</div>';
    } else {
      h += '<p class="md-meta pl-livre">Hoje está livre no seu plano.</p>';
    }
  } else {
    h += '<div class="pl-lista">';
    for(var i = 0; i < 7; i++){
      var grupos = resumoDoDia(i);
      h += '<div class="pl-l' + (i === ih ? ' pl-l--hoje' : '') + '">'
        + '<button type="button" class="pl-d" onclick="abrirEditorPlano(' + i + ')" aria-label="Editar ' + DIAS_SEMANA[i] + '">' + DIAS_CURTOS[i] + '</button>'
        + '<div class="pl-ms">';
      if(!grupos.length){
        h += '<button type="button" class="pl-livre-bt" onclick="abrirEditorPlano(' + i + ')" aria-label="' + DIAS_SEMANA[i] + ' livre. Planejar">Livre' + ico('plus', 14, 2.6) + '</button>';
      } else {
        h += grupos.map(function(g, gi){ return linhaMateria(i, g, gi, i === ih); }).join('');
      }
      h += '</div></div>';
    }
    h += '</div>';
  }
  var pct = sem.plan ? Math.round(sem.feito / sem.plan * 100) : 0;
  h += mdBarra(pct, '', 'md-pb--sm t-estudos');
  h += '<p class="md-meta pl-pe">' + tempoCurto(sem.feito) + ' de ' + tempoCurto(sem.plan) + ' na semana · o timer de Estudos entra no plano sozinho</p>';
  return h;
}

function tempoCurto(min){
  min = Math.round(min || 0);
  if(min < 60) return min + ' min';
  var h = Math.floor(min / 60), m = min % 60;
  return h + ' h' + (m ? ' ' + m : '');
}

// Uma materia num dia: nome, horarios/topicos, progresso e a acao.
function linhaMateria(idx, g, gi, ehHoje){
  var detalhes = g.itens.map(function(p){
    return (p.inicio ? p.inicio + ' ' : '') + (p.topico || '');
  }).filter(function(t){ return t.trim(); });
  var acao = '';
  var podeMarcar = dataDaSemana(idx) <= hojeStr();
  // Hoje, ainda por fazer: o atalho para comecar o pomodoro.
  if(ehHoje && !g.ok){
    acao += '<button type="button" class="pl-play" onclick="iniciarMateriaIdx(' + guardarMateriaNaTela(g.materia) + ')" aria-label="Iniciar ' + esc(g.materia) + '">' + ico('play', 14, 2.4) + '</button>';
  }
  // O check: estudou sem o timer (hoje ou num dia que ja passou).
  if(podeMarcar){
    acao += '<button type="button" class="md-check md-check--sm' + (g.ok ? ' md-check--on' : '') + '" role="switch" aria-checked="' + g.ok + '"'
      + ' onclick="alternarFeitoPlano(' + idx + ',' + gi + ')" aria-label="' + esc(g.materia) + (g.ok ? ', feito' : ', marcar como feito') + '">' + ico('check', 16, 3) + '</button>';
  } else {
    acao += '<span class="pl-futuro" aria-hidden="true"></span>';
  }
  // O progresso vai na segunda linha, junto do horario e do topico: numa
  // coluna propria ele espremia o nome da materia ("Psicolo...").
  var quanto = g.ok ? tempoTxt(g.plan) + ' · feito'
    : (ehHoje || g.feito) ? progressoTxt(g.feito, g.plan) : tempoTxt(g.plan);
  return '<div class="pl-m' + (g.ok ? ' ok' : '') + '">'
    + '<div class="pl-m-txt"><span class="pl-s">' + esc(g.materia) + '</span>'
    + '<span class="pl-t"><span class="pl-q">' + quanto + '</span>' + (detalhes.length ? ' · ' + esc(detalhes.join(' · ')) : '') + '</span>'
    + '</div>' + acao + '</div>';
}

function repintarPlano(){
  if(typeof renderPlanoEstudos === 'function') renderPlanoEstudos();
  if(typeof renderQuadro === 'function' && quadroVisivel()) renderQuadro();
  if(typeof renderHome === 'function' && document.getElementById('home-today-list')) renderHome();
}

function abrirPlanoNoQuadro(){
  if(typeof garantirBlocoEstudos === 'function') garantirBlocoEstudos();
  goToPage('quadro');
}

// ─── Editor de um dia (modal-plano-dia) ──────────────────────────────────
var pdDia = 0;

var PD_TEMPOS = [
  [25,'1 pomodoro (25 min)'],[50,'2 pomodoros'],[75,'3 pomodoros'],[100,'4 pomodoros'],[150,'6 pomodoros'],
  [15,'15 min'],[30,'30 min'],[45,'45 min'],[60,'1 hora'],[90,'1 h 30'],[120,'2 horas'],[180,'3 horas']
];

function abrirEditorPlano(idx){
  pdDia = (idx >= 0 && idx <= 6) ? idx : idxHoje();
  var dl = document.getElementById('pd-materias');
  if(dl) dl.innerHTML = materiasConhecidas().map(function(m){ return '<option value="' + esc(m) + '"></option>'; }).join('');
  pintarEditorPlano();
  openModal('modal-plano-dia');
}

function pintarEditorPlano(){
  // Sabado e domingo sao masculinos: "todo domingo", "toda segunda".
  document.getElementById('pd-titulo').textContent = (pdDia >= 5 ? 'Todo ' : 'Toda ') + DIAS_SEMANA[pdDia].toLowerCase();
  document.getElementById('pd-dias').innerHTML = DIAS_CURTOS.map(function(n, i){
    return '<button type="button" class="md-chip" aria-pressed="' + (i === pdDia) + '" onclick="pdTrocarDia(' + i + ')">' + n + '</button>';
  }).join('');
  var itens = planoDoDia(pdDia);
  var box = document.getElementById('pd-lista');
  box.innerHTML = '';
  if(!itens.length) pdAdicionar();
  else itens.forEach(function(p){ box.appendChild(linhaEditor(p)); });
}

function opcoesTempo(sel){
  var tem = PD_TEMPOS.some(function(t){ return t[0] === sel; });
  var lista = tem || !sel ? PD_TEMPOS : PD_TEMPOS.concat([[sel, tempoTxt(sel)]]);
  return lista.map(function(t){ return '<option value="' + t[0] + '"' + (t[0] === sel ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('');
}

// Cada linha do editor e montada com DOM (nao com texto da pessoa dentro
// de HTML), e o valor vai nos campos pela propriedade .value.
function linhaEditor(p){
  var n = document.querySelectorAll('#pd-lista .pd-item').length + 1;
  var div = document.createElement('div');
  div.className = 'pd-item';
  if(p && p.id) div.dataset.id = p.id;
  div.innerHTML =
      '<div class="pd-linha">'
    +   '<div class="form-group pd-mat"><label class="form-label" for="pd-m' + n + '">Matéria</label>'
    +   '<input class="form-input" id="pd-m' + n + '" list="pd-materias" maxlength="' + MATERIA_MAX + '" placeholder="Ex.: Psicologia" autocomplete="off"></div>'
    +   '<button type="button" class="pd-tirar" onclick="pdTirar(this)" aria-label="Tirar esta matéria">' + ico('trash', 18, 2) + '</button>'
    + '</div>'
    + '<div class="pd-linha pd-linha--3">'
    +   '<div class="form-group"><label class="form-label" for="pd-q' + n + '">Quanto</label><select class="form-select" id="pd-q' + n + '">' + opcoesTempo(p ? p.min : 25) + '</select></div>'
    +   '<div class="form-group"><label class="form-label" for="pd-h' + n + '">Começa</label><input class="form-input" id="pd-h' + n + '" type="time"></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label" for="pd-t' + n + '">Tópico <span class="pd-opc">opcional</span></label>'
    +   '<input class="form-input" id="pd-t' + n + '" maxlength="' + TOPICO_MAX + '" placeholder="Ex.: Freud, terapia cognitivo-comportamental"></div>';
  if(p){
    div.querySelector('#pd-m' + n).value = p.materia || '';
    div.querySelector('#pd-h' + n).value = p.inicio || '';
    div.querySelector('#pd-t' + n).value = p.topico || '';
  }
  return div;
}

function pdAdicionar(){
  var box = document.getElementById('pd-lista');
  if(box.children.length >= 8){ toast('Até 8 matérias por dia.'); return; }
  var linha = linhaEditor(null);
  box.appendChild(linha);
  var campo = linha.querySelector('input');
  if(campo && document.getElementById('modal-plano-dia').classList.contains('open')) campo.focus();
}
function pdTirar(bt){
  var item = bt.closest('.pd-item');
  if(item) item.remove();
  if(!document.querySelectorAll('#pd-lista .pd-item').length) pdAdicionar();
}

// Le os campos do dia aberto. Devolve null (e avisa) se algo esta errado.
function pdLerDia(){
  var itens = [], erro = null;
  document.querySelectorAll('#pd-lista .pd-item').forEach(function(div){
    var campos = div.querySelectorAll('input, select');
    var materia = textoLimpo(campos[0].value, MATERIA_MAX);
    if(!materia) return;   // linha em branco: ignorada
    var e = itemDoPlano({
      id: div.dataset.id, dia: pdDia, materia: materia,
      min: parseInt(campos[1].value, 10), inicio: campos[2].value, topico: campos[3].value
    });
    if(!e){ erro = 'Confira o tempo de ' + materia + '.'; return; }
    itens.push(e);
  });
  if(erro){ toast(erro); return null; }
  return itens;
}

function pdGravarDia(){
  var itens = pdLerDia();
  if(!itens) return false;
  var outros = garantirPlano().filter(function(p){ return p.dia !== pdDia; });
  if(outros.length + itens.length > PLANO_MAX){
    toast('O plano da semana tem espaço para ' + PLANO_MAX + ' matérias.');
    return false;
  }
  // Mantem o objeto (e o id) de quem nao mudou: o sync so marca o que mudou.
  var antigos = {};
  garantirPlano().forEach(function(p){ antigos[p.id] = p; });
  var novos = itens.map(function(e){
    var a = antigos[e.id];
    if(a && a.dia === e.dia && a.materia === e.materia && a.min === e.min && (a.inicio || '') === (e.inicio || '') && (a.topico || '') === (e.topico || '')) return a;
    delete e._upd;
    return e;
  });
  state.planoEstudos = _planoRef = outros.concat(novos);
  return true;
}

// Trocar de dia grava o dia que estava aberto (e avisa). Guardar so na
// memoria e descartar no Cancelar deixaria um meio-termo: o dia trocado
// subiria no proximo salvamento qualquer do app, sem a pessoa ter salvo.
function pdTrocarDia(i){
  if(i === pdDia) return;
  if(!pdGravarDia()) return;
  saveState();
  repintarPlano();
  pdDia = i;
  pintarEditorPlano();
}

function pdSalvar(){
  if(!pdGravarDia()) return;
  saveState();
  closeModal('modal-plano-dia');
  if(typeof garantirBlocoEstudos === 'function') garantirBlocoEstudos();
  repintarPlano();
  toast('Plano salvo.');
}
