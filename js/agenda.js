// AGENDA — calendario, eventos, participantes e contatos.

// CALENDAR
var calState={};
function toggleCal(calId){
  var cal=document.getElementById(calId),isOpen=cal.classList.contains('open');
  document.querySelectorAll('.calendar-dropdown').forEach(function(c){c.classList.remove('open');});
  if(!isOpen){
    if(!calState[calId]){var now=new Date();calState[calId]={year:now.getFullYear(),month:now.getMonth()};}
    cal.classList.add('open');renderCal(calId);
    setTimeout(function(){document.addEventListener('click',function closer(e){if(!cal.contains(e.target)){cal.classList.remove('open');document.removeEventListener('click',closer);}});},100);
  }
}
function renderCal(calId){
  var cal=document.getElementById(calId),s=calState[calId];
  var inputId=calId==='cal-meta'?'meta-deadline':'task-deadline';
  var months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var days=['D','S','T','Q','Q','S','S'];
  var first=new Date(s.year,s.month,1),lastDay=new Date(s.year,s.month+1,0).getDate(),startDow=first.getDay(),today=new Date();
  var yearOpts='';for(var y=today.getFullYear()-2;y<=today.getFullYear()+5;y++)yearOpts+='<option value="'+y+'"'+(y===s.year?' selected':'')+'>'+y+'</option>';
  var monthOpts=months.map(function(m,i){return '<option value="'+i+'"'+(i===s.month?' selected':'')+'>'+m+'</option>';}).join('');
  var cells='';for(var i=0;i<startDow;i++)cells+='<div class="cal-day other-month"></div>';
  for(var d=1;d<=lastDay;d++){var isToday=d===today.getDate()&&s.month===today.getMonth()&&s.year===today.getFullYear();var val=pad(d)+'/'+pad(s.month+1)+'/'+s.year;cells+='<div class="cal-day'+(isToday?' today':'')+'" onclick="selectDate(\''+calId+'\',\''+inputId+'\',\''+val+'\')">'+d+'</div>';}
  cal.innerHTML='<div class="cal-nav"><button class="cal-nav-btn" onclick="moveCal(\''+calId+'\',-1)">&#8249;</button><div class="cal-month-year"><select class="cal-select" onchange="calState[\''+calId+'\'].month=parseInt(this.value);renderCal(\''+calId+'\')">'+monthOpts+'</select><select class="cal-select" onchange="calState[\''+calId+'\'].year=parseInt(this.value);renderCal(\''+calId+'\')">'+yearOpts+'</select></div><button class="cal-nav-btn" onclick="moveCal(\''+calId+'\',1)">&#8250;</button></div><div class="cal-grid">'+days.map(function(d){return '<div class="cal-dow">'+d+'</div>';}).join('')+cells+'</div>';
}
function moveCal(calId,dir){var s=calState[calId];s.month+=dir;if(s.month<0){s.month=11;s.year--;}if(s.month>11){s.month=0;s.year++;}renderCal(calId);}
function selectDate(calId,inputId,val){document.getElementById(inputId).value=val;document.getElementById(calId).classList.remove('open');}
function pad(n){return n<10?'0'+n:''+n;}

// ─── AGENDA ──────────────────────────────────────────────

var agendaView = 'mes';
var agendaYear = new Date().getFullYear();
var agendaMonth = new Date().getMonth();
var agendaSelectedDay = null;
var _repetirOn = false;
var _lembreteOn = false;
var _eventoIconeSel = 'calendar';
var _eventoParticipantes = [];
var _editQueue = [];

