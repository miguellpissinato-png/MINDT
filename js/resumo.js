// RESUMO — visao consolidada, recortada pelo periodo escolhido.
//
// Os numeros saem das mesmas funcoes que o Resumo de atividades usa
// (js/relatorio.js). Ter duas contagens da mesma coisa, uma para a tela e
// outra para o PDF, e o comeco de elas divergirem.

var RES_QUANDO = {semana:'nesta semana', mes:'neste mês', ano:'neste ano'};

function resTrocarPeriodo(tipo){
  relPeriodoAtual = tipo;
  renderResumo();
}

function renderResumo(){
  if(!document.getElementById('res-total-tasks')) return;
  var p = relPeriodo(relPeriodoAtual);

  // Qual botao de periodo esta ligado.
  var botoes = document.querySelectorAll('#page-resumo .aba');
  var tipos = ['semana','mes','ano'];
  for(var i = 0; i < botoes.length; i++){
    botoes[i].setAttribute('aria-pressed', String(tipos[i] === relPeriodoAtual));
  }
  var ta = relTarefas(p), me = relMetas(p), ga = relGastos(p);

  // O numero grande: quanto das tarefas criadas no periodo ja foi feito.
  // Uma recorrente conta cada conclusao, entao o teto e 100%.
  var pct = ta.criadas ? Math.min(100, Math.round(ta.feitas / ta.criadas * 100)) : (ta.feitas ? 100 : 0);
  var DO_PERIODO = {semana:'desta semana', mes:'de ' + REL_MESES[p.inicio.getMonth()], ano:'de ' + p.inicio.getFullYear()};
  texto('res-hero', pct + '%');
  var sub = document.getElementById('res-subtitulo');
  if(sub) sub.textContent = ta.criadas || ta.feitas
    ? 'das tarefas ' + DO_PERIODO[relPeriodoAtual] + ' concluídas'
    : 'Nenhuma tarefa ' + RES_QUANDO[relPeriodoAtual] + ' ainda';

  texto('res-total-tasks', ta.criadas);
  texto('res-nota-tasks',  p.intervalo);
  texto('res-done-tasks',  ta.feitas);
  texto('res-nota-done',   ta.abertas + ' ainda em aberto');
  texto('res-total-metas', me.ativas);
  texto('res-nota-metas',  me.vencendo ? me.vencendo + ' meta' + (me.vencendo > 1 ? 's vencem' : ' vence') + ' no período'
                                       : 'nenhuma meta vence no período');
  texto('res-gastos',      moeda(ga.total));
  texto('res-nota-gastos', ga.lancamentos + (ga.lancamentos === 1 ? ' lançamento' : ' lançamentos'));

  // Pendencias: tarefas em aberto, com o prazo em palavras. O ponto fica
  // vermelho no que ja venceu e laranja no que vence hoje.
  var pend = document.getElementById('res-pendencias');
  if(pend){
    var hoje = hojeStr();
    pend.innerHTML = ta.lista.length
      ? ta.lista.map(function(t){
          var prazo = typeof prazoEmPalavras === 'function' ? prazoEmPalavras(t) : (t.deadline || '');
          var tom = !t.deadline ? '' : t.deadline < hoje ? ' atrasada' : t.deadline === hoje ? ' hoje' : '';
          return '<button type="button" class="res-pend-item' + tom + '" onclick="goToPage(\'tarefas\')">'
            + '<span class="res-pend-ponto" aria-hidden="true"></span>'
            + '<span class="res-pend-nome">' + esc(t.name || '') + '</span>'
            + (prazo ? '<span class="res-pend-prazo">' + esc(prazo.replace(/^Vence hoje$/, 'hoje')) + '</span>' : '')
            + '</button>';
        }).join('')
      : '<p class="md-meta">' + T('semPendencias') + '</p>';
  }

  var mp = document.getElementById('res-metas-progress');
  if(mp){
    mp.innerHTML = me.lista.length
      ? me.lista.map(function(m){
          return '<div class="res-meta"><div class="res-meta-topo">'
            + '<span>' + esc(m.nome) + '</span><b class="md-num">' + m.pct + '%</b></div>'
            + mdBarra(m.pct, '', 'md-pb--sm')
            + '</div>';
        }).join('')
      : '<p class="md-meta">Nenhuma meta ainda.</p>';
  }

  var np = document.getElementById('res-notas-preview');
  if(np){
    np.innerHTML = state.notas.slice(0, 3).map(function(n){
      return '<button type="button" class="res-nota" onclick="goToPage(\'notas\')">'
        + '<span class="res-nota-tit">' + esc(n.title || 'Sem título') + '</span>'
        + (n.body ? '<span class="md-meta">' + esc(n.body) + '</span>' : '')
        + '</button>';
    }).join('') || '<p class="md-meta">Nenhuma nota ainda.</p>';
  }
}

function texto(id, valor){
  var el = document.getElementById(id);
  if(el) el.textContent = String(valor);
}
