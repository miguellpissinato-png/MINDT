// PERFIL — dados do usuario, avatar e grupos.

// PERFIL
function renderPerfil(){
  if(!document.getElementById('perfil-name-display')) return;
  montarHorasLembrete();
  if(typeof pintarLembrete==='function') pintarLembrete();
  if(typeof pintarAmizadesPerfil==='function') pintarAmizadesPerfil();
  if(typeof carregarNozes==='function') carregarNozes();   // saldo do bloco "Suas nozes"
  document.getElementById('perfil-name-display').textContent=state.perfil.name||'Meu Nome';
  document.getElementById('perfil-name-input').value=state.perfil.name||'';
  pintarCabecalhoPerfil();
  var list=document.getElementById('grupos-list');
  if(!state.grupos.length){list.innerHTML='<li class="md-lista-item md-meta">Nenhum grupo ainda. Grupos servem para juntar metas e tarefas de um mesmo assunto.</li>';return;}
  list.innerHTML=state.grupos.map(function(g,i){
    return '<li class="md-lista-item grupo-item"><span class="pf-li-ic">'+ico('list',18,2)+'</span><span class="grupo-name">'+esc(g)+'</span>'
      +'<button type="button" class="md-btn md-btn--secondary md-btn--icon md-btn--sm pf-grupo-x" onclick="deleteGrupo('+i+')" aria-label="Excluir o grupo '+esc(g)+'">'+ico('trash',18,2)+'</button></li>';
  }).join('');
}

// Cabecalho e numeros do Perfil (Design System 2): foto ou Ticolino, o selo
// do plano, @nick e desde quando a pessoa usa o Mindt, e os quatro numeros.
function pintarCabecalhoPerfil(){
  var img=document.getElementById('avatar-img'), tico=document.getElementById('avatar-emoji');
  if(state.perfil.avatar){ img.src=state.perfil.avatar; img.style.display=''; tico.style.display='none'; }
  else { img.style.display='none'; tico.style.display=''; tico.innerHTML=ticolino('orgulhoso',124); }

  var plano = typeof planoAtivo==='function' ? planoAtivo() : 'free';
  var selo=document.getElementById('pf-plano');
  if(selo){ selo.hidden = plano==='free'; selo.textContent = plano==='max' ? 'MAX' : 'PRO'; }
  var pn=document.getElementById('pf-plano-nome');
  if(pn && typeof PLANOS!=='undefined' && PLANOS[plano]) pn.textContent=PLANOS[plano].nome;

  var partes=[];
  var nick = (typeof AMZ!=='undefined' && AMZ.perfil && AMZ.perfil.nick) ? '@'+AMZ.perfil.nick : (currentUser ? currentUser.email : '');
  if(nick) partes.push(nick);
  if(currentUser && currentUser.created_at){
    var d=new Date(currentUser.created_at);
    if(!isNaN(d)) partes.push('no Mindt desde ' + d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));
  }
  document.getElementById('perfil-email-display').textContent=partes.join(' · ');

  var of = typeof ofensivaAtual==='function' ? ofensivaAtual() : ((state.streak && state.streak.count) || 0);
  texto('pf-ofensiva', of + (of===1 ? ' dia' : ' dias'));
  var xp = typeof studyXP!=='undefined' ? studyXP : (state.studyXP||0);
  texto('pf-xp', xp.toLocaleString('pt-BR'));
  var nivel = Math.floor(xp/100)+1;
  texto('pf-nivel', 'Nível ' + nivel);
  texto('pf-nivel-sub', 'faltam ' + (100 - xp%100) + ' XP');
  var ics={'pf-ic-chama':icoChama(18),'pf-ic-xp':ico('star',18,2.2),'pf-ic-noz':(typeof NOZ_ICONE!=='undefined'?NOZ_ICONE:''),'pf-ic-nivel':ico('trophy',18,2.2)};
  Object.keys(ics).forEach(function(id){ var el=document.getElementById(id); if(el && !el.firstChild) el.innerHTML=ics[id]; });
  document.querySelectorAll('#page-perfil [data-ico]').forEach(function(el){ if(!el.firstChild) el.innerHTML=ico(el.dataset.ico,18,2); });
}
function pfIrAjustes(){
  perfilAba('conta');
  var el=document.getElementById('pf-ajustes');
  if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'start'});
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
