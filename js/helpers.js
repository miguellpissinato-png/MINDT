// HELPERS — funcoes utilitarias compartilhadas por varios modulos
// (selecao, checklist, grupos, estatisticas de periodo, modais, imagem,
//  formularios, utilitarios gerais e o canvas de fundo)

// SELECTION
function startDelete(type){deleteMode={type:type,selected:[]};if(type==='metas')renderMetas();else if(type==='tasks')renderTasks();else if(type==='notas')renderNotas();showSelBar(type,false);}
function startEdit(type){editMode={type:type};deleteMode={type:type,selected:[]};if(type==='metas')renderMetas();else if(type==='tasks')renderTasks();showSelBar(type,true);}
function toggleSelect(id,cb){if(cb.checked){if(deleteMode.selected.indexOf(id)===-1)deleteMode.selected.push(id);}else{deleteMode.selected=deleteMode.selected.filter(function(x){return x!==id;});}var el=document.getElementById('sel-count');if(el)el.textContent=deleteMode.selected.length+' selecionados';}
function showSelBar(type,isEdit){
  var ex=document.getElementById('sel-bar');if(ex)ex.remove();
  var bar=document.createElement('div');bar.id='sel-bar';
  bar.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:rgba(12,7,22,0.95);border:1px solid rgba(122,69,212,0.35);backdrop-filter:blur(20px);border-radius:14px;padding:14px 24px;display:flex;gap:12px;align-items:center;z-index:400;';
  bar.innerHTML='<span style="font-size:13px;color:var(--text-dim)" id="sel-count">0 selecionados</span>';
  var ab=document.createElement('button');ab.className='btn btn-sm '+(isEdit?'btn-primary':'btn-danger');ab.textContent=isEdit?'✏️ Editar':'🗑 Excluir';ab.onclick=function(){confirmSel(type,isEdit);};
  var cb=document.createElement('button');cb.className='btn btn-ghost btn-sm';cb.textContent='Cancelar';cb.onclick=function(){cancelSel(type);};
  bar.appendChild(ab);bar.appendChild(cb);document.body.appendChild(bar);
}
function confirmSel(type,isEdit){
  if(isEdit){
    if(deleteMode.selected.length!==1){toast('⚠️ Selecione exatamente 1 item.');return;}
    var id=deleteMode.selected[0];cancelSel(type);
    if(type==='metas'){var m=state.metas.find(function(x){return x.id===id;});if(m){populateMetaForm(m);openModal('modal-add-meta');}}
    else{var t=state.tasks.find(function(x){return x.id===id;});if(t){populateTaskForm(t);openModal('modal-add-task');}}
    return;
  }
  if(!deleteMode.selected.length){toast('⚠️ Selecione ao menos um item.');return;}
  document.getElementById('confirm-icon').textContent='🗑';document.getElementById('confirm-title').textContent='Excluir itens';document.getElementById('confirm-body').textContent='Excluir '+deleteMode.selected.length+' item(s)?';document.getElementById('confirm-ok-btn').textContent='Excluir';
  document.getElementById('confirm-ok-btn').onclick=function(){
    var sel=deleteMode.selected.slice();
    if(type==='metas')state.metas=state.metas.filter(function(m){return sel.indexOf(m.id)===-1;});
    else if(type==='tasks')state.tasks=state.tasks.filter(function(t){return sel.indexOf(t.id)===-1;});
    else if(type==='notas')state.notas=state.notas.filter(function(n){return sel.indexOf(n.id)===-1;});
    saveState();closeModal('modal-confirm');cancelSel(type);toast('🗑 Excluídos!');renderHome();resetConfirmBtn();
  };openModal('modal-confirm');
}
function cancelSel(type){deleteMode={type:null,selected:[]};editMode={type:null};var b=document.getElementById('sel-bar');if(b)b.remove();if(type==='metas')renderMetas();else if(type==='tasks')renderTasks();else if(type==='notas')renderNotas();}