// 20 outline SVG icons for events
var EVENTO_ICONS = {
  'calendar':  '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  'car':       '<svg viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  'flower':    '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  'heart':     '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'sun':       '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  'moon':      '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  'book':      '<svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  'dumbbell':  '<svg viewBox="0 0 24 24"><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="18" y1="7" x2="18" y2="17"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/></svg>',
  'leaf':      '<svg viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 19.62L3 21l1.5-1.5C6.5 17 10 16 14 16c4 0 7.2-3.2 7.2-7.2C21.2 5.6 18.4 3 15 3S8.8 5.6 8.8 9c0 1.2.4 2.4 1 3.4"/></svg>',
  'hospital':  '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  'plane':     '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
  'tennis':    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1 4-10"/></svg>',
  'utensils':  '<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="11"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h2zm0 0v7"/></svg>',
  'film':      '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
  'dog':       '<svg viewBox="0 0 24 24"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2 .336-3.5 2.114-3.5 4.5 0 4.814 3.211 6.317 3.211 6.317L5 22h14l-1.211-8.183S21 12.314 21 7.5c0-2.386-1.5-4.164-3.5-4.5-1.923-.321-3.5.782-3.5 2.172"/><path d="M7 22c0-2 2-3 5-3s5 1 5 3"/></svg>',
  'cat':       '<svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>',
  'users':     '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  'cake':      '<svg viewBox="0 0 24 24"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><line x1="2" y1="21" x2="22" y2="21"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>',
  'shoes':     '<svg viewBox="0 0 24 24"><path d="M2 12h1.5a2.5 2.5 0 0 1 2.5 2.5A3.5 3.5 0 0 0 9.5 18H20a2 2 0 0 0 0-4h-2.5A4.5 4.5 0 0 1 13 9.5V8a2 2 0 0 0-2-2H8.06a2 2 0 0 0-1.94 1.52L5.5 10.5"/><path d="M2 12v5a2 2 0 0 0 2 2"/></svg>',
  'star':      '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};

// ── RENDER ──
function renderAgenda() {
  if(!document.getElementById('page-agenda')) return;
  if(!state.eventos) state.eventos = [];
  if(!state.contatos) state.contatos = [];
  renderIconGrid();
  renderCalendar();
  renderUpcoming();
  updateAgendaHeader();
  // Sync selects
  var ms = document.getElementById('agenda-month-sel');
  var yi = document.getElementById('agenda-year-inp');
  if(ms) ms.value = agendaMonth;
  if(yi) yi.value = agendaYear;
}

function updateAgendaHeader() {
  var months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var el = document.getElementById('agenda-current-label');
  if(el) el.textContent = months[agendaMonth] + ' ' + agendaYear;
}

function setAgendaView(view, btn) {
  agendaView = view;
  document.querySelectorAll('.agenda-view-btn').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderCalendar();
}

function moveAgenda(dir) {
  agendaMonth += dir;
  if(agendaMonth > 11){ agendaMonth = 0; agendaYear++; }
  if(agendaMonth < 0){ agendaMonth = 11; agendaYear--; }
  updateAgendaHeader();
  var ms = document.getElementById('agenda-month-sel');
  var yi = document.getElementById('agenda-year-inp');
  if(ms) ms.value = agendaMonth;
  if(yi) yi.value = agendaYear;
  renderCalendar();
}

function goToToday() {
  var now = new Date();
  agendaMonth = now.getMonth();
  agendaYear = now.getFullYear();
  updateAgendaHeader();
  renderCalendar();
}

function jumpAgendaMonth() {
  var ms = document.getElementById('agenda-month-sel');
  var yi = document.getElementById('agenda-year-inp');
  if(ms) agendaMonth = parseInt(ms.value);
  if(yi) agendaYear = parseInt(yi.value) || new Date().getFullYear();
  updateAgendaHeader();
  renderCalendar();
}

// ── CALENDAR RENDER ──
function renderCalendar() {
  var grid = document.getElementById('agenda-grid');
  if(!grid) return;
  var now = new Date();
  var firstDay = new Date(agendaYear, agendaMonth, 1).getDay();
  var daysInMonth = new Date(agendaYear, agendaMonth + 1, 0).getDate();
  var daysInPrev = new Date(agendaYear, agendaMonth, 0).getDate();

  var cells = [];
  // Prev month filler
  for(var i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, month: agendaMonth - 1, year: agendaMonth === 0 ? agendaYear - 1 : agendaYear, other: true });
  }
  // Current month
  for(var d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: agendaMonth, year: agendaYear, other: false });
  }
  // Next month filler
  var remaining = 42 - cells.length;
  for(var n = 1; n <= remaining; n++) {
    cells.push({ day: n, month: agendaMonth + 1, year: agendaMonth === 11 ? agendaYear + 1 : agendaYear, other: true });
  }

  grid.innerHTML = cells.map(function(c) {
    var dateStr = c.year + '-' + pad(c.month + 1) + '-' + pad(c.day);
    var isToday = !c.other && c.day === now.getDate() && c.month === now.getMonth() && c.year === now.getFullYear();
    var isSel = dateStr === agendaSelectedDay;
    var dayEvents = (state.eventos || []).filter(function(e){ return e.data === dateStr; });

    var chipsHtml = dayEvents.slice(0,2).map(function(ev) {
      var icon = EVENTO_ICONS[ev.icone] ? '<span style="width:10px;height:10px;display:inline-flex">' + EVENTO_ICONS[ev.icone].replace('viewBox', 'width="10" height="10" viewBox') + '</span>' : '';
      return '<div class="agenda-event-chip importancia-' + (ev.importancia||'padrao') + '" data-eid="' + ev.id + '">' + icon + esc(ev.nome||'') + '</div>';
    }).join('');
    if(dayEvents.length > 2) chipsHtml += '<div class="agenda-more-chip">+' + (dayEvents.length-2) + ' mais</div>';

    return '<div class="agenda-cell' + (c.other?' other-month':'') + (isToday?' today':'') + (isSel?' selected':'') + '" data-date="' + dateStr + '">'
      + '<div class="agenda-day-num">' + c.day + '</div>'
      + chipsHtml
      + '</div>';
  }).join('');

  // Event delegation for cells
  grid.onclick = function(e) {
    var chip = e.target.closest('.agenda-event-chip');
    if(chip) { e.stopPropagation(); openEventoDetalhe(chip.dataset.eid); return; }
    var cell = e.target.closest('.agenda-cell');
    if(cell) {
      agendaSelectedDay = cell.dataset.date;
      document.querySelectorAll('.agenda-cell').forEach(function(c){ c.classList.remove('selected'); });
      cell.classList.add('selected');
      openDiaDetalhe(cell.dataset.date);
    }
  };
}

