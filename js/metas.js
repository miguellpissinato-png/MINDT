// METAS — metas, seus filtros e checklists.

// METAS
// Icone e tom da capa da meta (Design System 2). A meta nao guarda assunto,
// entao o icone sai do nome; a primeira da lista ganha a capa laranja.
function iconeDaMeta(m){
  var n = String((m.name || '') + ' ' + (m.group || '')).toLowerCase();
  if(/viag|chile|praia|trip|férias|ferias/.test(n)) return 'aviao';
  if(/livro|ler |leitura|ler$/.test(n)) return 'leitura';
  if(/curso|estud|prova|faculd|inglês|ingles|idioma/.test(n)) return 'estudos';
  if(/trein|corr|maratona|academ|peso|saúde|saude/.test(n)) return 'halter';
  if(/juntar|poupar|guardar|dinheiro|reserva|invest|comprar/.test(n)) return 'gastos';
  return 'metas';
}
var META_TONS = ['a-metas', 'a-dinheiro', 'a-estudos', 'a-leitura', 'a-exercicio'];
// Assunto que aparece na capa quando a meta nao tem grupo, e a cor da area.
var META_ASSUNTO = { aviao:['Viagem','a-metas'], leitura:['Leitura','a-leitura'], estudos:['Estudos','a-estudos'],
  halter:['Saúde','a-exercicio'], gastos:['Dinheiro','a-dinheiro'] };