// CHECKLIST
function addChecklistItem(listId,inputId,fillId,labelId){
  var input=document.getElementById(inputId),text=input.value.trim();if(!text)return;
  var list=document.getElementById(listId),li=document.createElement('li');li.className='checklist-item';
  var id='ci-'+uid();
  li.innerHTML='<input type="checkbox" id="'+id+'" onchange="updateChecklistProgress(\''+listId+'\',\''+fillId+'\',\''+labelId+'\')"><label for="'+id+'">'+esc(text)+'</label><button class="icon-btn danger" onclick="this.closest(\'li\').remove();updateChecklistProgress(\''+listId+'\',\''+fillId+'\',\''+labelId+'\')" style="margin-left:auto">✕</button>';
  list.appendChild(li);input.value='';updateChecklistProgress(listId,fillId,labelId);
}
function updateChecklistProgress(listId,fillId,labelId){
  var items=document.querySelectorAll('#'+listId+' .checklist-item');if(!items.length)return;
  var done=Array.from(items).filter(function(li){return li.querySelector('input').checked;}).length;
  var pct=Math.round((done/items.length)*100);
  var f=document.getElementById(fillId);if(f)f.style.width=pct+'%';var l=document.getElementById(labelId);if(l)l.textContent=pct+'%';
}

// GROUPS
function updateGroupSelects(){
  ['meta-group','task-group'].forEach(function(id){
    var sel=document.getElementById(id);if(!sel)return;var cur=sel.value;
    sel.innerHTML='<option value="">Sem grupo</option>'+state.grupos.map(function(g){return '<option value="'+esc(g)+'"'+(g===cur?' selected':'')+'>'+esc(g)+'</option>';}).join('');
  });
}
function updateGroupFilters(){
  var container=document.getElementById('metas-filter-row');if(!container)return;
  container.querySelectorAll('.group-filter-chip').forEach(function(c){c.remove();});
  state.grupos.forEach(function(g){
    var chip=document.createElement('div');chip.className='filter-chip group-filter-chip';chip.textContent='📁 '+g;
    var gCopy=g;chip.addEventListener('click',function(){document.querySelectorAll('#metas-filter-row .filter-chip').forEach(function(c){c.classList.remove('active');});chip.classList.add('active');renderMetas('all',gCopy);});
    container.appendChild(chip);
  });
}

// PERIOD STATS
function updatePeriodStats(type){
  var now=new Date(),todayStr=now.toDateString(),weekAgo=new Date(now-7*86400000),monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  var arr=type==='metas'?state.metas:state.tasks,done=arr.filter(function(i){return i.done&&i.completedAt;});
  var day=done.filter(function(i){return new Date(i.completedAt).toDateString()===todayStr;}).length;
  var week=done.filter(function(i){return new Date(i.completedAt)>=weekAgo;}).length;
  var month=done.filter(function(i){return new Date(i.completedAt)>=monthStart;}).length;
  var de=document.getElementById(type+'-done-day');if(de)de.textContent=day;
  var we=document.getElementById(type+'-done-week');if(we)we.textContent=week;
  var me=document.getElementById(type+'-done-month');if(me)me.textContent=month;
}

// MODALS
function openModal(id){
  updateGroupSelects();
  updateCategoriaSelect();
  document.getElementById(id).classList.add('open');
  if(id==='modal-add-categoria') renderCategoriasList();
  if(id==='modal-criar-evento'){ renderIconGrid(); updateParticipanteSelect(); }
  if(id==='modal-contatos') renderContatosLista();
  if(id==='modal-gerenciar-eventos') renderGerenciarLista();
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(function(overlay){overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal(overlay.id);});});
function resetConfirmBtn(){document.getElementById('confirm-ok-btn').textContent='Confirmar';document.getElementById('confirm-icon').textContent='⚠️';}

// IMAGE
function previewImg(e,divId,imgId){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){document.getElementById(divId).style.display='';document.getElementById(imgId).src=ev.target.result;};r.readAsDataURL(file);}

