// METAS — metas, seus filtros e checklists.

// METAS
function renderMetas(filter,groupFilter){
  if(!document.getElementById('metas-grid')) return;
  filter=filter||'all';
  updatePeriodStats('metas');updateGroupFilters();
  var grid=document.getElementById('metas-grid');
  var list=state.metas.slice();
  if(filter==='recent')list.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
  if(filter==='old')list.sort(function(a,b){return new Date(a.createdAt)-new Date(b.createdAt);});
  if(groupFilter)list=list.filter(function(m){return m.group===groupFilter;});
  if(list.length===0){grid.innerHTML='<div class="empty-state"><div class="empty-icon">🎯</div><p>Nenhuma meta ainda.</p></div>';return;}
  grid.innerHTML=list.map(function(m){
    var pct=calcProgress(m);
    var inlineChecklist='';
    if(m.checklist&&m.checklist.length){
      inlineChecklist='<div class="meta-inline-checklist" onclick="event.stopPropagation()">'
        +m.checklist.map(function(ci,idx2){
          var cid='mcl-'+m.id+'-'+idx2;
          return '<div class="meta-inline-check-item">'
            +'<input type="checkbox" class="meta-cl-cb" data-mid="'+m.id+'" data-idx="'+idx2+'" id="'+cid+'" '+(ci.done?'checked':'')+'>'
            +'<label for="'+cid+'">'+esc(ci.text)+'</label>'
            +'</div>';
        }).join('')+'</div>';
    }
    return '<div class="meta-card'+(deleteMode.type==='metas'?' selection-mode':'')+'" data-id="'+m.id+'" onclick="handleCardClick(\'meta\',\''+m.id+'\',event)">'
      +'<input type="checkbox" class="select-checkbox" onchange="toggleSelect(\''+m.id+'\',this)">'
      +'<div class="meta-card-img">'+(m.img?'<img src="'+m.img+'">':(m.done?'✅':'🎯'))+'</div>'
      +'<div class="meta-card-body">'
        +'<div>'
          +(m.group?'<div class="chip" style="margin-bottom:6px;font-size:10px">'+esc(m.group)+'</div>':'')
          +'<div class="meta-card-title">'+esc(m.name)+'</div>'
          +(m.desc?'<div class="meta-card-desc">'+esc(m.desc)+'</div>':'')
        +'</div>'
        +'<div>'
          +(m.deadline?'<div class="meta-card-date">📅 '+(m.deadline||'Sem prazo')+'</div>':'')
          +'<div class="progress-bar-wrap"><div class="progress-bar-track"><div class="progress-bar-fill" style="width:'+pct+'%"></div></div><div class="progress-label">'+pct+'%</div></div>'
          +inlineChecklist
        +'</div>'
      +'</div>'
      +'</div>';
  }).join('');;
}
function filterMetas(type,el){document.querySelectorAll('#metas-filter-row .filter-chip').forEach(function(c){c.classList.remove('active');});if(el)el.classList.add('active');renderMetas(type);}

function saveMeta(){
  var name=document.getElementById('meta-name').value.trim();if(!name){toast('⚠️ Informe um nome.');return;}
  var checklist=Array.from(document.getElementById('meta-checklist').querySelectorAll('.checklist-item')).map(function(li){return{text:li.querySelector('label').textContent,done:li.querySelector('input').checked};});
  var imgEl=document.getElementById('meta-preview-img'),imgDiv=document.getElementById('meta-img-preview');
  var img=(imgEl.src&&imgDiv.style.display!=='none')?imgEl.src:null;
  if(currentDetailId&&currentDetailType==='meta'){
    var m=state.metas.find(function(x){return x.id===currentDetailId;});
    if(m){m.name=name;m.desc=document.getElementById('meta-desc').value.trim();m.group=document.getElementById('meta-group').value;m.deadline=document.getElementById('meta-deadline').value;m.budget=document.getElementById('meta-budget').value;m.checklist=checklist;if(img)m.img=img;saveState();closeModal('modal-add-meta');renderMetas();toast('✏️ Meta atualizada!');currentDetailId=null;return;}
  }
  state.metas.push({id:uid(),_type:'meta',name:name,desc:document.getElementById('meta-desc').value.trim(),group:document.getElementById('meta-group').value,deadline:document.getElementById('meta-deadline').value,budget:document.getElementById('meta-budget').value,checklist:checklist,img:img,done:false,createdAt:new Date().toISOString()});
  saveState();closeModal('modal-add-meta');resetMetaForm();renderMetas();renderHome();toast('🎯 Meta criada!');
}

// Toggle checklist item directly from meta card
function toggleMetaInlineCheck(metaId, idx, cb) {
  var m = state.metas.find(function(x){return x.id===metaId;});
  if(!m||!m.checklist) return;
  m.checklist[idx].done = cb.checked;
  m.progress = calcProgress(m);
  saveState();
  renderMetas();
}
