// NOTAS — bloco de notas.

// NOTAS
function renderNotas(){
  var board=document.getElementById('notas-board');
  if(!board) return;
  if(!state.notas.length){board.innerHTML='<div class="empty-state" style="width:100%"><div class="empty-icon">📝</div><p>Nenhuma nota ainda. Use “+ Nova nota” para guardar uma ideia antes que ela fuja.</p></div>';return;}
  board.innerHTML=state.notas.map(function(n){
    return '<div class="nota-card'+(deleteMode.type==='notas'?' selection-mode':'')+'" data-id="'+n.id+'" onclick="openNotaDetail(\''+n.id+'\')">'+
      '<input type="checkbox" class="select-checkbox" style="'+(deleteMode.type==='notas'?'':'display:none')+'" onchange="toggleSelect(\''+n.id+'\',this)">'+
      '<div class="nota-title">'+esc(n.title)+'</div><div class="nota-body">'+esc(n.body||'')+'</div><div class="nota-date">'+formatDate(n.createdAt)+'</div></div>';
  }).join('');
}
function openNotaDetail(id){
  if(deleteMode.type==='notas'){var card=document.querySelector('.nota-card[data-id="'+id+'"]');if(card){var cb=card.querySelector('.select-checkbox');cb.checked=!cb.checked;toggleSelect(id,cb);}return;}
  currentNotaId=id;var n=state.notas.find(function(x){return x.id===id;});if(!n)return;
  document.getElementById('nota-detail-title').textContent=n.title;
  document.getElementById('nota-detail-body').textContent=n.body||'';
  document.getElementById('nota-detail-date').textContent='📅 '+formatDate(n.createdAt);
  openModal('modal-nota-detail');
}
function deleteCurrentNota(){
  var nota=(state.notas||[]).find(function(x){return x.id===currentNotaId;});
  document.getElementById('confirm-icon').textContent='🗑';
  document.getElementById('confirm-title').textContent='Excluir nota';
  document.getElementById('confirm-body').textContent = nota && nota.title
    ? 'Excluir "'+nota.title+'" de vez? Não dá para desfazer.'
    : 'Excluir esta nota de vez? Não dá para desfazer.';
  document.getElementById('confirm-ok-btn').textContent='Excluir';
  document.getElementById('confirm-ok-btn').onclick=function(){state.notas=state.notas.filter(function(n){return n.id!==currentNotaId;});saveState();closeModal('modal-confirm');closeModal('modal-nota-detail');renderNotas();toast('🗑 Nota excluída!');resetConfirmBtn();};
  openModal('modal-confirm');
}
function editCurrentNota(){
  var n=state.notas.find(function(x){return x.id===currentNotaId;});if(!n)return;
  document.getElementById('nota-title').value=n.title;document.getElementById('nota-body').value=n.body||'';document.getElementById('nota-modal-title').textContent='Editar nota';
  closeModal('modal-nota-detail');openModal('modal-add-nota');
}

function saveNota(){
  var title=document.getElementById('nota-title').value.trim(),body=document.getElementById('nota-body').value.trim();
  if(!title){toast('⚠️ Dê um título à nota.');return;}
  if(currentNotaId){var n=state.notas.find(function(x){return x.id===currentNotaId;});if(n){n.title=title;n.body=body;saveState();closeModal('modal-add-nota');renderNotas();toast('✏️ Nota atualizada!');currentNotaId=null;return;}}
  state.notas.push({id:uid(),title:title,body:body,createdAt:new Date().toISOString()});
  saveState();closeModal('modal-add-nota');document.getElementById('nota-title').value='';document.getElementById('nota-body').value='';document.getElementById('nota-modal-title').textContent='Nova nota';renderNotas();toast('📝 Nota criada!');
}
