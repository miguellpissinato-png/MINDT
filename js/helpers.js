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
    var chip=document.createElement('button');
    chip.type='button'; chip.className='md-chip md-chip--leve group-filter-chip'; chip.textContent=g;
    chip.dataset.grupo=g;
    chip.setAttribute('aria-pressed', (typeof grupoMetas!=='undefined' && grupoMetas===g) ? 'true' : 'false');
    var gCopy=g;chip.addEventListener('click',function(){
      container.querySelectorAll('[aria-pressed]').forEach(function(c){c.setAttribute('aria-pressed','false');});
      chip.setAttribute('aria-pressed','true');renderMetas('all',gCopy);
    });
    container.appendChild(chip);
  });
}

// PERIOD STATS
function updatePeriodStats(type){
  var now=new Date(),todayStr=now.toDateString(),weekAgo=new Date(now-7*86400000),monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  // Uma entrada por CONCLUSAO, nao por item: a tarefa semanal feita quatro
  // vezes no mes conta quatro. Metas e tarefas comuns seguem com uma so.
  var arr=type==='metas'?state.metas:state.tasks,done=[];
  arr.forEach(function(i){
    var lista = (type!=='metas' && typeof conclusoesDaTarefa==='function')
      ? conclusoesDaTarefa(i) : ((i.done&&i.completedAt)?[i.completedAt]:[]);
    lista.forEach(function(iso){ done.push({completedAt:iso}); });
  });
  var day=done.filter(function(i){return new Date(i.completedAt).toDateString()===todayStr;}).length;
  var week=done.filter(function(i){return new Date(i.completedAt)>=weekAgo;}).length;
  var month=done.filter(function(i){return new Date(i.completedAt)>=monthStart;}).length;
  var de=document.getElementById(type+'-done-day');if(de)de.textContent=day;
  var we=document.getElementById(type+'-done-week');if(we)we.textContent=week;
  var me=document.getElementById(type+'-done-month');if(me)me.textContent=month;
  return {day:day, week:week, month:month};
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
// IMAGENS — toda imagem escolhida pela pessoa vai dentro dos dados dela, que
// sobem inteiros a cada salvamento. Guardada crua, uma foto de celular
// (5-10 MB) deixava cada clique lento, estourava o espaco do navegador e
// passava do teto de 5 MB por conta no servidor. Redesenhada num canvas
// fica com dezenas de KB — e perde os metadados da foto (como o GPS).
var IMAGEM_LADO = 800;

// Teto dos valores em dinheiro: R$ 1 bilhao. Acima disso (ou 1e308, que o
// campo numerico aceita) o saldo virava "Infinity".
var VALOR_MAX = 1e9;
function valorOk(v){ return typeof v === 'number' && isFinite(v) && v > 0 && v <= VALOR_MAX; }
function imagemAceitavel(file){
  if(!file) return false;
  if(!/^image\//.test(file.type)){ toast('⚠️ Escolha uma imagem (JPG, PNG…).'); return false; }
  if(file.size > 25 * 1024 * 1024){ toast('⚠️ Essa imagem é grande demais. Escolha uma de até 25 MB.'); return false; }
  return true;
}
// quadrado=true recorta o centro (foto de perfil); senao mantem a proporcao
// com o maior lado em 'lado' px.
function reduzirImagem(src, lado, quadrado, pronto){
  var img = new Image();
  img.onload = function(){
    var w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h, cw, ch;
    if(!w || !h){ pronto(null); return; }
    if(quadrado){
      sw = sh = Math.min(w, h); sx = (w - sw) / 2; sy = (h - sh) / 2;
      cw = ch = Math.min(lado, sw);
    } else {
      var k = Math.min(1, lado / Math.max(w, h));
      cw = Math.round(w * k); ch = Math.round(h * k);
    }
    var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);   // PNG transparente nao vira fundo preto
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    try { pronto(cv.toDataURL('image/jpeg', 0.8)); } catch(e){ pronto(null); }
  };
  img.onerror = function(){ pronto(null); };
  img.src = src;
}
// Le o arquivo escolhido e devolve a imagem ja reduzida (ou null).
function lerImagemReduzida(file, lado, quadrado, pronto){
  if(!imagemAceitavel(file)){ pronto(null); return; }
  var r = new FileReader();
  r.onload = function(ev){
    reduzirImagem(ev.target.result, lado, quadrado, function(img){
      if(!img) toast('⚠️ Não conseguimos abrir essa imagem. Tente outra.');
      pronto(img);
    });
  };
  r.onerror = function(){ toast('⚠️ Não conseguimos ler essa imagem. Tente outra.'); pronto(null); };
  r.readAsDataURL(file);
}
function previewImg(e,divId,imgId){
  var file=e.target.files[0]; e.target.value='';
  if(!file) return;
  lerImagemReduzida(file, IMAGEM_LADO, false, function(img){
    if(!img) return;
    document.getElementById(divId).style.display='';
    document.getElementById(imgId).src=img;
  });
}

// FORM POPULATION
function populateMetaForm(m){
  currentDetailId=m.id;currentDetailType='meta';
  document.getElementById('meta-name').value=m.name;document.getElementById('meta-desc').value=m.desc||'';document.getElementById('meta-group').value=m.group||'';document.getElementById('meta-deadline').value=m.deadline||'';document.getElementById('meta-budget').value=m.budget||'';
  var cl=document.getElementById('meta-checklist');cl.innerHTML='';
  if(m.checklist)m.checklist.forEach(function(ci){var li=document.createElement('li');li.className='checklist-item';var id='ci-'+uid();li.innerHTML='<input type="checkbox" id="'+id+'" '+(ci.done?'checked':'')+' onchange="updateChecklistProgress(\'meta-checklist\',\'meta-progress-fill\',\'meta-progress-label\')"><label for="'+id+'">'+esc(ci.text)+'</label><button class="icon-btn danger" onclick="this.closest(\'li\').remove();updateChecklistProgress(\'meta-checklist\',\'meta-progress-fill\',\'meta-progress-label\')" style="margin-left:auto">✕</button>';cl.appendChild(li);});
  if(m.img){document.getElementById('meta-img-preview').style.display='';document.getElementById('meta-preview-img').src=m.img;}
}
function populateTaskForm(t){
  // Limpa antes de preencher: sem isto, a imagem de uma tarefa ficava no
  // formulario da proxima que nao tinha imagem.
  resetTaskForm();
  currentDetailId=t.id;currentDetailType='task';
  document.getElementById('task-name').value=t.name;document.getElementById('task-desc').value=t.desc||'';document.getElementById('task-group').value=t.group||'';document.getElementById('task-deadline').value=t.deadline||'';document.getElementById('task-budget').value=t.budget||'';
  if(t.img){document.getElementById('task-img-preview').style.display='';document.getElementById('task-preview-img').src=t.img;}
  if(typeof preencherRecorrenciaForm==='function') preencherRecorrenciaForm(t);
}
function resetMetaForm(){['meta-name','meta-desc','meta-deadline','meta-budget'].forEach(function(id){document.getElementById(id).value='';});document.getElementById('meta-img-preview').style.display='none';document.getElementById('meta-checklist').innerHTML='';document.getElementById('meta-progress-fill').style.width='0%';document.getElementById('meta-progress-label').textContent='0%';currentDetailId=null;}
function resetTaskForm(){['task-name','task-desc','task-deadline','task-budget','task-group'].forEach(function(id){document.getElementById(id).value='';});document.getElementById('task-img-preview').style.display='none';currentDetailId=null;
  if(typeof resetRecorrenciaForm==='function') resetRecorrenciaForm();}

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
// O redesenho nao usa emoji na interface: o simbolo que muitos avisos trazem
// na frente cai aqui, num lugar so, em vez de mexer em cada chamada.
var EMOJI_NA_FRENTE = /^(?:[\u2190-\u21FF\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]|[\uFE0F\u200D\s])+/;
function toast(msg){var el=document.getElementById('toast');el.textContent=String(msg).replace(EMOJI_NA_FRENTE,'');el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2800);}

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
  iw.innerHTML=item.img?'<img src="'+item.img+'" style="width:100%;height:100%;object-fit:cover">':ico(type==='meta'?'metas':'tarefas',40,1.8);
  iw.classList.toggle('sem-img', !item.img);
  var gc=document.getElementById('detail-group-chip');gc.textContent=item.group?item.group:'';gc.style.display=item.group?'':'none';
  document.getElementById('detail-date-created').textContent='Criada em '+formatDate(item.createdAt);
  var dc=document.getElementById('detail-deadline-chip');dc.textContent=item.deadline?'Prazo '+item.deadline:'';dc.style.display=item.deadline?'':'none';
  var bc=document.getElementById('detail-budget-chip');bc.textContent=item.budget?moeda(parseFloat(item.budget)):'';bc.style.display=item.budget?'':'none';
  var cw=document.getElementById('detail-checklist-wrap');
  if(type==='meta'&&item.checklist&&item.checklist.length>0){
    cw.style.display='';
    document.getElementById('detail-checklist').innerHTML=item.checklist.map(function(ci,idx){
      return '<li class="checklist-item"><input type="checkbox" id="dci-'+idx+'" '+(ci.done?'checked':'')+' onchange="toggleDetailCheck('+idx+',this)"><label for="dci-'+idx+'">'+esc(ci.text)+'</label></li>';
    }).join('');
    updateDetailProgress(item);
  }else{cw.style.display='none';}
  var cb2=document.getElementById('detail-complete-btn');
  cb2.textContent=item.done?'Reabrir':'Concluir';
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
  // Recorrente: concluir registra a vez e manda para o proximo ciclo.
  if(currentDetailType!=='meta' && item.recorrencia && item.proxima){
    if(item.done && typeof desfazerConclusao==='function'){ desfazerConclusao(item); saveState(); closeModal('modal-detail'); toast('↩ Conclusão desfeita.'); }
    else { concluirRecorrente(item); saveState(); closeModal('modal-detail'); toast('✅ Concluída! Volta em ' + recDDMM(item.proxima) + '.'); }
    renderTasks(); renderHome(); return;
  }
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
  // Amizades: o amigo acena ao abrir o pop-up e depois fica tranquilo.
  acenando:   ['#tico-eyes-arc',    '#tico-mouth-open',  '#tico-aceno',  ''],
  tranquilo:  ['#tico-eyes-open',   '#tico-mouth-flat',  '#tico-paws',   ''],
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

