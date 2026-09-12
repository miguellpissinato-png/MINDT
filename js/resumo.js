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
  var botoes = document.querySelectorAll('.res-periodo');
  var tipos = ['semana','mes','ano'];
  for(var i = 0; i < botoes.length; i++){
    botoes[i].setAttribute('aria-pressed', String(tipos[i] === relPeriodoAtual));
  }
  var sub = document.getElementById('res-subtitulo');
  if(sub) sub.textContent = 'Tudo que você moveu ' + RES_QUANDO[relPeriodoAtual] + ', num lugar só';

  var ta = relTarefas(p), me = relMetas(p), ga = relGastos(p);

  texto('res-total-tasks', ta.criadas);
  texto('res-nota-tasks',  p.intervalo);
  texto('res-done-tasks',  ta.feitas);
  texto('res-nota-done',   ta.abertas + ' ainda em aberto');
  texto('res-total-metas', me.ativas);
  texto('res-nota-metas',  me.vencendo ? me.vencendo + ' vence' + (me.vencendo > 1 ? 'm' : '') + ' no período'
                                       : 'nenhuma vence no período');
  texto('res-gastos',      moeda(ga.total));
  texto('res-nota-gastos', ga.lancamentos + (ga.lancamentos === 1 ? ' lançamento' : ' lançamentos'));

  // Pendencias: tarefas em aberto, com o prazo quando houver.
  var pend = document.getElementById('res-pendencias');
  if(pend){
    pend.innerHTML = ta.lista.length
      ? ta.lista.map(function(t){
          var prazo = t.deadline || t.prazo || '';
          return '<div class="res-pend-item">'
            + '<span class="res-pend-ponto"></span>'
            + '<span class="res-pend-nome">' + esc(t.name || '') + '</span>'
            + (prazo ? '<span class="res-pend-prazo">' + esc(prazo) + '</span>' : '')
            + '</div>';
        }).join('')
      : '<div class="res-pend-vazio">' + T('semPendencias') + '</div>';
  }

  var mp = document.getElementById('res-metas-progress');
  if(mp){
    mp.innerHTML = me.lista.length
      ? me.lista.map(function(m){
          return '<div class="group-bar-item"><div class="group-bar-header">'
            + '<span>' + esc(m.nome) + '</span><span>' + m.pct + '%</span></div>'
            + '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + m.pct + '%"></div></div>'
            + '</div>';
        }).join('')
      : '<div style="color:var(--text-muted);font-size:13px">Nenhuma meta ainda.</div>';
  }

  var np = document.getElementById('res-notas-preview');
  if(np){
    np.innerHTML = state.notas.slice(0, 4).map(function(n){
      return '<div class="nota-card" style="flex:0 0 160px;cursor:pointer" onclick="goToPage(\'notas\')">'
        + '<div class="nota-title">' + esc(n.title) + '</div>'
        + '<div class="nota-body">' + esc(n.body || '') + '</div></div>';
    }).join('') || '<div style="color:var(--text-muted);font-size:13px">Nenhuma nota ainda.</div>';
  }
}

function texto(id, valor){
  var el = document.getElementById(id);
  if(el) el.textContent = String(valor);
}
