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
  bar.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:var(--surface-2);border:1px solid var(--line-strong);border-radius:var(--radius);padding:14px 24px;display:flex;gap:12px;align-items:center;z-index:400;box-shadow:var(--shadow-lg);';
  bar.innerHTML='<span style="font-size:13px;color:var(--text-dim)" id="sel-count">0 selecionados</span>';
  var ab=document.createElement('button');ab.className='btn btn-sm '+(isEdit?'btn-primary':'btn-danger');ab.textContent=isEdit?'✏️ Editar':'🗑 Excluir';ab.onclick=function(){confirmSel(type,isEdit);};
  var cb=document.createElement('button');cb.className='btn btn-ghost btn-sm';cb.textContent='Cancelar';cb.onclick=function(){cancelSel(type);};
  bar.appendChild(ab);bar.appendChild(cb);document.body.appendChild(bar);
}
function confirmSel(type,isEdit){
  if(isEdit){
    if(deleteMode.selected.length!==1){toast('⚠️ Para editar, deixe apenas um item marcado.');return;}
    var id=deleteMode.selected[0];cancelSel(type);
    if(type==='metas'){var m=state.metas.find(function(x){return x.id===id;});if(m){populateMetaForm(m);openModal('modal-add-meta');}}
    else{var t=state.tasks.find(function(x){return x.id===id;});if(t){populateTaskForm(t);openModal('modal-add-task');}}
    return;
  }
  if(!deleteMode.selected.length){toast('⚠️ Marque ao menos um item na lista.');return;}
  // A confirmacao dizia so "Excluir 3 item(s)?" — nao dizia de QUE lista,
  // e a caixa cobre a tela que daria essa pista.
  var quantos = deleteMode.selected.length;
  var oQue = type==='metas' ? plural(quantos,'meta','metas')
           : type==='tasks' ? plural(quantos,'tarefa','tarefas')
           :                  plural(quantos,'nota','notas');
  document.getElementById('confirm-icon').textContent='🗑';
  document.getElementById('confirm-title').textContent='Excluir '+oQue;
  document.getElementById('confirm-body').textContent=
    'Isto apaga '+oQue+' de vez. Não dá para desfazer.';
  document.getElementById('confirm-ok-btn').textContent='Excluir';
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
  if(id==='modal-add-categoria'){ renderCategoriasList(); sugerirCorCategoria(); }
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
// Normaliza uma data para aaaa-mm-dd, o unico formato em que comparar como
// texto equivale a comparar como data.
//
// O app tem os dois: createdAt/completedAt sao ISO (do new Date().toISOString())
// e o prazo vem do calendario como dd/mm/aaaa. Comparar os dois formatos
// misturados fazia "vence neste periodo" nunca bater — o dia do mes ia parar
// no lugar do ano.
function dataISO(v){
  if(!v) return '';
  var t = String(v).trim();
  var br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(br) return br[3] + '-' + br[2] + '-' + br[1];
  return t.slice(0, 10);
}
function calcProgress(m){if(!m.checklist||!m.checklist.length)return m.progress||0;var done=m.checklist.filter(function(c){return c.done;}).length;return Math.round((done/m.checklist.length)*100);}
function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2800);}

