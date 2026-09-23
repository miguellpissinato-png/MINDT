// RECORRENCIA — tarefas que se repetem.
//
// UMA tarefa que volta, nunca copias. O fundador pediu assim, e o modelo de
// copias (o dos Ganhos, em financas.js) quebraria tres coisas: o limite do
// plano Free conta tarefas abertas, o "Previsto" em Gastos somaria o valor
// uma vez por copia, e o carrossel da Home encheria.
//
// Campos no proprio item de state.tasks:
//
//   recorrencia: {
//     tipo:      'diaria'|'semanal'|'mensal'|'anual'|'personalizada',
//     ancora:    'calendario'|'conclusao'   (so nos quatro basicos)
//     modo:      'dias'|'diaDoMes'           (so na personalizada)
//     intervalo: N    — dias no modo 'dias', meses no modo 'diaDoMes'
//     diaDoMes:  1..31
//     hora:      0..23 ou null
//     inicio:    'aaaa-mm-dd' — primeira vez; ancora do calendario
//   }
//   proxima:      'aaaa-mm-dd' — data do ciclo atual
//   proximaAntes: 'aaaa-mm-dd' — o ciclo de antes da ultima conclusao,
//                                 para desfazer um toque sem querer
//   conclusoes:   [ISO, ...]   — cada vez que foi concluida
//
// Ciclo de vida:
//   aguardando -> (chega a data e a hora) -> aberta
//   aberta     -> (chega a data seguinte sem ser feita) -> atrasada
//   aberta/atrasada -> (concluir) -> aguardando a proxima data FUTURA
//
// Concluir uma atrasada pula os ciclos perdidos: nada de fila de pendencias.
//
// DATAS: tudo em texto 'aaaa-mm-dd' local, e Date so com a ancora do meio-dia
// (T12:00:00). toISOString() devolve UTC e, no Brasil, depois das 21h ja
// aponta para o dia seguinte — ver o comentario em financas.js.
//
// Toda funcao que depende de "agora" recebe o instante como parametro
// opcional. E o que permite testar fevereiro, ano bissexto e virada de dia
// sem esperar o calendario.

// ─── Datas ──────────────────────────────────────────────────────────────