// ── Cores do Ticolino ──────────────────────────────────────────────────
// O desenho e um so (#tico-core no index.html); cada cor e so uma paleta
// aplicada por variaveis CSS no <svg>, que o <use> herda. Valores vindos do
// quadro "Paleta das cores" do design. Nos tons escuros os olhos abertos
// ganham contorno claro (teod/teo), os olhos de traco clareiam (tea) e os
// bigodes clareiam (tw) — senao o rosto some no pelo.
// xp = XP de estudo que libera a cor (substitui os antigos trofeus).
var TICO_CORES = [
  { id:'padrao',   nome:'Padrão',         preco:0,
    v:{} },
  { id:'cinza',    nome:'Cinza claro',    preco:50,
    v:{tc:'#5F5A55',tf:'#F2B6B2',tp:'#D3D0CA',to:'#8E8983',tr:'#B7B3AC',tb:'#FBF9F5',tlc:'#8E8983',
       tbo:'#F2A8A8',tw:'#5F5A55',twop:'.5',tn:'#EE9AA0',tt:'#5F5A55',te:'#26211E',tea:'#26211E',tbm:'#E58C94',tpa:'#E8E0DB'} },
  { id:'castanho', nome:'Castanho claro', preco:100,
    v:{tc:'#6B432D',tf:'#F4ADA8',tp:'#D9A36F',to:'#9A6741',tr:'#C38B59',tb:'#FFF6E9',tlc:'#FFF1DC',
       tbo:'#F4A39C',tw:'#6B432D',twop:'.5',tn:'#EE9198',tt:'#6B432D',te:'#2B1D15',tea:'#2B1D15',tbm:'#E4868E',tpa:'#F2C49C'} },
  { id:'marrom',   nome:'Marrom',         preco:200,
    v:{tc:'#3B2417',tf:'#E9A5A1',tp:'#7B4F34',to:'#4B2D1C',tr:'#664029',tb:'#F2E0CA',tlc:'#EBCDA8',
       tbo:'#E99A95',tw:'#EBCDA8',twop:'.7',tn:'#EE9198',tt:'#4A2E1E',te:'#1A0F0A',tea:'#F3E2CD',tbm:'#E4868E',tpa:'#DDAE8C',
       teod:'inline',teo:'#F3E2CD'} },
  { id:'preto',    nome:'Preto',          preco:350,
    v:{tc:'#7A6D65',tf:'#E4A19E',tp:'#2E2927',to:'#1B1716',tr:'#453D39',tb:'#E7DED3',tlc:'#DDD5CB',
       tbo:'#D98C8C',tw:'#DDD5CB',twop:'.75',tn:'#EE9AA0',tt:'#3A302B',te:'#0E0B0A',tea:'#E8DFD4',tbm:'#E58C94',tpa:'#CFBEB1',
       teod:'inline',teo:'#E8DFD4'} },
  { id:'listrado', nome:'Cinza listrado', preco:500,
    v:{tc:'#48443F',tf:'#EDB0AC',tp:'#8F8D8A',to:'#5E5B58',tr:'#7B7976',tb:'#F6F4F0',tlc:'#FFFFFF',
       tbo:'#EFA5A5',tw:'#F4F2EE',twop:'.75',tn:'#EE9AA0',tt:'#48443F',te:'#1D1A18',tea:'#F4F2EE',tbm:'#E58C94',tpa:'#DCD5D0',
       teod:'inline',teo:'#F4F2EE',tld:'inline',tl:'#FFFFFF'} }
];
function ticoCor(id){
  for (var i = 0; i < TICO_CORES.length; i++) if (TICO_CORES[i].id === id) return TICO_CORES[i];
  return TICO_CORES[0];
}
// A pessoa tem essa cor? Vale a lista do servidor (cores_compradas, via
// js/nozes.js); antes de ela chegar, a copia guardada no estado; e, para
// quem ainda nao tem nem a copia, a regra antiga do XP (o servidor herdou
// exatamente essas cores para quem ja as tinha liberado).
function corTenho(id){
  if(!id || id === 'padrao') return true;
  var lista = (typeof NOZ !== 'undefined' && NOZ.cores) || (typeof state !== 'undefined' && state && state.coresCompradas);
  if(Array.isArray(lista)) return lista.indexOf(id) !== -1;
  var xp = (typeof studyXP === 'number') ? studyXP : 0;
  return xp >= ticoCor(id).preco;
}
// A cor que a pessoa escolheu, se ela tiver essa cor.
function minhaCorTico(){
  var id = (typeof state !== 'undefined' && state.perfil && state.perfil.cor) || 'padrao';
  return corTenho(id) ? ticoCor(id).id : 'padrao';
}
function estiloCorTico(id){
  var v = ticoCor(id).v, css = '';
  for (var k in v) css += '--' + k + ':' + v[k] + ';';
  return css;
}

