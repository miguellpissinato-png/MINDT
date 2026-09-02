// PERFIL — dados do usuario, avatar e grupos.

// PERFIL
function renderPerfil(){
  if(!document.getElementById('perfil-name-display')) return;
  document.getElementById('perfil-name-display').textContent=state.perfil.name||'Meu Nome';
  document.getElementById('perfil-name-input').value=state.perfil.name||'';
  document.getElementById('perfil-email-display').textContent=currentUser?currentUser.email:'';
  if(state.perfil.avatar){document.getElementById('avatar-img').src=state.perfil.avatar;document.getElementById('avatar-img').style.display='';document.getElementById('avatar-emoji').style.display='none';}
  var list=document.getElementById('grupos-list');
  if(!state.grupos.length){list.innerHTML='<li style="color:var(--text-muted);font-size:13px;padding:10px 0">Nenhum grupo ainda.</li>';return;}
  list.innerHTML=state.grupos.map(function(g,i){return '<li class="grupo-item"><span class="grupo-name">📁 '+esc(g)+'</span><div class="grupo-actions"><div class="icon-btn danger" onclick="deleteGrupo('+i+')">🗑</div></div></li>';}).join('');
}
function deleteGrupo(idx){
  var name=state.grupos[idx];
  document.getElementById('confirm-icon').textContent='🗑';document.getElementById('confirm-title').textContent='Excluir grupo';document.getElementById('confirm-body').textContent='Excluir o grupo "'+name+'"?';document.getElementById('confirm-ok-btn').textContent='Excluir';
  document.getElementById('confirm-ok-btn').onclick=function(){
    state.grupos.splice(idx,1);state.metas.forEach(function(m){if(m.group===name)m.group='';});state.tasks.forEach(function(t){if(t.group===name)t.group='';});
    saveState();closeModal('modal-confirm');renderPerfil();updateGroupSelects();toast('🗑 Grupo excluído!');resetConfirmBtn();
  };openModal('modal-confirm');
}
function handleAvatarChange(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){state.perfil.avatar=ev.target.result;saveState();renderPerfil();};r.readAsDataURL(file);}

function saveGrupo(){
  var name=document.getElementById('grupo-name').value.trim();if(!name){toast('⚠️ Informe um nome.');return;}
  if(state.grupos.indexOf(name)!==-1){toast('⚠️ Grupo já existe.');return;}
  state.grupos.push(name);saveState();closeModal('modal-add-grupo');document.getElementById('grupo-name').value='';updateGroupSelects();renderPerfil();toast('📁 Grupo criado!');
}
function savePerfil(){
  var name=document.getElementById('perfil-name-input').value.trim();if(name)state.perfil.name=name;
  saveState();closeModal('modal-edit-perfil');renderPerfil();toast('👤 Perfil atualizado!');
}