function recISO(d){
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function recData(iso){ return new Date(iso + 'T12:00:00'); }
function recSomaDias(iso, n){
  var d = recData(iso); d.setDate(d.getDate() + n); return recISO(d);
}
// Mes com dia-alvo. O dia 31 cai no ultimo dia de meses mais curtos (mesma
// regra de financas.js), e o dia-alvo e sempre o ORIGINAL: sem ele, 31/jan
// -> 28/fev -> 28/mar, e a tarefa ia escorregando mes a mes.
function recMesComDia(ano, mes, dia){
  var a = ano + Math.floor(mes / 12), m = ((mes % 12) + 12) % 12;
  var ultimo = new Date(a, m + 1, 0).getDate();
  return a + '-' + pad(m + 1) + '-' + pad(Math.min(dia, ultimo));
}
function recSomaMeses(iso, n, dia){
  var d = recData(iso);
  return recMesComDia(d.getFullYear(), d.getMonth() + n, dia || d.getDate());
}
function recDiasEntre(a, b){
  return Math.round((recData(b) - recData(a)) / 86400000);
}
function recDDMM(iso){
  if(!iso) return '';
  var p = iso.split('-'); return p[2] + '/' + p[1];
}

// ─── A regra ────────────────────────────────────────────────────────────

// Tamanho do passo: {unidade:'dia'|'mes', n}
function recPasso(r){
  switch(r.tipo){
    case 'diaria':  return {unidade:'dia', n:1};
    case 'semanal': return {unidade:'dia', n:7};
    case 'mensal':  return {unidade:'mes', n:1};
    case 'anual':   return {unidade:'mes', n:12};
    case 'personalizada':
      var n = Math.max(1, parseInt(r.intervalo, 10) || 1);
      return r.modo === 'diaDoMes' ? {unidade:'mes', n:n} : {unidade:'dia', n:n};
  }
  return {unidade:'dia', n:1};
}
// Na personalizada o modo ja decide: "a cada N dias" conta de quando foi
// concluida; "dia X a cada N meses" e data fixa.
function recAncora(r){
  if(r.tipo === 'personalizada') return r.modo === 'diaDoMes' ? 'calendario' : 'conclusao';
  return r.ancora === 'conclusao' ? 'conclusao' : 'calendario';
}
function recDiaAlvo(r){
  if(r.tipo === 'personalizada' && r.modo === 'diaDoMes'){
    return Math.min(31, Math.max(1, parseInt(r.diaDoMes, 10) || 1));
  }
  return recData(r.inicio).getDate();
}

// k-esimo "encontro" marcado no calendario, a partir de inicio.
function recSlot(r, k){
  var p = recPasso(r);
  if(p.unidade === 'dia') return recSomaDias(r.inicio, k * p.n);
  var d = recData(r.inicio);
  return recMesComDia(d.getFullYear(), d.getMonth() + k * p.n, recDiaAlvo(r));
}

// Primeiro encontro do calendario que seja >= data (ou > data, se estrito).
// Calculo direto, sem percorrer um por um: uma tarefa diaria criada ha dois
// anos nao pode custar 730 voltas a cada pintura da tela.
function recSlotDesde(r, data, estrito){
  var p = recPasso(r), k;
  if(p.unidade === 'dia'){
    var dif = recDiasEntre(r.inicio, data);
    k = estrito ? Math.floor(dif / p.n) + 1 : Math.ceil(dif / p.n);
    return recSlot(r, Math.max(0, k));
  }
  var a = recData(r.inicio), b = recData(data);
  var meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  k = Math.max(0, Math.floor(meses / p.n) - 1);
  for(var i = 0; i < 4; i++, k++){
    var s = recSlot(r, k);
    if(estrito ? s > data : s >= data) return s;
  }
  return recSlot(r, k);
}

// Um passo depois de uma data, andando a partir DELA (ancora conclusao).
function recUmPassoDepois(r, data){
  var p = recPasso(r);
  return p.unidade === 'dia' ? recSomaDias(data, p.n) : recSomaMeses(data, p.n);
}

// A data do ciclo seguinte ao atual — e o marco do "atrasada".
function recCicloSeguinte(t){
  var r = t.recorrencia;
  return recAncora(r) === 'calendario'
    ? recSlotDesde(r, t.proxima, true)
    : recUmPassoDepois(r, t.proxima);
}

// Para onde vai a tarefa concluida hoje: sempre para o FUTURO.
function recProximaDepoisDe(r, hoje){
  return recAncora(r) === 'calendario'
    ? recSlotDesde(r, hoje, true)
    : recUmPassoDepois(r, hoje);
}

// Primeiro ciclo de uma regra nova (ou trocada). Inclui hoje.
function recPrimeiraProxima(r, hoje){
  var desde = r.inicio > hoje ? r.inicio : hoje;
  return recAncora(r) === 'calendario' ? recSlotDesde(r, desde, false) : desde;
}

// ─── Estado ─────────────────────────────────────────────────────────────

// A data (e a hora, se houver) do ciclo atual ja chegou?
function recChegou(t, agora){
  agora = agora || new Date();
  var hoje = recISO(agora);
  if(hoje > t.proxima) return true;
  if(hoje < t.proxima) return false;
  var h = t.recorrencia.hora;
  return h === null || h === undefined || h === '' || agora.getHours() >= Number(h);
}

// 'aguardando' | 'aberta' | 'atrasada' — ou null para tarefa comum.
function estadoDaRecorrencia(t, agora){
  if(!t || !t.recorrencia || !t.proxima) return null;
  agora = agora || new Date();
  if(!recChegou(t, agora)) return 'aguardando';
  // Chegou. Se ainda consta como feita, e o ciclo anterior — a checagem
  // abaixo reabre; ate la, para quem olha, ela ja esta aberta.
  return recISO(agora) >= recCicloSeguinte(t) ? 'atrasada' : 'aberta';
}

// Tarefa aparece na grade principal e na Home? A que aguarda a proxima
// data some: ela so existe, por enquanto, na aba Recorrentes.
function tarefaVisivel(t, agora){
  return estadoDaRecorrencia(t, agora) !== 'aguardando';
}

// Reabre as tarefas cujo ciclo chegou. Idempotente: rodar de novo nao muda
// nada. Devolve se mudou algo, para quem chamou decidir se salva.
function atualizarTarefasRecorrentes(agora){
  agora = agora || new Date();
  var mudou = false;
  (state.tasks || []).forEach(function(t){
    if(!t.recorrencia || !t.proxima || !t.done) return;
    if(!recChegou(t, agora)) return;
    t.done = false;
    t.completedAt = null;
    mudou = true;
  });
  return mudou;
}

// ─── Acoes ──────────────────────────────────────────────────────────────

function concluirRecorrente(t, agora){
  agora = agora || new Date();
  var hoje = recISO(agora);
  if(!Array.isArray(t.conclusoes)) t.conclusoes = [];
  t.conclusoes.push(agora.toISOString());
  t.proximaAntes = t.proxima;
  t.proxima = recProximaDepoisDe(t.recorrencia, hoje);
  t.done = true;
  t.completedAt = agora.toISOString();
}

// Desfaz a ultima conclusao — so enquanto a tarefa ainda aguarda o ciclo
// que essa conclusao criou.
function podeDesfazerConclusao(t){
  return !!(t && t.recorrencia && t.done && t.proximaAntes &&
            Array.isArray(t.conclusoes) && t.conclusoes.length);
}
function desfazerConclusao(t){
  if(!podeDesfazerConclusao(t)) return false;
  t.conclusoes.pop();
  t.proxima = t.proximaAntes;
  delete t.proximaAntes;
  t.done = false;
  t.completedAt = null;
  return true;
}

// Liga, troca ou mantem a regra de uma tarefa. Chamado pelo formulario.
function aplicarRecorrencia(t, r, agora){
  agora = agora || new Date();
  var hoje = recISO(agora);
  var antes = t.recorrencia ? JSON.stringify(t.recorrencia) : null;
  var mudou = antes !== JSON.stringify(r);
  // Tarefa comum que ja tinha sido feita: a conclusao antiga entra no
  // historico, senao ela deixaria de contar ao virar recorrente.
  if(!Array.isArray(t.conclusoes)) t.conclusoes = (t.done && t.completedAt) ? [t.completedAt] : [];
  t.recorrencia = r;
  if(!mudou && t.proxima) return;
  // Feita e esperando: a regra nova vale a partir de AMANHA, senao trocar a
  // hora faria ela reaparecer no mesmo dia em que acabou de ser concluida.
  t.proxima = t.done ? recProximaDepoisDe(r, hoje) : recPrimeiraProxima(r, hoje);
  delete t.proximaAntes;
}

// Deixa de repetir. As conclusoes ficam: o que foi feito continua contado.
function pararDeRepetir(t){
  delete t.recorrencia;
  delete t.proxima;
  delete t.proximaAntes;
}

// ─── Leitura ────────────────────────────────────────────────────────────

// Todas as vezes em que a tarefa foi concluida. Tarefa comum: a unica
// conclusao, se houver — o comportamento de sempre.
function conclusoesDaTarefa(t){
  if(Array.isArray(t.conclusoes)) return t.conclusoes;
  return (t.done && t.completedAt) ? [t.completedAt] : [];
}

var REC_SEMANA = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

function regraEmPalavras(r){
  if(!r) return '';
  var ancora = recAncora(r), p = recPasso(r), txt;
  if(r.tipo === 'personalizada'){
    if(r.modo === 'diaDoMes'){
      txt = 'Todo dia ' + recDiaAlvo(r) + (p.n > 1 ? ', a cada ' + p.n + ' meses' : '');
    } else {
      txt = p.n === 1 ? '1 dia depois de concluir' : p.n + ' dias depois de concluir';
    }
  } else if(ancora === 'conclusao'){
    txt = {diaria:'1 dia', semanal:'1 semana', mensal:'1 mês', anual:'1 ano'}[r.tipo] + ' depois de concluir';
  } else {
    var d = recData(r.inicio);
    txt = {
      diaria:  'Todo dia',
      semanal: (d.getDay() === 0 || d.getDay() === 6 ? 'Todo ' : 'Toda ') + REC_SEMANA[d.getDay()],
      mensal:  'Todo dia ' + d.getDate(),
      anual:   'Todo ano em ' + recDDMM(r.inicio)
    }[r.tipo];
  }
  if(r.hora !== null && r.hora !== undefined && r.hora !== '') txt += ' · às ' + Number(r.hora) + 'h';
  return txt;
}

// Checagem ao voltar para o app: a tarefa das 8h tem que aparecer mesmo se
// a aba ficou aberta desde ontem.
function checarRecorrentesAgora(){
  if(!currentUser || !state || !state.tasks) return;
  if(atualizarTarefasRecorrentes()){
    saveState();
    if(typeof renderTasks === 'function') renderTasks();
    if(typeof renderHome === 'function') renderHome();
  }
}
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible') checarRecorrentesAgora();
});
window.addEventListener('focus', checarRecorrentesAgora);