function mesAno(iso){
  if(!iso) return '';
  // Aceita "2026-11-06" e tambem a data com hora ("2026-11-06T03:00:00Z").
  var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
}
// O texto da barra: "3 de 7 etapas · 43%", ou so a porcentagem sem etapas.
function rotuloDaMeta(m){
  var cl = m.checklist || [], pct = calcProgress(m);
  var feitos = cl.filter(function(c){ return c.done; }).length;
  return cl.length ? feitos + ' de ' + cl.length + ' etapas · ' + pct + '%' : pct + '%';
}
// Marcar uma etapa no cartao atualiza a barra dele na hora.
function atualizarBarraDaMeta(m){
  var card = document.querySelector('.md-goal[data-id="' + m.id + '"]');
  var barra = card && card.querySelector('.md-goal-corpo > .md-pb');
  if(!barra) return;
  var tmp = document.createElement('div');
  tmp.innerHTML = mdBarra(calcProgress(m), rotuloDaMeta(m), 'md-pb--lg');
  barra.replaceWith(tmp.firstChild);
}
var filtroMetas = 'all', grupoMetas = null;
function renderMetas(filter,groupFilter){
  if(!document.getElementById('metas-grid')) return;
  if(filter !== undefined){ filtroMetas = filter || 'all'; grupoMetas = groupFilter || null; }
  filter = filtroMetas; groupFilter = grupoMetas;
  var feitas = updatePeriodStats('metas');updateGroupFilters();
  var ativas = state.metas.filter(function(m){ return !m.done; }).length;
  var hero = document.getElementById('metas-hero');
  if(hero){
    hero.textContent = ativas + (ativas === 1 ? ' ativa' : ' ativas');
    document.getElementById('metas-hero-sub').textContent = feitas.week + (feitas.week === 1 ? ' concluída' : ' concluídas') + ' na semana · ' + feitas.month + ' no mês';
  }
  var grid=document.getElementById('metas-grid');
  var list=state.metas.slice();
  if(filter==='recent')list.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
  if(filter==='old')list.sort(function(a,b){return new Date(a.createdAt)-new Date(b.createdAt);});
  if(filter==='all')list.sort(function(a,b){ return (a.done?1:0)-(b.done?1:0); });
  if(groupFilter)list=list.filter(function(m){return m.group===groupFilter;});
  // Um estado vazio que nao distingue "voce ainda nao criou nada" de "o
  // filtro nao achou nada" faz a pessoa achar que perdeu as metas.
  if(list.length===0){
    var semNenhuma = !state.metas.length;
    grid.innerHTML = estadoVazio('orgulhoso', semNenhuma
        ? 'Nenhuma meta ainda. Crie a primeira e o Ticolino acompanha cada etapa.'
        : 'Nenhuma meta neste filtro. Suas outras metas continuam aqui — é só trocar o filtro.',
      semNenhuma ? '<button type="button" class="md-btn md-btn--primary md-btn--sm" onclick="openModal(\'modal-add-meta\')">' + ico('plus',18,2.4) + 'Nova meta</button>' : '');
    return;
  }
  marcarEntradaDaGrade(grid);
  var sel = deleteMode.type==='metas';
  grid.innerHTML=list.map(function(m, idx){
    var pct=calcProgress(m), cl = m.checklist || [];
    var feitosCl = cl.filter(function(c){ return c.done; }).length;
    var icone = iconeDaMeta(m), assunto = META_ASSUNTO[icone];
    var tom = m.done ? 'a-neutro' : (idx === 0 ? 't-brand' : (assunto ? assunto[1] : META_TONS[idx % META_TONS.length]));
    var kicker = m.done ? 'Concluída' : (m.group || (assunto ? assunto[0] : 'Meta'));
    var meta = [];
    if(m.deadline && mesAno(m.deadline)) meta.push('Prazo ' + mesAno(m.deadline));
    if(m.budget && parseFloat(m.budget) > 0) meta.push(moeda(parseFloat(m.budget)) + ' previstos');
    var rotulo = rotuloDaMeta(m);
    var etapas = '';
    if(cl.length){
      etapas = '<details class="md-goal-etapas" onclick="event.stopPropagation()"><summary>Etapas</summary><div class="meta-inline-checklist">'
        + cl.map(function(ci,idx2){
            var cid='mcl-'+m.id+'-'+idx2;
            return '<div class="meta-inline-check-item">'
              +'<input type="checkbox" class="meta-cl-cb" data-mid="'+m.id+'" data-idx="'+idx2+'" id="'+cid+'" '+(ci.done?'checked':'')+'>'
              +'<label for="'+cid+'">'+esc(ci.text)+'</label></div>';
          }).join('') + '</div></details>';
    }
    return '<div class="md-goal' + (m.done ? ' feita' : '') + (sel ? ' selection-mode' : '') + '" data-id="'+m.id+'" role="button" tabindex="0"'
      + ' onclick="handleCardClick(\'meta\',\''+m.id+'\',event)" onkeydown="if(event.key===\'Enter\'&&event.target===this)handleCardClick(\'meta\',\''+m.id+'\',event)">'
      + '<input type="checkbox" class="select-checkbox" aria-label="Selecionar '+esc(m.name)+'" onclick="event.stopPropagation()" onchange="toggleSelect(\''+m.id+'\',this)">'
      + '<div class="md-goal-capa ' + tom + '"' + (m.img ? ' style="background-image:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url(\'' + esc(m.img) + '\')"' : '') + '>'
        + '<span>' + esc(kicker) + '</span>' + ico(m.done ? 'check' : icone, 28, 1.8) + '</div>'
      + '<div class="md-goal-corpo">'
        + '<span class="md-goal-titulo">' + esc(m.name) + '</span>'
        + (meta.length ? '<span class="md-meta">' + esc(meta.join(' · ')) + '</span>' : (m.desc ? '<span class="md-meta">' + esc(m.desc) + '</span>' : ''))
        + mdBarra(pct, rotulo, 'md-pb--lg')
        + etapas
      + '</div></div>';
  }).join('');
}
function filterMetas(type,el){
  document.querySelectorAll('#metas-filter-row [aria-pressed]').forEach(function(c){
    c.setAttribute('aria-pressed', (c.dataset.filtro === type && !c.dataset.grupo) ? 'true' : 'false');
  });
  renderMetas(type, null);
}

function saveMeta(){
  var name=document.getElementById('meta-name').value.trim();if(!name){toast('⚠️ Dê um nome à meta.');return;}
  var checklist=Array.from(document.getElementById('meta-checklist').querySelectorAll('.checklist-item')).map(function(li){return{text:li.querySelector('label').textContent,done:li.querySelector('input').checked};});
  var imgEl=document.getElementById('meta-preview-img'),imgDiv=document.getElementById('meta-img-preview');
  var img=(imgEl.src&&imgDiv.style.display!=='none')?imgEl.src:null;
  if(currentDetailId&&currentDetailType==='meta'){
    var m=state.metas.find(function(x){return x.id===currentDetailId;});
    if(m){m.name=name;m.desc=document.getElementById('meta-desc').value.trim();m.group=document.getElementById('meta-group').value;m.deadline=document.getElementById('meta-deadline').value;m.budget=document.getElementById('meta-budget').value;m.checklist=checklist;if(img)m.img=img;saveState();closeModal('modal-add-meta');renderMetas();toast('✏️ Meta atualizada!');currentDetailId=null;return;}
  }
  if(typeof podeCriarMeta==='function' && !podeCriarMeta()){ closeModal('modal-add-meta'); return; }
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
