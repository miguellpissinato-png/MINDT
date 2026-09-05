// RESUMO — visao consolidada.

// RESUMO
function renderResumo(){
  if(!document.getElementById('res-total-tasks')) return;
  document.getElementById('res-total-tasks').textContent=state.tasks.length;
  document.getElementById('res-done-tasks').textContent=state.tasks.filter(function(t){return t.done;}).length;
  document.getElementById('res-total-metas').textContent=state.metas.length;
  var totalGastos=(state.gastos||[]).reduce(function(s,g){return s+parseFloat(g.valor||0);},0);
  document.getElementById('res-gastos').textContent=moeda(totalGastos);
  var mp=document.getElementById('res-metas-progress');
  mp.innerHTML=state.metas.length?state.metas.map(function(m){var pct=calcProgress(m);return '<div class="group-bar-item"><div class="group-bar-header"><span>'+esc(m.name)+'</span><span>'+pct+'%</span></div><div class="progress-bar-track"><div class="progress-bar-fill" style="width:'+pct+'%"></div></div></div>';}).join(''):'<div style="color:var(--text-muted);font-size:13px">Nenhuma meta ainda.</div>';
  var np=document.getElementById('res-notas-preview');
  np.innerHTML=state.notas.slice(0,4).map(function(n){return '<div class="nota-card" style="flex:0 0 160px;cursor:pointer" onclick="goToPage(\'notas\')"><div class="nota-title">'+esc(n.title)+'</div><div class="nota-body">'+esc(n.body||'')+'</div></div>';}).join('')||'<div style="color:var(--text-muted);font-size:13px">Nenhuma nota ainda.</div>';
}