// Devolve o SVG do Ticolino no humor pedido.
// tamanho em px (largura); 'rosto' recorta so a cabeça, para avatares.
// cor: id de TICO_CORES; sem ela, a cor escolhida pela pessoa.
function ticolino(humor, tamanho, rosto, cor){
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
  return '<svg viewBox="' + vb + '" style="' + estiloCorTico(cor || minhaCorTico()) +
         'width:' + (tamanho||100) + 'px' + alt +
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
                      + '.tico-quick-value,.gasto-group-total,.total-banner-value,.md-hdr-hero';
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
  // Design System 2: um Ticolino por tela, e ele ja esta no cabecalho. O
  // vazio e so a frase e o que fazer.
  return '<div class="estado-vazio md-vazio">'
    + '<p>' + frase + '</p>'
    + (acaoHtml || '')
    + '</div>';
}


// ─── ICONES DO DESIGN SYSTEM 2 ─────────────────────────────────────────
// Tracos Feather 24x24 sem preenchimento, copiados do "Mindt Design System
// 2" (componente Icon). Chama e noz sao os dois unicos preenchidos.
var ICONES = {
  // Usados pelo app alem dos do sistema
  usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  repetir: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  mais3: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  mapa: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  corrida: '<circle cx="13" cy="4" r="2"/><path d="M7 21l3-6 3 2v5M10 15l-2-4 5-3 3 4h4"/>',
  pegada: '<path d="M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM16 9c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5z"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  metas: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  tarefas: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  gastos: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  agenda: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  resumo: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  estudos: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  leitura: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  notas: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  perfil: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  reset: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  halter: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  carrinho: '<path d="M6 6h15l-2 9H8L6 3H3"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
  transporte: '<path d="M5 17h14M6 17l1.5-6h9L18 17M8 11l1.5-4h5L16 11"/><circle cx="8" cy="19" r="1.4"/><circle cx="16" cy="19" r="1.4"/>',
  ganho: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  banco: '<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
  bau: '<path d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/><rect x="10" y="9" width="4" height="5" rx="1"/>',
  aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  // Quadro (Rotina): blocos de tamanhos diferentes
  quadro: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'
  };

