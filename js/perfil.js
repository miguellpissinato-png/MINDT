// PERFIL — dados do usuario, avatar e grupos.

// PERFIL
function renderPerfil(){
  if(!document.getElementById('perfil-name-display')) return;
  montarHorasLembrete();
  if(typeof pintarLembrete==='function') pintarLembrete();
  document.getElementById('perfil-name-display').textContent=state.perfil.name||'Meu Nome';
  document.getElementById('perfil-name-input').value=state.perfil.name||'';
  document.getElementById('perfil-email-display').textContent=currentUser?currentUser.email:'';
  if(state.perfil.avatar){document.getElementById('avatar-img').src=state.perfil.avatar;document.getElementById('avatar-img').style.display='';document.getElementById('avatar-emoji').style.display='none';}
  var list=document.getElementById('grupos-list');
  if(!state.grupos.length){list.innerHTML='<li style="color:var(--text-muted);font-size:13px;padding:10px 0">Nenhum grupo ainda. Grupos servem para juntar metas e tarefas de um mesmo assunto.</li>';return;}
  list.innerHTML=state.grupos.map(function(g,i){return '<li class="grupo-item"><span class="grupo-name">📁 '+esc(g)+'</span><div class="grupo-actions"><div class="icon-btn danger" onclick="deleteGrupo('+i+')">🗑</div></div></li>';}).join('');
}
function deleteGrupo(idx){
  var name=state.grupos[idx];
  document.getElementById('confirm-icon').textContent='🗑';document.getElementById('confirm-title').textContent='Excluir grupo';document.getElementById('confirm-body').textContent='As metas e tarefas de "'+name+'" continuam existindo — só ficam sem grupo.';document.getElementById('confirm-ok-btn').textContent='Excluir';
  document.getElementById('confirm-ok-btn').onclick=function(){
    state.grupos.splice(idx,1);state.metas.forEach(function(m){if(m.group===name)m.group='';});state.tasks.forEach(function(t){if(t.group===name)t.group='';});
    saveState();closeModal('modal-confirm');renderPerfil();updateGroupSelects();toast('🗑 Grupo excluído!');resetConfirmBtn();
  };openModal('modal-confirm');
}
// A foto vai dentro dos dados da pessoa, que sobem inteiros a cada
// salvamento — por isso passa por reduzirImagem() (helpers.js): 320 px,
// recorte quadrado, ~30 KB.
function handleAvatarChange(e){
  var file = e.target.files[0]; e.target.value = '';
  if(!file) return;
  lerImagemReduzida(file, AVATAR_LADO, true, function(foto){
    if(!foto) return;
    state.perfil.avatar = foto; saveState(); renderPerfil();
    if(typeof renderHome === 'function') renderHome();
  });
}
var AVATAR_LADO = 320;
// Imagens salvas antes da reducao (foto de perfil, capas de metas, tarefas
// e livros): encolhe uma vez, na entrada.
function encolherImagensAntigas(){
  var a = state.perfil && state.perfil.avatar;
  if(a && typeof a === 'string'){
    if(!/^data:image\//.test(a)){ state.perfil.avatar = null; saveState(); }
    else if(a.length > 120000) reduzirImagem(a, AVATAR_LADO, true, function(foto){
      if(foto && foto.length < a.length){ state.perfil.avatar = foto; saveState(); renderPerfil(); }
    });
  }
  [['metas', 'img'], ['tasks', 'img'], ['livros', 'cover']].forEach(function(par){
    (state[par[0]] || []).forEach(function(item){
      var src = item && item[par[1]];
      if(typeof src !== 'string' || src.length < 200000 || !/^data:image\//.test(src)) return;
      reduzirImagem(src, IMAGEM_LADO, false, function(nova){
        if(nova && nova.length < src.length){ item[par[1]] = nova; saveState(); }
      });
    });
  });
}


function saveGrupo(){
  var name=document.getElementById('grupo-name').value.trim();if(!name){toast('⚠️ Dê um nome ao grupo.');return;}
  if(state.grupos.indexOf(name)!==-1){toast('⚠️ Já existe um grupo com esse nome.');return;}
  state.grupos.push(name);saveState();closeModal('modal-add-grupo');document.getElementById('grupo-name').value='';updateGroupSelects();renderPerfil();toast('📁 Grupo criado!');
}
function savePerfil(){
  var name=document.getElementById('perfil-name-input').value.trim();if(name)state.perfil.name=name;
  saveState();closeModal('modal-edit-perfil');renderPerfil();
  // O nome tambem aparece no cartao do menu lateral; sem isto ele so
  // mudava depois de abrir Estudos ou recarregar o app.
  if(typeof updateXPDisplay==='function') updateXPDisplay();
  toast('👤 Perfil atualizado!');
}

// As 24 horas do seletor de lembrete. Montadas em JavaScript para nao
// engordar o index.html com 24 linhas de <option>.
function montarHorasLembrete(){
  var sel = document.getElementById('lembrete-hora');
  if(!sel || sel.options.length) return;
  var html = '';
  for(var h = 0; h < 24; h++) html += '<option value="' + h + '">' + pad(h) + ':00</option>';
  sel.innerHTML = html;
}
