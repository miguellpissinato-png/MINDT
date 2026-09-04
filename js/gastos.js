// GASTOS — lancamentos, parcelas, juros, categorias e grafico de pizza.

// GASTOS

function getCat(id) {
  if(!state.categorias||!id||id==='__none__') return null;
  return state.categorias.find(function(c){return c.id===id;}) || null;
}

// ─── PIZZA CHART ─────────────────────────────────────────

// Paleta categorica das categorias de gasto.
//
// Cores de identidade (creme, azul claro, amarelo) sao claras e parecidas
// demais entre si: num grafico viram manchas indistinguiveis. Estes sao tons
// mais profundos, validados nos criterios de leitura — faixa de luminosidade,
// saturacao minima, separacao para daltonismo e contraste com o fundo — sobre
// o cartao branco e sobre o creme.
//
// A ordem e fixa e nunca e embaralhada: a cor acompanha a categoria, nao a
// posicao dela no ranking, entao filtrar por periodo nao repinta o grafico.
var PALETA_CATEGORIAS = [
  '#7A9E2E', // verde-oliva
  '#C25A56', // vermelho
  '#0FA093', // turquesa
  '#8A6BC4', // roxo
  '#B8862B', // mostarda
  '#2E9E6B', // verde
  '#4C7BD9', // azul
  '#C4703A'  // terracota
];
var COR_OUTROS = '#6E8A84';   // neutro do tema, para "Sem categoria"

// A fresta entre as fatias usa a cor do cartao, entao acompanha o tema.
function corDoCartao(){
  var v = getComputedStyle(document.documentElement).getPropertyValue('--surface');
  return (v && v.trim()) || '#07333A';
}

// Cor de uma categoria: a escolhida pelo usuario, senao a da paleta pela
// ordem de criacao (estavel, nao muda quando se filtra o periodo).
function corDaCategoria(cat){
  if (cat && cat.cor) return cat.cor;
  var i = (cat && state.categorias) ? state.categorias.findIndex(function(c){ return c.id === cat.id; }) : -1;
  if (i < 0) return COR_OUTROS;
  return PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
}

// Proxima cor livre, para uma categoria nova nascer com cor propria.
function proximaCorCategoria(){
  var usadas = (state.categorias || []).map(function(c){ return (c.cor || '').toUpperCase(); });
  for (var i = 0; i < PALETA_CATEGORIAS.length; i++) {
    if (usadas.indexOf(PALETA_CATEGORIAS[i]) === -1) return PALETA_CATEGORIAS[i];
  }
  return PALETA_CATEGORIAS[(state.categorias || []).length % PALETA_CATEGORIAS.length];
}

// As categorias criadas antes desta mudanca nasceram todas com o roxo que era
// o padrao do seletor de cor. Esta migracao roda uma vez e da a cada uma a sua
// cor da paleta. Escolhas feitas depois disso sao respeitadas.
var VERSAO_PALETA = 2;   // suba este numero sempre que a paleta mudar
function migrarCoresCategorias(){
  if (!state.categorias) return false;
  if (state._paletaCategorias === VERSAO_PALETA) return false;
  state.categorias.forEach(function(c, i){
    c.cor = PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length];
  });
  state._paletaCategorias = VERSAO_PALETA;
  return true;
}

var pizzaSlices = [];

