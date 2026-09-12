// HISTORICO — o diario do app, dia a dia.
//
// POR QUE ESTE ARQUIVO EXISTE
// O `state.diario` guarda os itens do dia so de HOJE: a meia-noite ele zera
// e nao sobra registro nenhum. O mesmo vale para o XP, que e um numero unico
// acumulado, e para as sessoes de estudo, que nao eram anotadas em lugar
// algum. Sem isso o Resumo de atividades nao teria como dizer quantos dias
// voce fechou no mes, nem desenhar a evolucao semana a semana.
//
// Entao este modulo guarda uma linha por dia, so com o que nao da para
// recalcular depois. Exercicios, gastos, leitura, agenda, tarefas, metas e
// notas ja carregam a propria data e NAO entram aqui: repetir o dado seria
// criar duas versoes da verdade.
//
// FORMATO — as chaves sao curtas de proposito. Todo o estado do usuario vai
// e volta do Supabase como um JSON so, entao cada caractere pesa:
//
//   state.historico = { '2026-09-12': { i:3, x:25, e:50 } }
//                                       │    │     └ minutos de estudo
//                                       │    └ XP ganho no dia
//                                       └ itens do dia fechados (0 a 4)
//
// Sao cerca de 30 caracteres por dia, ~11 KB por ano.

// Dois anos. Passado disso o registro nao serve a nenhum relatorio e so
// engorda o JSON que sobe a cada gravacao.
var HISTORICO_DIAS = 730;

function garantirHistorico(){
  if(!state.historico || typeof state.historico !== 'object') state.historico = {};
  return state.historico;
}

// A linha de um dia, criada na hora se ainda nao existir.
function linhaDoDia(dia){
  var h = garantirHistorico();
  if(!h[dia]) h[dia] = {i:0, x:0, e:0};
  return h[dia];
}

// Copia para o historico quantos itens do dia estao fechados agora. E
// idempotente: chamar duas vezes no mesmo dia nao soma nada, so reescreve.
function registrarItensDoDia(){
  if(typeof garantirDiario !== 'function') return;
  var d = garantirDiario();
  linhaDoDia(d.data).i = tarefasDoDiaFeitas();
  podarHistorico();
}

// XP e acumulativo: aqui interessa quanto entrou HOJE. Valores negativos
// (desmarcar um item devolve o XP) entram como estao, senao o dia fecharia
// com credito que o usuario nao tem mais.
function registrarXP(quanto){
  if(!quanto || typeof hojeStr !== 'function') return;
  var l = linhaDoDia(hojeStr());
  l.x = Math.max(0, (l.x || 0) + quanto);
}

function registrarEstudo(minutos){
  if(!minutos || minutos < 0 || typeof hojeStr !== 'function') return;
  var l = linhaDoDia(hojeStr());
  l.e = (l.e || 0) + Math.round(minutos);
}

function podarHistorico(){
  var h = garantirHistorico();
  var dias = Object.keys(h);
  if(dias.length <= HISTORICO_DIAS) return;
  dias.sort();
  dias.slice(0, dias.length - HISTORICO_DIAS).forEach(function(d){ delete h[d]; });
}

// ─── Leitura do historico ──────────────────────────────────────────────
// `de` e `ate` sao datas ISO (aaaa-mm-dd) e entram as duas no intervalo.
// Comparar texto ISO funciona como comparar data, e evita fuso horario.

function historicoNoPeriodo(de, ate){
  var h = garantirHistorico(), fora = [];
  Object.keys(h).forEach(function(dia){
    if(dia >= de && dia <= ate) fora.push({dia:dia, i:h[dia].i||0, x:h[dia].x||0, e:h[dia].e||0});
  });
  fora.sort(function(a,b){ return a.dia < b.dia ? -1 : 1; });
  return fora;
}

// Quantos dias do periodo tiveram os QUATRO itens marcados.
function diasFechados(de, ate){
  return historicoNoPeriodo(de, ate).filter(function(l){ return l.i >= 4; }).length;
}

// Percentual de itens do dia concluidos no periodo: o que foi marcado
// dividido por tudo que havia para marcar. Conta so os dias que ja
// passaram — incluir o resto do mes derrubaria o numero sem motivo.
function percentualItens(de, ate){
  var hoje = hojeStr();
  var ultimo = ate < hoje ? ate : hoje;
  var dias = diasEntre(de, ultimo);
  if(dias <= 0) return null;
  var marcados = historicoNoPeriodo(de, ultimo).reduce(function(s,l){ return s + l.i; }, 0);
  return Math.round((marcados / (dias * TAREFAS_DIA.length)) * 100);
}

function xpNoPeriodo(de, ate){
  return historicoNoPeriodo(de, ate).reduce(function(s,l){ return s + l.x; }, 0);
}

function minutosEstudoNoPeriodo(de, ate){
  return historicoNoPeriodo(de, ate).reduce(function(s,l){ return s + l.e; }, 0);
}

function diasEntre(de, ate){
  var a = new Date(de + 'T12:00:00'), b = new Date(ate + 'T12:00:00');
  return Math.round((b - a) / 86400000) + 1;
}