// BACKGROUND
(function(){
  var canvas=document.getElementById('bg-canvas'),ctx=canvas.getContext('2d'),W,H,t=0;
  // O canvas pinta com valores fixos (nao le tokens), entao guarda as duas
  // paletas e escolhe pelo atributo data-theme no <html>.
  var PALETAS={
    dark:  {de:'#12140E',ate:'#1B2118',brilho1:'#2C5745',brilho2:'#EB7D00'},
    light: {de:'#F2EEDA',ate:'#FBF8EC',brilho1:'#2C5745',brilho2:'#C56800'}
  };
  function paleta(){
    return PALETAS[document.documentElement.getAttribute('data-theme')==='light'?'light':'dark'];
  }
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);
  function draw(){
    ctx.clearRect(0,0,W,H);var P=paleta();var bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,P.de);bg.addColorStop(1,P.ate);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    [{x:0.15,y:0.85,r:0.45,c:P.brilho1,a:0.18},{x:0.85,y:0.1,r:0.35,c:P.brilho2,a:0.14}].forEach(function(o){var grd=ctx.createRadialGradient(o.x*W,o.y*H,0,o.x*W,o.y*H,o.r*Math.max(W,H));grd.addColorStop(0,o.c+'44');grd.addColorStop(1,'transparent');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);});
    var phase=t*0.0006;ctx.save();
    for(var i=0;i<3;i++){var offset=i*0.12,amp=60+i*20;ctx.beginPath();for(var x=0;x<=W;x+=4){var prog=x/W,y=H*(0.82-prog*0.78)+Math.sin(prog*2.5+phase+offset)*amp+Math.cos(prog*1.2+phase*0.7)*(amp*0.5);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle='rgba('+(140-i*8)+','+(169-i*6)+','+(255-i*14)+','+(0.16-i*0.03+Math.sin(phase+i)*0.03)+')';ctx.lineWidth=40-i*8;ctx.lineCap='round';ctx.stroke();ctx.strokeStyle='rgba(255,251,242,'+(0.5-i*0.12)+')';ctx.lineWidth=3;ctx.stroke();}
    ctx.restore();t++;requestAnimationFrame(draw);
  }draw();
  // definirTema() chama isto; o laco ja repinta a cada quadro, entao aqui
  // basta garantir que a proxima pintura pegue o tamanho certo da janela.
  window.redesenharFundo=resize;
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
  // "Excluir permanentemente?" nao dizia O QUE seria excluido, e a caixa de
  // confirmacao cobre justamente a tela que mostrava o nome.
  var alvo = currentDetailType==='meta'
    ? state.metas.find(function(m){return m.id===currentDetailId;})
    : state.tasks.find(function(t){return t.id===currentDetailId;});
  var tipo = currentDetailType==='meta' ? 'meta' : 'tarefa';
  document.getElementById('confirm-icon').textContent='🗑';
  document.getElementById('confirm-title').textContent='Excluir '+tipo;
  document.getElementById('confirm-body').textContent = alvo && alvo.name
    ? 'Excluir "'+alvo.name+'" de vez? Não dá para desfazer.'
    : 'Excluir esta '+tipo+' de vez? Não dá para desfazer.';
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

// ─── TICOLINO — o mascote ───────────────────────────────
// O mascote e montado por peças: corpo + olhos + boca + objeto.
// Cada humor e uma combinaçao, conforme a folha de poses do design.
var TICO_MOODS = {
  feliz:      ['#tico-eyes-open',   '#tico-mouth-smile', '#tico-paws',   ''],
  animado:    ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-paws',   '#tico-spark'],
  lendo:      ['#tico-eyes-arc',    '#tico-mouth-smile', '#tico-book',   ''],
  focado:     ['#tico-eyes-open',   '#tico-mouth-flat',  '#tico-pencil', '#tico-brows'],
  rico:       ['#tico-eyes-star',   '#tico-mouth-open',  '#tico-coin',   ''],
  orgulhoso:  ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-trophy', '#tico-spark'],
  sonolento:  ['#tico-eyes-sleepy', '#tico-mouth-flat',  '#tico-none',   '#tico-zzz'],
  preguicoso: ['#tico-eyes-sleepy', '#tico-mouth-flat',  '#tico-paws',   ''],
  comendo:    ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-seed',   ''],

  // Poses de exercicio. Mesmas pecas do sprite original mais as #tico-fit-*.
  // Sao as unicas que usam o quinto slot (um segundo extra).
  pulando:    ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-fit-corda',    '#tico-fit-faixa'],
  levantando: ['#tico-eyes-open',   '#tico-mouth-flat',  '#tico-fit-halter',   '#tico-brows'],
  correndo:   ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-fit-correndo', '#tico-fit-faixa'],
  boxe:       ['#tico-eyes-open',   '#tico-mouth-flat',  '#tico-fit-luvas',    '#tico-brows'],
  cansado:    ['#tico-eyes-sleepy', '#tico-mouth-open',  '#tico-paws',         '#tico-fit-suor'],
  pausa:      ['#tico-eyes-arc',    '#tico-mouth-smile', '#tico-fit-agua',     ''],
  forte:      ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-fit-forte',    '#tico-fit-faixa', '#tico-spark'],

  // Tristeza. A poca vem depois do corpo de proposito: e translucida, e
  // passar por cima dos pes e o que faz parecer que ele esta dentro dela.
  triste:     ['#tico-eyes-chorando', '#tico-mouth-chorando', '#tico-paws',  '#tico-brows-triste'],
  chorando:   ['#tico-eyes-chorando', '#tico-mouth-chorando', '#tico-poca',
               '#tico-lagrimas',      '#tico-brows-triste']
};

