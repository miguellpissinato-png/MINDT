// NOTAS — bloco de notas.

// NOTAS
// As notas nao tem assunto: o tom do cartao sai do id (sempre o mesmo para
// a mesma nota), so para a grade nao virar um bloco igual.
var NOTA_TONS = ['t-brand', 't-ink', 't-card', 'a-estudos', 'a-metas', 'a-dinheiro'];
function tomDaNota(n){
  var h = 0, id = String(n.id || '');
  for(var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return NOTA_TONS[Math.abs(h) % NOTA_TONS.length];
}
function dataCurtaNota(iso){
  if(!iso) return '';
  var d = new Date(iso), hoje = new Date(); hoje.setHours(0,0,0,0);
  var dia = new Date(d); dia.setHours(0,0,0,0);
  var dif = Math.round((hoje - dia) / 86400000);
  if(dif === 0) return 'Hoje';
  if(dif === 1) return 'Ontem';
  return d.getDate() + ' ' + d.toLocaleDateString('pt-BR', {month:'short'}).replace('.', '');
}
function renderNotas(){
  var board=document.getElementById('notas-board');
  if(!board) return;
  var total = state.notas.length;
  var sub = document.getElementById('notas-sub');
  if(sub) sub.textContent = total + (total === 1 ? ' nota' : ' notas');
  var busca = ((document.getElementById('notas-busca') || {}).value || '').trim().toLowerCase();
  var lista = state.notas.slice().sort(function(a,b){ return String(b.createdAt||'').localeCompare(String(a.createdAt||'')); });
  if(busca) lista = lista.filter(function(n){ return (String(n.title||'') + ' ' + String(n.body||'')).toLowerCase().indexOf(busca) !== -1; });
  if(!total){
    board.innerHTML = estadoVazio('lendo', 'Nenhuma nota ainda. Guarde uma ideia antes que ela fuja.',
      '<button type="button" class="md-btn md-btn--primary md-btn--sm" onclick="openModal(\'modal-add-nota\')">' + ico('plus',18,2.4) + 'Nova nota</button>');
    return;
  }
  if(!lista.length){
    board.innerHTML = estadoVazio('lendo', 'Nenhuma nota com “' + esc(busca) + '”.');
    return;
  }
  var sel = deleteMode.type === 'notas';
  board.innerHTML=lista.map(function(n){
    return '<div class="md-note ' + tomDaNota(n) + (sel ? ' selection-mode' : '') + '" role="button" tabindex="0" data-id="' + n.id + '"'
      + ' onclick="openNotaDetail(\'' + n.id + '\')" onkeydown="if(event.key===\'Enter\')openNotaDetail(\'' + n.id + '\')">'
      + '<input type="checkbox" class="select-checkbox" aria-label="Selecionar ' + esc(n.title) + '" onclick="event.stopPropagation()" onchange="toggleSelect(\'' + n.id + '\',this)">'
      + '<b>' + esc(n.title) + '</b>'
      + (n.body ? '<p>' + esc(n.body) + '</p>' : '')
      + '<small>' + esc(dataCurtaNota(n.createdAt)) + '</small></div>';
  }).join('');
}
function openNotaDetail(id){
  if(deleteMode.type==='notas'){var card=document.querySelector('.md-note[data-id="'+id+'"]');if(card){var cb=card.querySelector('.select-checkbox');cb.checked=!cb.checked;toggleSelect(id,cb);}return;}
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