function openEventoDetalhe(id) {
  var ev = (state.eventos||[]).find(function(e){ return e.id === id; });
  if(!ev) return;
  openEditarEvento(ev);
}

function openDiaDetalhe(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  var months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('dia-detalhe-titulo').textContent = d.getDate() + ' de ' + months[d.getMonth()] + ' de ' + d.getFullYear();

  var dayEvents = (state.eventos||[]).filter(function(e){ return e.data === dateStr; });
  var listEl = document.getElementById('dia-detalhe-eventos');
  if(!dayEvents.length) {
    listEl.innerHTML = '<div class="empty-state" style="padding:16px 0"><p>Nenhum evento neste dia.</p></div>';
  } else {
    listEl.innerHTML = dayEvents.map(function(ev) {
      var icon = EVENTO_ICONS[ev.icone] ? '<span style="display:inline-flex;width:16px;height:16px;margin-right:6px">' + EVENTO_ICONS[ev.icone].replace('viewBox','width="16" height="16" viewBox') + '</span>' : '';
      var hora = ev.horaInicio ? ev.horaInicio + (ev.horaFim ? ' – ' + ev.horaFim : '') : '';
      return '<div class="gerenciar-item">'
        + '<div style="flex:1"><div class="gerenciar-item-name">' + icon + esc(ev.nome||'') + '</div>'
        + '<div class="gerenciar-item-meta">' + hora + (ev.obs ? ' · ' + esc(ev.obs) : '') + '</div></div>'
        + '<div style="display:flex;gap:6px">'
        + '<div class="icon-btn" onclick="openEditarEvento(state.eventos.find(function(x){return x.id===\'' + ev.id + '\'}))" title="Editar">✏️</div>'
        + '<div class="icon-btn danger" onclick="deleteEvento(\'' + ev.id + '\')" title="Excluir">🗑</div>'
        + '</div></div>';
    }).join('');
  }
  agendaSelectedDay = dateStr;
  openModal('modal-dia-detalhe');
}