// Devolve o SVG do Ticolino no humor pedido.
// tamanho em px (largura); 'rosto' recorta so a cabeça, para avatares.
function ticolino(humor, tamanho, rosto){
  var m = TICO_MOODS[humor] || TICO_MOODS.feliz;
  var vb = rosto ? '20 30 160 110' : '0 0 200 206';
  var alt = rosto ? '' : ';height:' + Math.round((tamanho||100) * 1.03) + 'px';
  var pecas = '<use href="#tico-core"></use><use href="' + m[0] + '"></use><use href="' + m[1] + '"></use>';
  if (!rosto) {
    pecas += '<use href="' + m[2] + '"></use>';
    if (m[3]) pecas += '<use href="' + m[3] + '"></use>';
    // Quinto slot: usado so pelas poses de exercicio (ex: 'forte' com brilho).
    if (m[4]) pecas += '<use href="' + m[4] + '"></use>';
  }
  return '<svg viewBox="' + vb + '" style="width:' + (tamanho||100) + 'px' + alt +
         ';display:block;flex:none" aria-hidden="true">' + pecas + '</svg>';
}

// Escolhe o humor a partir do estado do app (usado na Home).
function ticoHumorDoDia(){
  var feitos = tarefasDoDiaFeitas();
  if (feitos === 0) return 'sonolento';
  if (feitos >= 4) return 'orgulhoso';
  return 'feliz';
}


// Dinheiro formatado no idioma atual, com separador de milhar.
// Antes: R$ 1948,00 para mil novecentos e quarenta e oito reais — sem os
// pontos, valores grandes viram uma fileira de digitos ilegivel.
function moeda(v){
  var n = parseFloat(v);
  if (!isFinite(n)) n = 0;
  var en = (typeof idiomaAtual === 'function') && idiomaAtual() === 'en';
  var opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return en ? '$' + n.toLocaleString('en-US', opts)
            : 'R$ ' + n.toLocaleString('pt-BR', opts);
}

// ── MOVIMENTO ──────────────────────────────────────────────────────────

// Quem pediu menos movimento no sistema. Consultado na hora, nao guardado:
// a preferencia pode mudar com a pagina aberta.
function menosMovimento(){
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch(e){ return false; }
}

// A MESMA curva que o CSS usa (--ease-out: cubic-bezier(0.16,1,0.3,1)).
// Sem isto o numero e a barra percorreriam o trajeto em ritmos diferentes e
// chegariam juntos por acaso, nao por construcao.
function _bezierY(t, x1, y1, x2, y2){
  // acha o parametro cujo X e t, por bisseccao — precisao de sobra para 60fps
  var lo = 0, hi = 1, u = t, x;
  for (var i = 0; i < 20; i++){
    u = (lo + hi) / 2;
    var v = 1 - u;
    x = 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u;
    if (x < t) lo = u; else hi = u;
  }
  var w = 1 - u;
  return 3*w*w*u*y1 + 3*w*u*u*y2 + u*u*u;
}

// Conta de um numero ao outro no mesmo tempo e na mesma curva da barra que
// o acompanha. O texto do XP e a barra sao O MESMO dado: a barra deslizava
// em 0,7s e o numero pulava no primeiro quadro, entao liam-se como duas
// coisas que por acaso mudaram juntas.
function contarAte(el, ate, formatar){
  if(!el) return;
  var de = parseFloat(el.dataset.valor);
  if(!isFinite(de)) de = ate;
  el.dataset.valor = ate;
  var pintar = function(v){ el.textContent = formatar ? formatar(v) : String(v); };
  if(de === ate){ pintar(ate); return; }
  if(menosMovimento()){ pintar(ate); return; }

  // Uma contagem por elemento: pedir outra no meio cancela a anterior, senao
  // dois lacos disputariam o mesmo textContent.
  if(el._contagem) cancelAnimationFrame(el._contagem);
  var ms = 700;   // igual a --dur-progress
  var t0 = null;
  var passo = function(agora){
    if(t0 === null) t0 = agora;
    var t = Math.min(1, (agora - t0) / ms);
    pintar(Math.round(de + (ate - de) * _bezierY(t, 0.16, 1, 0.3, 1)));
    if(t < 1) el._contagem = requestAnimationFrame(passo);
    else el._contagem = null;
  };
  el._contagem = requestAnimationFrame(passo);
}