function renderPizzaChart(lista) {
  var canvas = document.getElementById('pizza-chart');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W/2, cy = H/2, R = 78, r = 50;
  ctx.clearRect(0,0,W,H);
  pizzaSlices = [];

  var bycat = {};
  lista.forEach(function(g){
    var key = g.categoriaId || '__none__';
    bycat[key] = (bycat[key]||0) + parseFloat(g.valor||0);
  });

  var keys = Object.keys(bycat);
  var total = lista.reduce(function(s,g){return s+parseFloat(g.valor||0);},0);

  if(!total || !keys.length) {
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.arc(cx,cy,r,0,Math.PI*2,true);
    ctx.fillStyle='rgba(255,255,255,0.05)';
    ctx.fill();
    var leg = document.getElementById('pizza-legend');
    if(leg) leg.innerHTML='<div style="color:var(--text-muted);font-size:12px;text-align:center">Nenhum gasto ainda</div>';
    return;
  }

  var startAngle = -Math.PI/2;
  var GAP = 0.03;
  var legend = [];

  keys.forEach(function(key) {
    var cat = getCat(key);
    var cor = cat ? corDaCategoria(cat) : COR_OUTROS;
    var nome = cat ? cat.nome : 'Sem categoria';
    var val = bycat[key];
    var sliceAngle = (val/total)*Math.PI*2;
    var endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(cx + r*Math.cos(startAngle+GAP), cy + r*Math.sin(startAngle+GAP));
    ctx.arc(cx, cy, R, startAngle+GAP, endAngle-GAP);
    ctx.arc(cx, cy, r, endAngle-GAP, startAngle+GAP, true);
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    // Fresta na cor do fundo separando as fatias: ajuda a distinguir vizinhas
    // mesmo para quem nao diferencia bem as duas cores.
    ctx.lineWidth = 2;
    ctx.strokeStyle = corDoCartao();
    ctx.stroke();

    pizzaSlices.push({
      startAngle: startAngle+GAP, endAngle: endAngle-GAP,
      cor: cor, nome: nome, val: val,
      pct: ((val/total)*100).toFixed(1)
    });

    legend.push({cor:cor, nome:nome, val:val, pct:((val/total)*100).toFixed(0)});
    startAngle = endAngle;
  });

  var leg2 = document.getElementById('pizza-legend');
  if(leg2) {
    leg2.innerHTML = legend.map(function(l){
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
        +'<div style="display:flex;align-items:center;gap:8px">'
          +'<div style="width:12px;height:12px;border-radius:50%;background:'+l.cor+';flex-shrink:0;border:2px solid var(--ink)"></div>'
          +'<span style="font-size:13px">'+esc(l.nome)+'</span>'
        +'</div>'
        +'<div style="font-size:12px;font-weight:600;color:var(--text-dim)">'+l.pct+'% <span style="color:var(--text-muted);font-weight:400">R$ '+l.val.toFixed(2).replace('.',',')+'</span></div>'
      +'</div>';
    }).join('');
  }
}

// Pizza tooltip
document.addEventListener('DOMContentLoaded', function(){
  var canvas = document.getElementById('pizza-chart');
  if(!canvas) return;
  var tooltip = document.createElement('div');
  tooltip.id = 'pizza-tooltip';
  tooltip.style.cssText = 'position:fixed;display:none;background:#FFF8DE;border:2px solid #1C2547;border-radius:12px;padding:10px 14px;font-size:12px;pointer-events:none;z-index:800;min-width:140px;box-shadow:0 8px 24px rgba(28,37,71,.18)';
  document.body.appendChild(tooltip);

  canvas.addEventListener('mousemove', function(e){
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (e.clientX - rect.left) * scaleX - canvas.width/2;
    var y = (e.clientY - rect.top) * scaleY - canvas.height/2;
    var dist = Math.sqrt(x*x + y*y);
    var R = 78, r = 50;
    if(dist >= r && dist <= R && pizzaSlices.length){
      var angle = Math.atan2(y, x);
      if(angle < -Math.PI/2) angle += Math.PI*2;
      var hit = null;
      for(var i=0;i<pizzaSlices.length;i++){
        var s = pizzaSlices[i];
        var sa = s.startAngle < -Math.PI/2 ? s.startAngle + Math.PI*2 : s.startAngle;
        var ea = s.endAngle < -Math.PI/2 ? s.endAngle + Math.PI*2 : s.endAngle;
        var a = angle < sa ? angle + Math.PI*2 : angle;
        if(a >= sa && a <= ea){ hit = s; break; }
      }
      if(hit){
        tooltip.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
          +'<div style="width:10px;height:10px;border-radius:50%;background:'+hit.cor+'"></div>'
          +'<strong>'+esc(hit.nome)+'</strong></div>'
          +'<div style="color:rgba(240,234,255,0.6)">'+hit.pct+'% do total</div>'
          +'<div style="font-size:16px;font-weight:700;margin-top:4px">R$ '+hit.val.toFixed(2).replace('.',',')+'</div>';
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14)+'px';
        tooltip.style.top = (e.clientY - 20)+'px';
        canvas.style.cursor = 'pointer';
      } else {
        tooltip.style.display = 'none';
        canvas.style.cursor = 'default';
      }
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor = 'default';
    }
  });
  canvas.addEventListener('mouseleave', function(){
    tooltip.style.display = 'none';
  });
});