// FORM POPULATION
function populateMetaForm(m){
  currentDetailId=m.id;currentDetailType='meta';
  document.getElementById('meta-name').value=m.name;document.getElementById('meta-desc').value=m.desc||'';document.getElementById('meta-group').value=m.group||'';document.getElementById('meta-deadline').value=m.deadline||'';document.getElementById('meta-budget').value=m.budget||'';
  var cl=document.getElementById('meta-checklist');cl.innerHTML='';
  if(m.checklist)m.checklist.forEach(function(ci){var li=document.createElement('li');li.className='checklist-item';var id='ci-'+uid();li.innerHTML='<input type="checkbox" id="'+id+'" '+(ci.done?'checked':'')+' onchange="updateChecklistProgress(\'meta-checklist\',\'meta-progress-fill\',\'meta-progress-label\')"><label for="'+id+'">'+esc(ci.text)+'</label><button class="icon-btn danger" onclick="this.closest(\'li\').remove();updateChecklistProgress(\'meta-checklist\',\'meta-progress-fill\',\'meta-progress-label\')" style="margin-left:auto">✕</button>';cl.appendChild(li);});
  if(m.img){document.getElementById('meta-img-preview').style.display='';document.getElementById('meta-preview-img').src=m.img;}
}
function populateTaskForm(t){
  currentDetailId=t.id;currentDetailType='task';
  document.getElementById('task-name').value=t.name;document.getElementById('task-desc').value=t.desc||'';document.getElementById('task-group').value=t.group||'';document.getElementById('task-deadline').value=t.deadline||'';document.getElementById('task-budget').value=t.budget||'';
  if(t.img){document.getElementById('task-img-preview').style.display='';document.getElementById('task-preview-img').src=t.img;}
}
function resetMetaForm(){['meta-name','meta-desc','meta-deadline','meta-budget'].forEach(function(id){document.getElementById(id).value='';});document.getElementById('meta-img-preview').style.display='none';document.getElementById('meta-checklist').innerHTML='';document.getElementById('meta-progress-fill').style.width='0%';document.getElementById('meta-progress-label').textContent='0%';currentDetailId=null;}
function resetTaskForm(){['task-name','task-desc','task-deadline','task-budget'].forEach(function(id){document.getElementById(id).value='';});document.getElementById('task-img-preview').style.display='none';currentDetailId=null;}

// HELPERS
function uid(){return Math.random().toString(36).substr(2,9);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function formatDate(iso){if(!iso)return '';return new Date(iso).toLocaleDateString('pt-BR');}
function calcProgress(m){if(!m.checklist||!m.checklist.length)return m.progress||0;var done=m.checklist.filter(function(c){return c.done;}).length;return Math.round((done/m.checklist.length)*100);}
function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2800);}

// BACKGROUND
(function(){
  var canvas=document.getElementById('bg-canvas'),ctx=canvas.getContext('2d'),W,H,t=0;
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);
  function draw(){
    ctx.clearRect(0,0,W,H);var bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#090412');bg.addColorStop(1,'#0d0820');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    [{x:0.15,y:0.85,r:0.45,c:'#5322a2',a:0.18},{x:0.85,y:0.1,r:0.35,c:'#3a1870',a:0.14}].forEach(function(o){var grd=ctx.createRadialGradient(o.x*W,o.y*H,0,o.x*W,o.y*H,o.r*Math.max(W,H));grd.addColorStop(0,o.c+'44');grd.addColorStop(1,'transparent');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);});
    var phase=t*0.0006;ctx.save();
    for(var i=0;i<3;i++){var offset=i*0.12,amp=60+i*20;ctx.beginPath();for(var x=0;x<=W;x+=4){var prog=x/W,y=H*(0.82-prog*0.78)+Math.sin(prog*2.5+phase+offset)*amp+Math.cos(prog*1.2+phase*0.7)*(amp*0.5);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle='rgba('+(122-i*10)+','+(69-i*5)+','+(212-i*20)+','+(0.06-i*0.015+Math.sin(phase+i)*0.015)+')';ctx.lineWidth=40-i*8;ctx.lineCap='round';ctx.stroke();ctx.strokeStyle='rgba(255,255,255,'+(0.025-i*0.007)+')';ctx.lineWidth=3;ctx.stroke();}
    ctx.restore();t++;requestAnimationFrame(draw);
  }draw();
})();