// Abre (ou fecha) a entrada escalonada de uma grade de cartoes. Chamada
// ANTES de escrever o innerHTML: ligar a classe depois do cartao ja pintado
// faria ele piscar do estado final para o inicial.
function marcarEntradaDaGrade(grid){
  if(!grid) return;
  var vale = (typeof chegandoNaPagina !== 'undefined') && chegandoNaPagina && !menosMovimento();
  grid.classList.toggle('entrando', !!vale);
}

// ── PLURAL ─────────────────────────────────────────────────────────────
// "3 item(s)" e o jeito de quem nao quis escolher, e aparece justamente na
// hora mais tensa do app: a confirmacao de exclusao. Uma frase com
// parenteses no meio le-se pior e ainda passa a sensacao de rascunho.
function plural(n, um, muitos){
  return n + ' ' + (n === 1 ? um : muitos);
}

// ── NUMEROS GRANDES ────────────────────────────────────────────────────
//
// Um valor em reais e um TOKEN SO. Ate aqui os numeros grandes levavam
// "overflow-wrap:anywhere" para nao vazar do cartao, e o navegador fazia o
// unico corte que essa regra permite: entre digitos. "R$ 1.001.319.449,23"
// virava "R$ 1.001.319.449,2" numa linha e "3" na outra — pior que vazar,
// porque a primeira linha vira um numero errado que se le como certo.
//
// Entao o numero nao quebra mais: quem cede e o corpo da fonte. Chamar de
// novo repoe o tamanho do CSS antes de medir, entao serve para o primeiro
// desenho e para qualquer remedida depois.
function encaixarNumero(el){
  if(!el || !el.isConnected) return;
  el.style.fontSize = '';
  var tam = parseFloat(getComputedStyle(el).fontSize) || 24;
  var guarda = 0;
  while(el.scrollWidth > el.clientWidth + 1 && tam > 12 && guarda++ < 80){
    tam -= 1;
    el.style.fontSize = tam + 'px';
  }
  // Em que largura este tamanho foi decidido. E o que permite ignorar o
  // proprio efeito colateral do ajuste — ver o observador abaixo.
  el._larguraAjustada = el.clientWidth;
}

// Medir uma vez nao basta. Encolher o numero muda a ALTURA da pagina, a
// altura decide se ha barra de rolagem, e a barra muda a largura util: a
// largura medida no comeco do ajuste podia ja nao existir no fim dele, e o
// numero ficava parado num tamanho grande demais. Em vez de adivinhar
// quantas passadas bastam, o ajuste escuta a largura de verdade e refaz a
// conta quando ela muda. Encolher a fonte muda a altura, nao a largura,
// entao comparar com a largura da ultima conta impede o laco infinito.
var observadorNumero = (typeof ResizeObserver === 'function')
  ? new ResizeObserver(function(entradas){
      entradas.forEach(function(e){
        var el = e.target;
        if(el.clientWidth !== el._larguraAjustada) encaixarNumero(el);
      });
    })
  : null;

// Os numeros que ocupam um cartao inteiro. Os de lista ja tem reticencia.
var SEL_NUMERO_GRANDE = '.big-metric .value:not(.value-texto),.stat-value,'
                      + '.tico-quick-value,.gasto-group-total,.total-banner-value';
function encaixarNumeros(raiz){
  var alvo = raiz || document;
  alvo.querySelectorAll(SEL_NUMERO_GRANDE).forEach(function(el){
    encaixarNumero(el);
    // observe() no mesmo elemento nao duplica a inscricao.
    if(observadorNumero) observadorNumero.observe(el);
  });
}
// Sem ResizeObserver (navegador antigo) sobra o caminho manual.
if(!observadorNumero){
  window.addEventListener('resize', function(){ encaixarNumeros(); });
}

// Valor abreviado, para o unico lugar onde nem encolher resolve: o miolo da
// rosquinha de categorias, que tem 100px de diametro. So entra quando o
// valor inteiro ja nao caberia de forma legivel — ver pintarTotalDaRosquinha.
function moedaCurta(v){
  var n = parseFloat(v);
  if(!isFinite(n)) n = 0;
  var en = (typeof idiomaAtual === 'function') && idiomaAtual() === 'en';
  var a = Math.abs(n);
  var escala = a >= 1e9 ? [1e9, en?'B':'bi']
             : a >= 1e6 ? [1e6, en?'M':'mi']
             : a >= 1e3 ? [1e3, en?'K':'mil']
             : null;
  if(!escala) return moeda(n);
  var x = n / escala[0];
  var casas = Math.abs(x) >= 100 ? 0 : 1;
  var texto = x.toLocaleString(en ? 'en-US' : 'pt-BR',
                {minimumFractionDigits:casas, maximumFractionDigits:casas});
  return (en ? '$' : 'R$ ') + texto + (en ? escala[1] : ' ' + escala[1]);
}