// ─── GASTOS ──────────────────────────────────────────────
var gastosFiltro = 'mes';
var gastosCalFilter = null;

function setGastosFiltro(tipo, el) {
  gastosFiltro = tipo;
  gastosCalFilter = null;
  document.querySelectorAll('.gastos-filter-btn').forEach(function(b){b.classList.remove('active');});
  if(el) el.classList.add('active');
  document.getElementById('gastos-cal-picker').style.display = 'none';
  renderGastos();
}

function toggleGastosCal() {
  var el = document.getElementById('gastos-cal-picker');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  document.getElementById('cal-filter-year').value = new Date().getFullYear();
}

function applyCalFilter() {
  var month = document.getElementById('cal-filter-month').value;
  var year = parseInt(document.getElementById('cal-filter-year').value);
  gastosCalFilter = { month: month === '' ? null : parseInt(month), year: year };
  gastosFiltro = 'custom';
  document.querySelectorAll('.gastos-filter-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('gastos-cal-picker').style.display = 'none';
  renderGastos();
}

function getGastosFiltrados() {
  if(!state.gastos) return [];
  var lista = state.gastos.slice();
  var now = new Date();
  if(gastosCalFilter) {
    lista = lista.filter(function(g) {
      var d = new Date(g.data + 'T12:00:00');
      var yearMatch = d.getFullYear() === gastosCalFilter.year;
      var monthMatch = gastosCalFilter.month === null || d.getMonth() === gastosCalFilter.month;
      return yearMatch && monthMatch;
    });
  } else if(gastosFiltro === 'mes') {
    lista = lista.filter(function(g){
      var d=new Date(g.data+'T12:00:00');
      return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    });
  } else if(gastosFiltro === 'semana') {
    var weekAgo = new Date(now - 7*86400000);
    lista = lista.filter(function(g){return new Date(g.data+'T12:00:00')>=weekAgo;});
  } else if(gastosFiltro === 'hoje') {
    var todayStr = now.toDateString();
    lista = lista.filter(function(g){return new Date(g.data+'T12:00:00').toDateString()===todayStr;});
  } else if(gastosFiltro === 'ano') {
    lista = lista.filter(function(g){return new Date(g.data+'T12:00:00').getFullYear()===now.getFullYear();});
  }
  return lista;
}

function renderGastos(){
  if(!document.getElementById('gastos-total')) return;
  if(!state.gastos) state.gastos = [];
  if(!state.categorias) state.categorias = [];

  var lista = getGastosFiltrados();
  var total = lista.reduce(function(s,g){return s+parseFloat(g.valor||0);},0);
  document.getElementById('gastos-total').textContent = 'R$ '+total.toFixed(2).replace('.',',');
  document.getElementById('gastos-count').textContent = lista.length;
  var ptl = document.getElementById('pizza-total-label');
  if(ptl) ptl.textContent = 'R$ '+total.toFixed(0);

  // ── Render pizza chart ──
  renderPizzaChart(lista);

  // ── Collapsible grouped list ──
  var listEl = document.getElementById('gastos-lista');
  if(!listEl) return;

  if(!lista.length){
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div><p>Nenhum gasto no período selecionado.</p></div>';
  } else {
    // Group by category
    var bycat = {};
    lista.forEach(function(g){
      var key = g.categoriaId || '__none__';
      if(!bycat[key]) bycat[key] = [];
      bycat[key].push(g);
    });

    var html = '';

    Object.keys(bycat).forEach(function(key, gi) {
      var cat = getCat(key);
      var cor = cat ? corDaCategoria(cat) : COR_OUTROS;
      var nome = cat ? cat.nome : 'Sem categoria';
      var items = bycat[key];
      var subtotal = items.reduce(function(s,g){return s+parseFloat(g.valor||0);},0);
      var groupId = 'gasto-group-'+gi;

      html += '<div class="gasto-group-card">'
        +'<div class="gasto-group-header" data-gid="'+groupId+'" style="cursor:pointer">'
          +'<div class="gasto-group-dot" style="background:'+cor+'"></div>'
          +'<div class="gasto-group-name">'+esc(nome)+'</div>'
          +'<span class="gasto-group-count">'+items.length+' item'+(items.length>1?'s':'')+'</span>'
          +'<div class="gasto-group-total">R$ '+subtotal.toFixed(2).replace('.',',')+'</div>'
          +'<div class="gasto-group-arrow" id="arr-'+groupId+'">›</div>'
        +'</div>'
        +'<div class="gasto-group-body" id="'+groupId+'">';

      items.slice().sort(function(a,b){return new Date(b.data)-new Date(a.data);}).forEach(function(g){
        var dataFmt = g.data ? new Date(g.data+'T12:00:00').toLocaleDateString('pt-BR') : '';
        var parcelaBadge = g.parcelas ? '<span class="parcela-badge">'+g.parcelaAtual+'/'+g.parcelas+'x</span>' : '';
        html += '<div class="gasto-item">'
          +'<div class="gasto-cat-dot" style="background:'+cor+'"></div>'
          +'<div class="gasto-item-info">'
            +'<div class="gasto-item-desc">'+esc(g.desc)+parcelaBadge+'</div>'
            +'<div class="gasto-item-meta">'+dataFmt+(g.juros?' • Juros '+g.juros+'%':'')+'</div>'
          +'</div>'
          +'<div class="gasto-item-valor">R$ '+parseFloat(g.valor).toFixed(2).replace('.',',')+'</div>'
          +'<div class="gasto-item-actions">'
            +'<div class="icon-btn gasto-edit-btn" data-id="'+g.id+'" title="Editar">✏️</div>'
            +'<div class="icon-btn danger gasto-del-btn" data-id="'+g.id+'" title="Excluir">🗑</div>'
          +'</div>'
        +'</div>';
      });

      html += '</div></div>';
    });

    listEl.innerHTML = html;
  }

  // ── Metas/tarefas previstas ──
  var all = state.metas.filter(function(m){return m.budget;}).concat(state.tasks.filter(function(t){return t.budget;}));
  var byG = {};
  all.forEach(function(i){var g=i.group||'Sem grupo';byG[g]=(byG[g]||0)+parseFloat(i.budget||0);});
  var gBar = document.getElementById('gastos-groups-bars');
  var keys = Object.keys(byG);
  if(gBar) {
    if(!keys.length){
      gBar.innerHTML='<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Nenhum item com valor previsto.</div>';
    } else {
      var maxV=Math.max.apply(null,keys.map(function(k){return byG[k];}));
      gBar.innerHTML=keys.map(function(g){
        return '<div class="group-bar-item"><div class="group-bar-header"><span>'+esc(g)+'</span><span>R$ '+byG[g].toFixed(2).replace('.',',')+'</span></div>'
          +'<div class="progress-bar-track"><div class="progress-bar-fill" style="width:'+(byG[g]/maxV*100).toFixed(0)+'%"></div></div></div>';
      }).join('');
    }
  }

  var ml = document.getElementById('gastos-metas-list');
  if(ml) {
    var mf = state.metas.filter(function(m){return m.budget;});
    ml.innerHTML = mf.length ? mf.map(function(m){return gastoRow('🎯',m);}).join('') : '<div class="empty-state"><p>Nenhuma meta com valor.</p></div>';
  }
  var tl = document.getElementById('gastos-tasks-list');
  if(tl) {
    var tf = state.tasks.filter(function(t){return t.budget;});
    tl.innerHTML = tf.length ? tf.map(function(t){return gastoRow('✅',t);}).join('') : '<div class="empty-state"><p>Nenhuma tarefa com valor.</p></div>';
  }
}

function toggleGastoGroup(id) {
  var body = document.getElementById(id);
  var arrow = document.getElementById('arr-'+id);
  if(!body || !arrow) return;
  var isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  arrow.classList.toggle('open', !isOpen);
}

function gastoRow(icon,item){return '<div class="gasto-row"><div class="gasto-icon">'+icon+'</div><div class="gasto-info"><div class="gasto-name">'+esc(item.name)+'</div><div class="gasto-meta">'+(item.group||'Sem grupo')+' • '+(item.deadline||'Sem prazo')+'</div></div><div class="gasto-value">R$ '+parseFloat(item.budget).toFixed(2).replace('.',',')+'</div></div>';}
function switchGastosTab(tabId,btn){document.querySelectorAll('#page-gastos .tab-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');document.getElementById('metas-tab').style.display=tabId==='metas-tab'?'':'none';document.getElementById('tasks-tab').style.display=tabId==='tasks-tab'?'':'none';}

// ─── ADICIONAR/EDITAR GASTO ──────────────────────────────
var _installmentOn = false;
var _jurosOn = false;

function updateCategoriaSelect() {
  var sel = document.getElementById('gasto-categoria');
  if(!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">Sem categoria</option>'
    + (state.categorias||[]).map(function(c){
        return '<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+esc(c.nome)+'</option>';
      }).join('');
}

function openModal_addGasto() {
  document.getElementById('gasto-modal-title').textContent = 'Novo gasto';
  document.getElementById('gasto-edit-id').value = '';
  document.getElementById('gasto-desc').value = '';
  document.getElementById('gasto-valor').value = '';
  document.getElementById('gasto-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('gasto-parcelas').value = '2';
  document.getElementById('gasto-valor-parcela').value = '';
  document.getElementById('gasto-juros').value = '';
  _installmentOn = false;
  _jurosOn = false;
  document.getElementById('installment-toggle-sw').className = 'toggle-switch';
  document.getElementById('juros-toggle-sw').className = 'toggle-switch';
  document.getElementById('installment-wrap').style.display = 'none';
  document.getElementById('juros-wrap').style.display = 'none';
  document.getElementById('installment-preview').textContent = 'Preencha o valor e número de parcelas para visualizar.';
  updateCategoriaSelect();
  openModal('modal-add-gasto');
}

function toggleInstallment() {
  _installmentOn = !_installmentOn;
  document.getElementById('installment-toggle-sw').className = 'toggle-switch' + (_installmentOn?' on':'');
  document.getElementById('installment-wrap').style.display = _installmentOn ? 'block' : 'none';
  if(_installmentOn) calcInstallments();
}

function toggleJuros() {
  _jurosOn = !_jurosOn;
  document.getElementById('juros-toggle-sw').className = 'toggle-switch' + (_jurosOn?' on':'');
  document.getElementById('juros-wrap').style.display = _jurosOn ? 'block' : 'none';
  calcInstallments();
}

function calcInstallments() {
  if(!_installmentOn) return;
  var valor = parseFloat(document.getElementById('gasto-valor').value) || 0;
  var n = parseInt(document.getElementById('gasto-parcelas').value) || 2;
  var taxa = _jurosOn ? (parseFloat(document.getElementById('gasto-juros').value) || 0) / 100 : 0;
  var tipo = document.getElementById('gasto-juros-tipo') ? document.getElementById('gasto-juros-tipo').value : 'simples';

  var valorParcela = 0;
  var totalComJuros = valor;

  if(valor > 0 && n > 0) {
    if(taxa === 0) {
      valorParcela = valor / n;
    } else if(tipo === 'simples') {
      totalComJuros = valor * (1 + taxa * n);
      valorParcela = totalComJuros / n;
    } else {
      // Composto: PMT = PV * i / (1-(1+i)^-n)
      valorParcela = valor * taxa / (1 - Math.pow(1+taxa, -n));
      totalComJuros = valorParcela * n;
    }
    document.getElementById('gasto-valor-parcela').value = valorParcela.toFixed(2);

    var rows = '';
    for(var i=1;i<=Math.min(n,12);i++){
      rows += '<tr><td>'+i+'ª parcela</td><td>R$ '+valorParcela.toFixed(2).replace('.',',')+'</td></tr>';
    }
    if(n>12) rows += '<tr><td colspan="2" style="color:var(--text-muted)">... e mais '+(n-12)+' parcelas</td></tr>';

    document.getElementById('installment-preview').innerHTML =
      '<table><thead><tr><th>Parcela</th><th>Valor</th></tr></thead><tbody>'+rows+'</tbody></table>'
      +'<div style="margin-top:8px;display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">'
        +'<span style="color:var(--text-muted)">Total com juros:</span>'
        +'<span style="font-weight:700;color:var(--purple-light)">R$ '+totalComJuros.toFixed(2).replace('.',',')+'</span>'
      +'</div>';
  }
}

function onParcelaManualEdit() {
  // User manually typed parcela value — recalculate total
  var parcela = parseFloat(document.getElementById('gasto-valor-parcela').value) || 0;
  var n = parseInt(document.getElementById('gasto-parcelas').value) || 2;
  if(parcela > 0 && n > 0) {
    document.getElementById('gasto-valor').value = (parcela * n).toFixed(2);
    calcInstallments();
  }
}

function saveGasto() {
  var desc = document.getElementById('gasto-desc').value.trim();
  var valor = parseFloat(document.getElementById('gasto-valor').value);
  var catId = document.getElementById('gasto-categoria').value;
  var data = document.getElementById('gasto-data').value;
  var editId = document.getElementById('gasto-edit-id').value;

  if(!desc){ toast('⚠️ Informe uma descrição.'); return; }
  if(!valor||valor<=0){ toast('⚠️ Informe um valor válido.'); return; }
  if(!data){ toast('⚠️ Informe uma data.'); return; }

  if(!state.gastos) state.gastos = [];

  if(_installmentOn) {
    var n = parseInt(document.getElementById('gasto-parcelas').value) || 2;
    var taxa = _jurosOn ? (parseFloat(document.getElementById('gasto-juros').value)||0) : 0;
    var tipo = document.getElementById('gasto-juros-tipo').value;
    var valorParcela = parseFloat(document.getElementById('gasto-valor-parcela').value) || (valor/n);
    // Create one entry per installment
    var dataBase = new Date(data+'T12:00:00');
    for(var i=0;i<n;i++){
      var d = new Date(dataBase);
      d.setMonth(d.getMonth()+i);
      var dStr = d.toISOString().slice(0,10);
      state.gastos.push({
        id:uid(), desc:desc, valor:valorParcela, categoriaId:catId,
        data:dStr, parcelas:n, parcelaAtual:i+1,
        juros:taxa, jurosTipo:tipo,
        createdAt:new Date().toISOString()
      });
    }
    toast('💳 '+n+' parcelas criadas!');
  } else {
    if(editId) {
      var g = state.gastos.find(function(x){return x.id===editId;});
      if(g){ g.desc=desc; g.valor=valor; g.categoriaId=catId; g.data=data; }
      toast('✏️ Gasto atualizado!');
    } else {
      state.gastos.push({id:uid(),desc:desc,valor:valor,categoriaId:catId,data:data,createdAt:new Date().toISOString()});
      toast('💸 Gasto registrado!');
    }
  }
  saveState();
  closeModal('modal-add-gasto');
  renderGastos();
}

function editGasto(id) {
  var g = (state.gastos||[]).find(function(x){return x.id===id;});
  if(!g) return;
  document.getElementById('gasto-modal-title').textContent = 'Editar gasto';
  document.getElementById('gasto-edit-id').value = g.id;
  document.getElementById('gasto-desc').value = g.desc;
  document.getElementById('gasto-valor').value = g.valor;
  document.getElementById('gasto-data').value = g.data;
  _installmentOn = false;
  _jurosOn = false;
  document.getElementById('installment-toggle-sw').className = 'toggle-switch';
  document.getElementById('juros-toggle-sw').className = 'toggle-switch';
  document.getElementById('installment-wrap').style.display = 'none';
  document.getElementById('juros-wrap').style.display = 'none';
  updateCategoriaSelect();
  document.getElementById('gasto-categoria').value = g.categoriaId||'';
  openModal('modal-add-gasto');
}

function deleteGasto(id) {
  document.getElementById('confirm-icon').textContent = '🗑';
  document.getElementById('confirm-title').textContent = 'Excluir gasto';
  document.getElementById('confirm-body').textContent = 'Excluir este lançamento permanentemente?';
  document.getElementById('confirm-ok-btn').textContent = 'Excluir';
  document.getElementById('confirm-ok-btn').onclick = function(){
    state.gastos = (state.gastos||[]).filter(function(g){return g.id!==id;});
    saveState(); closeModal('modal-confirm'); renderGastos(); toast('🗑 Gasto excluído!'); resetConfirmBtn();
  };
  openModal('modal-confirm');
}

// ─── CATEGORIAS ──────────────────────────────────────────
var _catFromGasto = false; // track if categoria modal was opened from gasto modal

function openCatFromGasto() {
  _catFromGasto = true;
  closeModal('modal-add-gasto');
  openModal('modal-add-categoria');
}

function closeCatBackToGasto() {
  closeModal('modal-add-categoria');
  if(_catFromGasto) {
    _catFromGasto = false;
    // Re-open add-gasto with current values preserved
    updateCategoriaSelect();
    openModal('modal-add-gasto');
  }
}

function saveCategoria() {
  var nome = document.getElementById('cat-nome').value.trim();
  var cor = document.getElementById('cat-cor').value;
  if(!nome){ toast('⚠️ Informe um nome.'); return; }
  if(!state.categorias) state.categorias = [];
  state.categorias.push({id:uid(),nome:nome,cor:cor});
  saveState();
  document.getElementById('cat-nome').value = '';
  renderCategoriasList();
  updateCategoriaSelect();
  toast('🏷️ Categoria criada!');
}

// Sugere a proxima cor da paleta ao abrir o formulario de categoria nova.
function sugerirCorCategoria(){
  var el = document.getElementById('cat-cor');
  if (el) el.value = proximaCorCategoria();
}

function renderCategoriasList() {
  var el = document.getElementById('categorias-list');
  if(!el) return;
  el.innerHTML = '';
  if(!state.categorias||!state.categorias.length){
    el.innerHTML='<div style="color:var(--text-muted);font-size:13px">Nenhuma categoria ainda.</div>';
    return;
  }
  state.categorias.forEach(function(c) {
    var row = document.createElement('div');
    row.className = 'cat-chip-item';
    var left = document.createElement('div');
    left.className = 'cat-chip-left';
    var dot = document.createElement('div');
    dot.className = 'cat-color-dot';
    dot.style.background = c.cor;
    var name = document.createElement('span');
    name.className = 'cat-chip-name';
    name.textContent = c.nome;
    left.appendChild(dot);
    left.appendChild(name);
    var btn = document.createElement('div');
    btn.className = 'icon-btn danger';
    btn.textContent = '🗑';
    btn.onclick = (function(id){ return function(){ deleteCategoria(id); }; })(c.id);
    row.appendChild(left);
    row.appendChild(btn);
    el.appendChild(row);
  });
}

function deleteCategoria(id) {
  state.categorias = (state.categorias||[]).filter(function(c){return c.id!==id;});
  // Remove from gastos too
  (state.gastos||[]).forEach(function(g){if(g.categoriaId===id)g.categoriaId='';});
  saveState();
  renderCategoriasList();
  updateCategoriaSelect();
  renderGastos();
  toast('🗑 Categoria excluída!');
}

// Event delegation for gasto buttons
document.addEventListener('click', function(e) {
  // Collapsible group header
  var header = e.target.closest('.gasto-group-header');
  if(header && header.dataset.gid) {
    toggleGastoGroup(header.dataset.gid);
    return;
  }
  // Edit / delete buttons
  var editBtn = e.target.closest('.gasto-edit-btn');
  if(editBtn){ editGasto(editBtn.dataset.id); return; }
  var delBtn = e.target.closest('.gasto-del-btn');
  if(delBtn){ deleteGasto(delBtn.dataset.id); return; }
});