function criarEventoDia() {
  closeModal('modal-dia-detalhe');
  resetEventoForm();
  if(agendaSelectedDay) document.getElementById('evento-data').value = agendaSelectedDay;
  openModal('modal-criar-evento');
}

// ── UPCOMING ──
function renderUpcoming() {
  var el = document.getElementById('agenda-upcoming-list');
  if(!el) return;
  var now = new Date(); now.setHours(0,0,0,0);
  var upcoming = (state.eventos||[])
    .filter(function(e){ return new Date(e.data + 'T00:00:00') >= now; })
    .sort(function(a,b){ return new Date(a.data) - new Date(b.data); })
    .slice(0,8);

  if(!upcoming.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Nenhum evento próximo.</div>';
    return;
  }

  var impColors = { padrao:'#6366f1', media:'#eab308', alta:'#E05A55' };
  el.innerHTML = upcoming.map(function(ev) {
    var d = new Date(ev.data + 'T00:00:00');
    var dStr = d.toLocaleDateString('pt-BR', {day:'2-digit',month:'short'});
    var icon = EVENTO_ICONS[ev.icone] ? '<span style="display:inline-flex;width:18px;height:18px">' + EVENTO_ICONS[ev.icone].replace('viewBox','width="18" height="18" viewBox') + '</span>' : '📅';
    return '<div class="agenda-upcoming-item">'
      + '<div class="agenda-upcoming-dot" style="background:' + (impColors[ev.importancia]||impColors.padrao) + '"></div>'
      + '<div class="agenda-upcoming-icon">' + icon + '</div>'
      + '<div class="agenda-upcoming-info">'
        + '<div class="agenda-upcoming-name">' + esc(ev.nome||'') + '</div>'
        + '<div class="agenda-upcoming-meta">' + dStr + (ev.horaInicio ? ' · ' + ev.horaInicio : '') + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

// ── ICON GRID ──
function renderIconGrid() {
  var grid = document.getElementById('evento-icon-grid');
  if(!grid) return;
  grid.innerHTML = Object.keys(EVENTO_ICONS).map(function(key) {
    return '<div class="evento-icon-btn' + (key === _eventoIconeSel ? ' active' : '') + '" data-icon="' + key + '" title="' + key + '">'
      + EVENTO_ICONS[key].replace('viewBox', 'width="18" height="18" viewBox')
      + '</div>';
  }).join('');
  grid.onclick = function(e) {
    var btn = e.target.closest('.evento-icon-btn');
    if(!btn) return;
    _eventoIconeSel = btn.dataset.icon;
    grid.querySelectorAll('.evento-icon-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  };
}

// ── HORARIO SUGESTÕES ──
function updateHorarioSugestoes() {
  var inp = document.getElementById('evento-hora');
  var sug = document.getElementById('horario-sugestoes');
  if(!inp || !sug) return;
  var val = inp.value;
  if(!val) { sug.style.display = 'none'; return; }
  var parts = val.split(':');
  var h = parseInt(parts[0]);
  var m = parseInt(parts[1]);
  var slots = [];
  var base = h * 60 + m;
  [0,30,60,90].forEach(function(offset) {
    var start = base + offset;
    var end = start + 30;
    if(end > 24*60) return;
    var sh = Math.floor(start/60), sm = start%60;
    var eh = Math.floor(end/60), em = end%60;
    slots.push(pad(sh)+':'+pad(sm)+' – '+pad(eh)+':'+pad(em));
  });
  if(!slots.length) { sug.style.display='none'; return; }
  sug.style.display = 'block';
  sug.innerHTML = slots.map(function(s,i) {
    var startTime = s.split(' – ')[0];
    var endTime = s.split(' – ')[1];
    return '<div class="horario-sug-item" onclick="applyHorarioSug(\'' + startTime + '\',\'' + endTime + '\')">' + s + '</div>';
  }).join('');
}

function applyHorarioSug(start, end) {
  document.getElementById('evento-hora').value = start;
  document.getElementById('evento-hora-fim').value = end;
  document.getElementById('horario-sugestoes').style.display = 'none';
}

// ── TOGGLES ──
function toggleRepetirEvento() {
  _repetirOn = !_repetirOn;
  document.getElementById('repetir-toggle').className = 'toggle-switch' + (_repetirOn?' on':'');
  document.getElementById('repetir-wrap').style.display = _repetirOn ? 'block' : 'none';
}

function toggleLembrete() {
  _lembreteOn = !_lembreteOn;
  document.getElementById('lembrete-toggle').className = 'toggle-switch' + (_lembreteOn?' on':'');
  document.getElementById('lembrete-wrap').style.display = _lembreteOn ? 'block' : 'none';
}

// ── PARTICIPANTES ──
function updateParticipanteSelect() {
  var sel = document.getElementById('evento-participante-sel');
  if(!sel) return;
  var contatos = state.contatos || [];
  sel.innerHTML = '<option value="">Selecionar da lista...</option>'
    + contatos.map(function(c){ return '<option value="' + c.id + '">' + esc(c.nome) + ' (' + esc(c.email||'') + ')</option>'; }).join('');
}

function addParticipanteEvento() {
  var sel = document.getElementById('evento-participante-sel');
  if(!sel || !sel.value) return;
  var c = (state.contatos||[]).find(function(x){ return x.id === sel.value; });
  if(!c) return;
  if(_eventoParticipantes.find(function(p){ return p.id === c.id; })) return;
  _eventoParticipantes.push(c);
  renderParticipantesChips();
  sel.value = '';
}

function removeParticipante(id) {
  _eventoParticipantes = _eventoParticipantes.filter(function(p){ return p.id !== id; });
  renderParticipantesChips();
}

function renderParticipantesChips() {
  var el = document.getElementById('evento-participantes-chips');
  if(!el) return;
  el.innerHTML = _eventoParticipantes.map(function(p) {
    return '<span class="participante-chip">' + esc(p.nome)
      + '<button onclick="removeParticipante(\'' + p.id + '\')">✕</button>'
      + '</span>';
  }).join('');
}

// ── CONTATOS ──
function salvarContato() {
  var nome = document.getElementById('contato-nome').value.trim();
  var email = document.getElementById('contato-email').value.trim();
  if(!nome) { toast('⚠️ Informe o nome do contato.'); return; }
  if(!state.contatos) state.contatos = [];
  state.contatos.push({ id: uid(), nome: nome, email: email });
  saveState();
  document.getElementById('contato-nome').value = '';
  document.getElementById('contato-email').value = '';
  renderContatosLista();
  updateParticipanteSelect();
  toast('👥 Contato adicionado!');
}

function renderContatosLista() {
  var el = document.getElementById('contatos-lista');
  if(!el) return;
  var contatos = state.contatos || [];
  if(!contatos.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Nenhum contato ainda.</div>'; return; }
  el.innerHTML = contatos.map(function(c) {
    return '<div class="gerenciar-item">'
      + '<div class="gerenciar-item-info"><div class="gerenciar-item-name">' + esc(c.nome) + '</div>'
      + '<div class="gerenciar-item-meta">' + esc(c.email||'') + '</div></div>'
      + '<div class="icon-btn danger" onclick="deleteContato(\'' + c.id + '\')">🗑</div>'
      + '</div>';
  }).join('');
}

function deleteContato(id) {
  state.contatos = (state.contatos||[]).filter(function(c){ return c.id !== id; });
  saveState(); renderContatosLista(); updateParticipanteSelect();
  toast('🗑 Contato removido!');
}

// ── SALVAR EVENTO ──
function resetEventoForm() {
  ['evento-nome','evento-data','evento-hora','evento-hora-fim','evento-obs'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('evento-importancia').value='padrao';
  _repetirOn=false; _lembreteOn=false;
  _eventoIconeSel='calendar'; _eventoParticipantes=[];
  document.getElementById('repetir-toggle').className='toggle-switch';
  document.getElementById('lembrete-toggle').className='toggle-switch';
  document.getElementById('repetir-wrap').style.display='none';
  document.getElementById('lembrete-wrap').style.display='none';
  document.getElementById('horario-sugestoes').style.display='none';
  document.getElementById('evento-edit-id').value='';
  document.getElementById('evento-modal-title').textContent='Novo evento';
  document.getElementById('evento-participantes-chips').innerHTML='';
  renderIconGrid();
  updateParticipanteSelect();
}

function openEditarEvento(ev) {
  if(!ev) return;
  resetEventoForm();
  document.getElementById('evento-modal-title').textContent='Editar evento';
  document.getElementById('evento-edit-id').value=ev.id;
  document.getElementById('evento-nome').value=ev.nome||'';
  document.getElementById('evento-data').value=ev.data||'';
  document.getElementById('evento-hora').value=ev.horaInicio||'';
  document.getElementById('evento-hora-fim').value=ev.horaFim||'';
  document.getElementById('evento-obs').value=ev.obs||'';
  document.getElementById('evento-importancia').value=ev.importancia||'padrao';
  _eventoIconeSel=ev.icone||'calendar';
  _eventoParticipantes=(ev.participantes||[]).slice();
  renderIconGrid(); renderParticipantesChips();
  if(ev.repeticao){ _repetirOn=true; document.getElementById('repetir-toggle').className='toggle-switch on'; document.getElementById('repetir-wrap').style.display='block'; document.getElementById('evento-repeticao').value=ev.repeticao; }
  if(ev.lembrete){ _lembreteOn=true; document.getElementById('lembrete-toggle').className='toggle-switch on'; document.getElementById('lembrete-wrap').style.display='block'; document.getElementById('evento-lembrete').value=ev.lembrete; }
  closeModal('modal-dia-detalhe');
  openModal('modal-criar-evento');
}

function salvarEvento() {
  var nome = document.getElementById('evento-nome').value.trim();
  var data = document.getElementById('evento-data').value;
  if(!nome){ toast('⚠️ Informe o nome do evento.'); return; }
  if(!data){ toast('⚠️ Informe a data do evento.'); return; }

  if(!state.eventos) state.eventos=[];
  var editId=document.getElementById('evento-edit-id').value;
  var evData = {
    nome:nome, data:data,
    horaInicio:document.getElementById('evento-hora').value,
    horaFim:document.getElementById('evento-hora-fim').value,
    importancia:document.getElementById('evento-importancia').value,
    obs:document.getElementById('evento-obs').value.trim(),
    icone:_eventoIconeSel,
    participantes:_eventoParticipantes.slice(),
    repeticao:_repetirOn?document.getElementById('evento-repeticao').value:null,
    lembrete:_lembreteOn?document.getElementById('evento-lembrete').value:null,
  };

  if(editId) {
    var idx=state.eventos.findIndex(function(e){return e.id===editId;});
    if(idx>=0) state.eventos[idx]=Object.assign({},state.eventos[idx],evData);
    toast('✏️ Evento atualizado!');
  } else {
    evData.id=uid(); evData.createdAt=new Date().toISOString();
    state.eventos.push(evData);
    // Handle recurrence: create copies for future dates
    if(evData.repeticao) {
      var baseDate=new Date(data+'T12:00:00');
      var intervals={semanal:7,quinzenal:14,mensal:30,anual:365};
      var days=intervals[evData.repeticao]||7;
      for(var r=1;r<=12;r++){
        var nd=new Date(baseDate.getTime()+r*days*86400000);
        var nEv=Object.assign({},evData,{id:uid(),data:nd.toISOString().slice(0,10),createdAt:new Date().toISOString()});
        state.eventos.push(nEv);
      }
    }
    toast('📅 Evento criado!');
  }

  saveState();
  closeModal('modal-criar-evento');
  resetEventoForm();
  renderCalendar();
  renderUpcoming();
}

function deleteEvento(id) {
  document.getElementById('confirm-icon').textContent='📅';
  document.getElementById('confirm-title').textContent='Excluir evento';
  document.getElementById('confirm-body').textContent='Excluir este evento permanentemente?';
  document.getElementById('confirm-ok-btn').textContent='Excluir';
  document.getElementById('confirm-ok-btn').onclick=function(){
    state.eventos=(state.eventos||[]).filter(function(e){return e.id!==id;});
    saveState(); closeModal('modal-confirm'); closeModal('modal-dia-detalhe');
    renderCalendar(); renderUpcoming(); toast('🗑 Evento excluído!'); resetConfirmBtn();
  };
  openModal('modal-confirm');
}

// ── GERENCIAR ──
function openGerenciarEventos() {
  renderGerenciarLista();
  openModal('modal-gerenciar-eventos');
}

function renderGerenciarLista() {
  var el=document.getElementById('gerenciar-lista');
  if(!el) return;
  var eventos=state.eventos||[];
  if(!eventos.length){ el.innerHTML='<div style="color:var(--text-muted);font-size:13px">Nenhum evento criado ainda.</div>'; return; }
  eventos=eventos.slice().sort(function(a,b){return new Date(a.data)-new Date(b.data);});
  el.innerHTML=eventos.map(function(ev){
    var icon=EVENTO_ICONS[ev.icone]?'<span style="display:inline-flex;width:16px;height:16px">'+EVENTO_ICONS[ev.icone].replace('viewBox','width="16" height="16" viewBox')+'</span>':'📅';
    var d=new Date(ev.data+'T00:00:00').toLocaleDateString('pt-BR');
    return '<div class="gerenciar-item">'
      +'<input type="checkbox" class="gerenciar-cb" data-id="'+ev.id+'">'
      +'<div class="gerenciar-item-icon">'+icon+'</div>'
      +'<div class="gerenciar-item-info"><div class="gerenciar-item-name">'+esc(ev.nome||'')+'</div>'
      +'<div class="gerenciar-item-meta">'+d+(ev.horaInicio?' · '+ev.horaInicio:'')+'</div></div>'
      +'<div class="gerenciar-imp-badge '+ev.importancia+'">'+(ev.importancia==='alta'?'Alta':ev.importancia==='media'?'Média':'Padrão')+'</div>'
      +'</div>';
  }).join('');
}

function getSelectedEventos() {
  return Array.from(document.querySelectorAll('.gerenciar-cb:checked')).map(function(cb){ return cb.dataset.id; });
}

function toggleSelecionarTodos() {
  var cbs=document.querySelectorAll('.gerenciar-cb');
  var allChecked=Array.from(cbs).every(function(c){return c.checked;});
  cbs.forEach(function(c){c.checked=!allChecked;});
}

function excluirEventosSelecionados() {
  var ids=getSelectedEventos();
  if(!ids.length){toast('⚠️ Selecione ao menos um evento.');return;}
  state.eventos=(state.eventos||[]).filter(function(e){return ids.indexOf(e.id)===-1;});
  saveState(); renderGerenciarLista(); renderCalendar(); renderUpcoming();
  toast('🗑 '+ids.length+' evento(s) excluído(s)!');
}

function editarProximoSelecionado() {
  var ids=getSelectedEventos();
  if(!ids.length){toast('⚠️ Selecione ao menos um evento.');return;}
  _editQueue=ids.slice(1);
  var ev=(state.eventos||[]).find(function(e){return e.id===ids[0];});
  closeModal('modal-gerenciar-eventos');
  if(ev) openEditarEvento(ev);
}
