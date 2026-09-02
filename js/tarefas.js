// TAREFAS — tarefas, seus filtros e checklists.

// TASKS
function renderTasks(filter){
  if(!document.getElementById('tasks-grid')) return;
  filter=filter||'all';updatePeriodStats('tasks');
  var grid=document.getElementById('tasks-grid');
  var list=state.tasks.slice();
  if(filter==='pending')list=list.filter(function(t){return !t.done;});
  if(filter==='done')list=list.filter(function(t){return t.done;});
  if(filter==='recent')list.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
  if(list.length===0){grid.innerHTML='<div class="empty-state"><div class="empty-icon">✅</div><p>Nenhuma tarefa ainda.</p></div>';return;}
  grid.innerHTML=list.map(function(t){
    var chkSvg='<svg viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5"><polyline points="1.5,6 4.5,9 10.5,3"/></svg>';
    var inlineChecklist='';
    if(t.checklist&&t.checklist.length){
      inlineChecklist='<div class="task-inline-checklist" onclick="event.stopPropagation()" data-taskid="'+t.id+'">'
        +t.checklist.map(function(ci,idx2){
          var cid='tcl-'+t.id+'-'+idx2;
          return '<div class="task-inline-check-item">'
            +'<input type="checkbox" class="task-cl-cb" data-tid="'+t.id+'" data-idx="'+idx2+'" id="'+cid+'" '+(ci.done?'checked':'')+'>'
            +'<label for="'+cid+'">'+esc(ci.text)+'</label>'
            +'</div>';
        }).join('')+'</div>';
    }
    return '<div class="task-card'+(deleteMode.type==='tasks'?' selection-mode':'')+'" data-id="'+t.id+'" onclick="handleCardClick(\'task\',\''+t.id+'\',event)">'
      +'<input type="checkbox" class="select-checkbox" onchange="toggleSelect(\''+t.id+'\',this)">'
      +'<div class="task-card-header">'
        +'<div class="task-card-check'+(t.done?' done':'')+'" onclick="event.stopPropagation();quickCompleteTask(\''+t.id+'\')" title="Concluir">'+chkSvg+'</div>'
        +'<div class="task-card-main">'
          +'<div class="task-card-title'+(t.done?' done':'')+'">'+esc(t.name)+'</div>'
          +(t.desc?'<div class="task-card-desc">'+esc(t.desc)+'</div>':'')
        +'</div>'
        +'<div class="task-status-badge'+(t.done?' done':'')+'" style="flex-shrink:0;margin-left:auto">'+(t.done?'Concluída':'Andamento')+'</div>'
      +'</div>'
      +'<div class="task-card-meta">'
        +(t.deadline?'<span class="task-card-date">📅 '+t.deadline+'</span>':'')
        +(t.group?'<span class="task-card-date">📁 '+esc(t.group)+'</span>':'')
        +(t.budget?'<span class="task-card-date">💰 R$'+parseFloat(t.budget).toFixed(0)+'</span>':'')
      +'</div>'
      +inlineChecklist
      +'</div>';
  }).join('');;
}
function filterTasks(type,el){document.querySelectorAll('#tasks-filter-row .filter-chip').forEach(function(c){c.classList.remove('active');});if(el)el.classList.add('active');renderTasks(type);}

function handleCardClick(type,id,event){
  if(event.target.type==='checkbox')return;
  var dm=type==='meta'?'metas':'tasks';
  if(deleteMode.type===dm||editMode.type===dm){var cb=event.currentTarget.querySelector('.select-checkbox');cb.checked=!cb.checked;toggleSelect(id,cb);return;}
  openDetail(type,id);
}

function saveTask(){
  var name=document.getElementById('task-name').value.trim();if(!name){toast('⚠️ Informe um nome.');return;}
  var imgEl=document.getElementById('task-preview-img'),imgDiv=document.getElementById('task-img-preview');
  var img=(imgEl.src&&imgDiv.style.display!=='none')?imgEl.src:null;
  if(currentDetailId&&currentDetailType==='task'){
    var t=state.tasks.find(function(x){return x.id===currentDetailId;});
    if(t){t.name=name;t.desc=document.getElementById('task-desc').value.trim();t.group=document.getElementById('task-group').value;t.deadline=document.getElementById('task-deadline').value;t.budget=document.getElementById('task-budget').value;if(img)t.img=img;saveState();closeModal('modal-add-task');renderTasks();toast('✏️ Tarefa atualizada!');currentDetailId=null;return;}
  }
  state.tasks.push({id:uid(),_type:'task',name:name,desc:document.getElementById('task-desc').value.trim(),group:document.getElementById('task-group').value,deadline:document.getElementById('task-deadline').value,budget:document.getElementById('task-budget').value,img:img,done:false,createdAt:new Date().toISOString()});
  saveState();closeModal('modal-add-task');resetTaskForm();renderTasks();renderHome();toast('✅ Tarefa criada!');
}

// Quick complete task from card
function quickCompleteTask(id) {
  var t = state.tasks.find(function(x){return x.id===id;});
  if(!t) return;
  t.done = !t.done;
  t.completedAt = t.done ? new Date().toISOString() : null;
  saveState();
  renderTasks();
  renderHome();
  toast(t.done ? '✅ Concluída!' : '↩ Reaberta!');
}

// Toggle checklist item directly from task card
function toggleTaskInlineCheck(taskId, idx, cb) {
  var t = state.tasks.find(function(x){return x.id===taskId;});
  if(!t||!t.checklist) return;
  t.checklist[idx].done = cb.checked;
  saveState();
  renderTasks();
}