// DETAIL
function openDetail(type,id){
  currentDetailType=type;currentDetailId=id;
  var item=type==='meta'?state.metas.find(function(m){return m.id===id;}):state.tasks.find(function(t){return t.id===id;});
  if(!item)return;
  document.getElementById('detail-title').textContent=item.name;
  document.getElementById('detail-body').textContent=item.desc||'Sem descrição.';
  var iw=document.getElementById('detail-img-wrap');
  iw.innerHTML=item.img?'<img src="'+item.img+'" style="width:100%;height:100%;object-fit:cover">':(type==='meta'?'🎯':'✅');
  var gc=document.getElementById('detail-group-chip');gc.textContent=item.group?'📁 '+item.group:'';gc.style.display=item.group?'':'none';
  document.getElementById('detail-date-created').textContent='📅 '+formatDate(item.createdAt);
  var dc=document.getElementById('detail-deadline-chip');dc.textContent=item.deadline?'⏰ '+item.deadline:'';dc.style.display=item.deadline?'':'none';
  var bc=document.getElementById('detail-budget-chip');bc.textContent=item.budget?'💰 R$ '+parseFloat(item.budget).toFixed(2):'';bc.style.display=item.budget?'':'none';
  var cw=document.getElementById('detail-checklist-wrap');
  if(type==='meta'&&item.checklist&&item.checklist.length>0){
    cw.style.display='';
    document.getElementById('detail-checklist').innerHTML=item.checklist.map(function(ci,idx){
      return '<li class="checklist-item"><input type="checkbox" id="dci-'+idx+'" '+(ci.done?'checked':'')+' onchange="toggleDetailCheck('+idx+',this)"><label for="dci-'+idx+'">'+esc(ci.text)+'</label></li>';
    }).join('');
    updateDetailProgress(item);
  }else{cw.style.display='none';}
  var cb2=document.getElementById('detail-complete-btn');
  cb2.textContent=item.done?'↩ Reabrir':'✓ Concluir';
  cb2.className=item.done?'btn btn-ghost':'btn btn-success';
  document.getElementById('detail-page-btn').onclick=function(){goToPage(type==='meta'?'metas':'tarefas');closeModal('modal-detail');};
  openModal('modal-detail');
}
function toggleDetailCheck(idx,cb){
  var item=currentDetailType==='meta'?state.metas.find(function(m){return m.id===currentDetailId;}):state.tasks.find(function(t){return t.id===currentDetailId;});
  if(!item||!item.checklist)return;item.checklist[idx].done=cb.checked;updateDetailProgress(item);saveState();
}
function updateDetailProgress(item){
  if(!item.checklist||!item.checklist.length)return;
  var done=item.checklist.filter(function(c){return c.done;}).length;
  var pct=Math.round((done/item.checklist.length)*100);
  document.getElementById('detail-progress-fill').style.width=pct+'%';
  document.getElementById('detail-progress-label').textContent=pct+'%';
  item.progress=pct;saveState();
}
function completeDetail(){
  var arr=currentDetailType==='meta'?state.metas:state.tasks;
  var item=arr.find(function(i){return i.id===currentDetailId;});if(!item)return;
  item.done=!item.done;item.completedAt=item.done?new Date().toISOString():null;
  saveState();closeModal('modal-detail');toast(item.done?'✅ Concluído!':'↩ Reaberto!');
  currentDetailType==='meta'?renderMetas():renderTasks();renderHome();
}
function requestDeleteDetail(){
  document.getElementById('confirm-icon').textContent='🗑';
  document.getElementById('confirm-title').textContent='Excluir item';
  document.getElementById('confirm-body').textContent='Excluir permanentemente?';
  document.getElementById('confirm-ok-btn').textContent='Excluir';
  document.getElementById('confirm-ok-btn').onclick=function(){
    if(currentDetailType==='meta')state.metas=state.metas.filter(function(m){return m.id!==currentDetailId;});
    else state.tasks=state.tasks.filter(function(t){return t.id!==currentDetailId;});
    saveState();closeModal('modal-confirm');closeModal('modal-detail');toast('🗑 Excluído!');
    currentDetailType==='meta'?renderMetas():renderTasks();renderHome();resetConfirmBtn();
  };openModal('modal-confirm');
}
function editCurrentDetail(){
  var item=currentDetailType==='meta'?state.metas.find(function(m){return m.id===currentDetailId;}):state.tasks.find(function(t){return t.id===currentDetailId;});
  if(!item)return;closeModal('modal-detail');
  if(currentDetailType==='meta'){populateMetaForm(item);openModal('modal-add-meta');}
  else{populateTaskForm(item);openModal('modal-add-task');}
}

// Event delegation for inline card checkboxes
document.addEventListener('change', function(e) {
  if(e.target.classList.contains('task-cl-cb')) {
    var tid = e.target.dataset.tid;
    var idx = parseInt(e.target.dataset.idx);
    var t = state.tasks.find(function(x){return x.id===tid;});
    if(t&&t.checklist&&t.checklist[idx]!==undefined) {
      t.checklist[idx].done = e.target.checked;
      saveState();
    }
  }
  if(e.target.classList.contains('meta-cl-cb')) {
    var mid = e.target.dataset.mid;
    var idx2 = parseInt(e.target.dataset.idx);
    var m = state.metas.find(function(x){return x.id===mid;});
    if(m&&m.checklist&&m.checklist[idx2]!==undefined) {
      m.checklist[idx2].done = e.target.checked;
      m.progress = calcProgress(m);
      saveState();
      // Update progress bar in card without full re-render
      var card = document.querySelector('.meta-card[data-id="'+mid+'"] .progress-bar-fill');
      if(card) card.style.width = m.progress+'%';
      var label = document.querySelector('.meta-card[data-id="'+mid+'"] .progress-label');
      if(label) label.textContent = m.progress+'%';
    }
  }
});