function ico(nome, tam, traco){
  var d = ICONES[nome];
  if(!d) return '';
  tam = tam || 20;
  return '<svg class="md-ico" viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" stroke-width="' + (traco || 2) + '" aria-hidden="true">' + d + '</svg>';
}
function icoChama(tam){
  tam = tam || 16;
  return '<svg class="md-chama" viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" aria-hidden="true"><path fill="currentColor" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>';
}
function icoNoz(tam){
  tam = tam || 16;
  return '<svg class="md-noz-ico" viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" aria-hidden="true">'
    + '<path class="casca" d="M4.5 10.5c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6z"/>'
    + '<path class="miolo" d="M6.5 10.5h11c0 5.2-2.8 9-5.5 10.5-2.7-1.5-5.5-5.3-5.5-10.5z"/></svg>';
}
// Barra de progresso com reflexo. O rotulo (opcional) aparece duas vezes:
// em tinta escura por baixo e recortado na cor de cima da parte cheia, para
// ler bem dos dois lados da divisa.
function mdBarra(pct, rotulo, extra){
  pct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  var r = rotulo ? esc(rotulo) : '';
  return '<span class="md-pb ' + (extra || '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"'
    + (r ? ' aria-label="' + r + '"' : '') + '>'
    + '<span class="md-pb-fill" style="width:' + pct + '%"></span>'
    + (r ? '<em aria-hidden="true">' + r + '</em><em class="md-pb-in" aria-hidden="true" style="clip-path:inset(0 ' + (100 - pct) + '% 0 0)">' + r + '</em>' : '')
    + '</span>';
}