// Pixel transparente. Usado como origem inicial das <img> que so recebem
// imagem depois: <img src=""> resolve para a propria pagina e dispara uma
// requisicao falhada a cada carregamento.
var IMG_VAZIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';


// Da um pixel transparente as <img> que so recebem imagem depois.
// Sem isso o navegador tenta buscar a propria pagina como imagem e registra
// uma requisicao falhada por <img> a cada carregamento.
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('img[data-vazia]').forEach(function(im){
    if (!im.getAttribute('src')) im.src = IMG_VAZIA;
  });
});


// ═══════════════════════════════════════════════════════════════════════
// ACESSIBILIDADE POR TECLADO
//
// O app usa <div onclick="..."> em ~50 lugares (cartoes, filtros, itens do
// menu). <div> nao recebe foco e nao responde a Enter, entao esses controles
// eram invisiveis para quem navega por teclado ou usa leitor de tela: 27 dos
// 80 controles visiveis, mais o menu lateral e a barra do celular inteiros.
//
// Trocar todos por <button> quebraria o CSS que depende de display:block,
// grid e do reset proprio dos cartoes. A solucao equivalente e padrao e
// declarar o papel (role="button") e a ordem de tabulacao (tabindex="0"),
// e traduzir Enter/Espaco em clique.
//
// Como as listas sao redesenhadas por innerHTML a cada render, um
// MutationObserver reaplica isso no conteudo novo — sem precisar tocar em
// cada funcao de render.
// ═══════════════════════════════════════════════════════════════════════

// Elementos que ja sao focaveis por natureza: nao mexer neles.
var JA_FOCAVEL = 'a[href],button,input,select,textarea,summary,[tabindex]';

function tornarAcessivel(raiz){
  var alvos = (raiz || document).querySelectorAll(
    '[onclick]:not(' + JA_FOCAVEL + '), .nav-item, .mobile-nav-item'
  );
  alvos.forEach(function(el){
    if (el.matches(JA_FOCAVEL)) return;          // ja alcancavel
    if (el.dataset.a11y === '1') return;         // ja tratado
    // Involucros que so barram o clique do cartao-pai nao sao controles:
    // dar foco a eles criaria uma parada morta na tabulacao.
    var acao = el.getAttribute('onclick') || '';
    if (acao.replace(/\s/g, '') === 'event.stopPropagation()') return;
    el.dataset.a11y = '1';
    el.setAttribute('tabindex', '0');
    if (!el.getAttribute('role')) el.setAttribute('role', 'button');
  });
}

// Enter e Espaco ativam o elemento, como fariam num <button> de verdade.
// Espaco tambem rola a pagina por padrao, entao precisa de preventDefault.
document.addEventListener('keydown', function(e){
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  var el = e.target;
  if (!el || el.dataset.a11y !== '1') return;
  // Se o foco estiver dentro de um campo de texto, nao sequestrar a tecla.
  if (el.matches('input,textarea,select')) return;
  e.preventDefault();
  el.click();
});

// Esc fecha o modal aberto — esperado em qualquer dialogo.
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  var aberto = document.querySelector('.modal-overlay.open');
  if (aberto && aberto.id) closeModal(aberto.id);
});

document.addEventListener('DOMContentLoaded', function(){
  tornarAcessivel(document);
  // Conteudo redesenhado depois (cartoes, filtros, listas) entra por aqui.
  if (typeof MutationObserver === 'function') {
    // Uma render troca dezenas de nos de uma vez. Em vez de varrer a cada no,
    // agenda UMA passada para o proximo quadro e junta tudo.
    var agendado = false;
    new MutationObserver(function(){
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function(){
        agendado = false;
        tornarAcessivel(document);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
});


// Estado vazio do design system: mascote sobre um brilho suave, frase curta
// e uma acao opcional. Um lugar so, para as telas nao divergirem.
function estadoVazio(humor, frase, acaoHtml){
  return '<div class="estado-vazio">'
    + '<div class="estado-vazio-mascote">' + ticolino(humor || 'preguicoso', 120) + '</div>'
    + '<p>' + frase + '</p>'
    + (acaoHtml || '')
    + '</div>';
}
