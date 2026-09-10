// LEITURA — estante de livros, filtros, leitura atual e resumos.

// ─── LEITURA ─────────────────────────────────────────────

var _lendoAgoraOn = false;
var _jaLeuSim = false;
var _shelfPopupBookId = null;
var _selectedWebImg = null;
var _shelfFilterVisible = false;

function renderLeitura() {
  if(!document.getElementById('page-leitura')) return;
  if(!state.livros) state.livros = [];
  renderHeroBook();
  renderBookshelf();
  updateResumoBar();
  setupScrollEffect();
}

// ── HERO BOOK ──
function renderHeroBook() {
  var active = (state.livros||[]).find(function(l){ return l.lendoAgora && !l.abandonado; });
  var emptyEl = document.getElementById('leitura-empty-state');
  var activeEl = document.getElementById('leitura-active-book');
  if(!emptyEl || !activeEl) return;

  if(!active) {
    emptyEl.style.display = 'flex';
    activeEl.style.display = 'none';
    return;
  }
  emptyEl.style.display = 'none';
  activeEl.style.display = 'flex';

  var coverImg = document.getElementById('leitura-book-cover-img');
  if(active.cover) {
    coverImg.src = active.cover;
    coverImg.style.display = 'block';
  } else {
    coverImg.style.display = 'none';
  }
  document.getElementById('leitura-book-title-display').textContent = active.titulo || '';
  document.getElementById('leitura-book-author-display').textContent = active.autor || '';
  document.getElementById('leitura-book-genre-display').textContent = active.genero || '';

  var pagesRead = active.paginasLidas || 0;
  var total = parseInt(active.paginas) || 1;
  var pct = Math.min(100, Math.round((pagesRead / total) * 100));
  document.getElementById('leitura-pages-read').textContent = pagesRead + ' páginas lidas';
  document.getElementById('leitura-pct-display').textContent = pct + '%';
  document.getElementById('leitura-progress-bar').style.width = pct + '%';
  document.getElementById('leitura-pages-total').textContent = 'de ' + total + ' páginas';
}

// ── SCROLL EFFECT ──
function setupScrollEffect() {
  var main = document.getElementById('main');
  var hero = document.getElementById('leitura-hero-card');
  if(!main || !hero) return;
  function onScroll() {
    if(main.scrollTop > 80) {
      hero.classList.add('scrolled');
    } else {
      hero.classList.remove('scrolled');
    }
  }
  main.removeEventListener('scroll', main._leituraScroll);
  main._leituraScroll = onScroll;
  main.addEventListener('scroll', onScroll);
}

// ── ESTANTE (grade de capas) ──

// Um livro conta como concluido em tres situacoes: registrar leitura chegou
// ao fim (marca .concluido), o usuario cadastrou o livro dizendo que ja tinha
// lido (.jaLeu), ou as paginas lidas alcancaram o total — o ultimo caso cobre
// livros gravados por versoes antigas, antes de .concluido existir.
function livroConcluido(l){
  if(l.abandonado) return false;
  if(l.concluido || l.jaLeu) return true;
  var total = parseInt(l.paginas) || 0;
  return total > 0 && (l.paginasLidas||0) >= total;
}
function livroPct(l){
  var total = parseInt(l.paginas) || 0;
  if(!total) return 0;
  return Math.min(100, Math.round(((l.paginasLidas||0)/total)*100));
}

function renderBookshelf(filterFn) {
  var container = document.getElementById('estante-grid');
  if(!container) return;
  var livros = (state.livros||[]).slice();
  if(filterFn) livros = livros.filter(filterFn);

  // Alimenta os seletores de filtro
  updateShelfFilters();

  var addBtn = '<button class="livro-add" data-addbook="1">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    + 'Adicionar livro</button>';

  if(!livros.length) {
    var vazio = (state.livros||[]).length
      ? 'Nenhum livro corresponde ao que você buscou.'
      : 'Sua estante está vazia. Adicione seu primeiro livro!';
    container.innerHTML = '<div class="estante-vazia">' + vazio + '</div>' +
      ((state.livros||[]).length ? '' : addBtn);
    return;
  }

  container.innerHTML = livros.map(function(l){
    var concluido = livroConcluido(l);
    var pct = livroPct(l);
    var status, classe;
    if(concluido)          { status = 'Concluído';   classe = ' concluido'; }
    else if(l.abandonado)  { status = 'Abandonado';  classe = ' abandonado'; }
    else                   { status = pct + '% lido'; classe = ''; }

    // A faixa no pe da capa so aparece em leitura em andamento: num livro
    // concluido ela ficaria sempre cheia, sem informar nada.
    var barra = (!concluido && !l.abandonado && pct > 0)
      ? '<span class="livro-capa-barra"><span style="width:' + pct + '%"></span></span>'
      : '';

    var capa = l.cover
      ? '<img src="' + esc(l.cover) + '" alt="">'
      : '<span class="livro-capa-vazia" style="background:' + corDaCapa(l.titulo) + '">'
        + '<span>' + esc(iniciaisLivro(l.titulo)) + '</span></span>';

    return '<div class="livro-card" data-id="' + l.id + '" tabindex="0" role="button" data-a11y="1"'
      + ' aria-label="' + esc(l.titulo||'Livro') + ' — ' + status + '">'
      + '<div class="livro-capa">' + capa + barra
        + '<button class="livro-fav' + (l.favorito ? ' on' : '') + '" data-favid="' + l.id + '"'
        + ' aria-label="' + (l.favorito ? 'Remover dos favoritos' : 'Favoritar') + '">'
        + '<span>' + (l.favorito ? '&#9733;' : '&#9734;') + '</span></button>'
      + '</div>'
      + '<div class="livro-nome">' + esc(l.titulo||'') + '</div>'
      + '<div class="livro-status' + classe + '">' + status + '</div>'
      + '</div>';
  }).join('') + addBtn;
}

// Fundos para capas sem imagem. Tons escuros da paleta da floresta, todos
// com contraste de sobra para o creme das iniciais.
var CORES_CAPA = [
  'linear-gradient(150deg,#3A7059,#1D3A2E)',
  'linear-gradient(150deg,#2F5668,#17303B)',
  'linear-gradient(150deg,#6B4A22,#3A2712)',
  'linear-gradient(150deg,#5B3A4A,#2E1C26)',
  'linear-gradient(150deg,#3C4A6B,#1E2438)',
  'linear-gradient(150deg,#5A5326,#2C2911)'
];
function corDaCapa(titulo){
  var t = String(titulo||''), soma = 0;
  for(var i=0;i<t.length;i++) soma += t.charCodeAt(i);
  return CORES_CAPA[soma % CORES_CAPA.length];
}

// Iniciais para a capa de quem ainda nao anexou imagem.
function iniciaisLivro(titulo){
  var palavras = String(titulo||'?').trim().split(/\s+/).filter(Boolean);
  if(!palavras.length) return '?';
  if(palavras.length === 1) return palavras[0].slice(0,2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

// ── PAINEL DE ACOES DO LIVRO ──
function showShelfPopup(e, id) {
  var livro = (state.livros||[]).find(function(l){ return l.id === id; });
  if(!livro) return;
  _shelfPopupBookId = id;
  var popup = document.getElementById('shelf-book-popup');
  if(!popup) return;

  var coverEl = document.getElementById('shelf-popup-cover');
  if(livro.cover) { coverEl.src = livro.cover; coverEl.style.display = 'block'; }
  else { coverEl.style.display = 'none'; }

  document.getElementById('shelf-popup-title').textContent = livro.titulo || '';
  document.getElementById('shelf-popup-author').textContent = livro.autor || '';

  // O painel repete o estado que o cartao mostra, para o texto nao divergir.
  var progEl = document.getElementById('shelf-popup-progress');
  var pct = livroPct(livro);
  if(livroConcluido(livro)) {
    document.getElementById('shelf-popup-pct').textContent = 'Concluído';
    document.getElementById('shelf-popup-pct-bar').style.width = '100%';
    progEl.style.display = 'block';
  } else if(livro.abandonado) {
    document.getElementById('shelf-popup-pct').textContent = 'Abandonado · ' + pct + '% lido';
    document.getElementById('shelf-popup-pct-bar').style.width = pct + '%';
    progEl.style.display = 'block';
  } else {
    document.getElementById('shelf-popup-pct').textContent = pct + '% lido';
    document.getElementById('shelf-popup-pct-bar').style.width = pct + '%';
    progEl.style.display = 'block';
  }

  // O ouvinte esta no document, entao e.currentTarget e o proprio document —
  // era dai que vinha o erro "getBoundingClientRect is not a function". O
  // cartao tem que ser procurado a partir de e.target.
  var bookEl = (e.target && e.target.closest) ? e.target.closest('.livro-card') : null;
  var rect = bookEl ? bookEl.getBoundingClientRect()
                    : {left:e.clientX||0, top:e.clientY||0,
                       bottom:e.clientY||0, width:0, height:0};
  popup.style.display = 'block';
  var cx = popup.offsetWidth, cy = popup.offsetHeight, m = 12;
  var x = rect.left + (rect.width||0)/2 - cx/2;
  var y = rect.bottom + 8;
  if(y + cy > window.innerHeight - m) y = Math.max(m, rect.top - cy - 8);
  popup.style.left = Math.max(m, Math.min(x, window.innerWidth - cx - m)) + 'px';
  popup.style.top = Math.max(m, Math.min(y, window.innerHeight - cy - m)) + 'px';
}

function fecharPainelLivro() {
  var popup = document.getElementById('shelf-book-popup');
  if(popup) popup.style.display = 'none';
  _shelfPopupBookId = null;
}

document.addEventListener('keydown', function(e) {
  if(e.key !== 'Escape') return;
  var popup = document.getElementById('shelf-book-popup');
  if(popup && popup.style.display !== 'none') fecharPainelLivro();
});

function editLivroFromPopup() {
  if(!_shelfPopupBookId) return;
  document.getElementById('shelf-book-popup').style.display = 'none';
  openEditLivro(_shelfPopupBookId);
}

function deleteLivroFromPopup() {
  if(!_shelfPopupBookId) return;
  document.getElementById('shelf-book-popup').style.display = 'none';
  var id = _shelfPopupBookId;
  document.getElementById('confirm-icon').textContent = '📚';
  document.getElementById('confirm-title').textContent = 'Remover livro';
  document.getElementById('confirm-body').textContent = 'Remover este livro da sua estante?';
  document.getElementById('confirm-ok-btn').textContent = 'Remover';
  document.getElementById('confirm-ok-btn').onclick = function() {
    state.livros = (state.livros||[]).filter(function(l){ return l.id !== id; });
    saveState(); closeModal('modal-confirm'); renderLeitura(); toast('📚 Livro removido!'); resetConfirmBtn();
  };
  openModal('modal-confirm');
}

function toggleFavorito(id) {
  var livro = (state.livros||[]).find(function(l){ return l.id === id; });
  if(!livro) return;
  livro.favorito = !livro.favorito;
  saveState();
  renderBookshelf();
  toast(livro.favorito ? '⭐ Favoritado!' : 'Removido dos favoritos');
}

// ── FILTERS ──
function toggleShelfFilter() {
  _shelfFilterVisible = !_shelfFilterVisible;
  var el = document.getElementById('shelf-filter-dropdown');
  if(el) el.style.display = _shelfFilterVisible ? 'block' : 'none';
}

function updateShelfFilters() {
  var livros = state.livros || [];
  var generos = [...new Set(livros.map(function(l){ return l.genero; }).filter(Boolean))];
  var editoras = [...new Set(livros.map(function(l){ return l.editora; }).filter(Boolean))];
  var autores = [...new Set(livros.map(function(l){ return l.autor; }).filter(Boolean))];

  function fillSelect(id, items) {
    var sel = document.getElementById(id);
    if(!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">Todos</option>' + items.map(function(v){ return '<option value="' + esc(v) + '"' + (v===cur?' selected':'') + '>' + esc(v) + '</option>'; }).join('');
  }
  fillSelect('filter-genero', generos);
  fillSelect('filter-editora', editoras);
  fillSelect('filter-autor', autores);
}

function filterShelf() {
  var query = (document.getElementById('shelf-search').value || '').toLowerCase();
  var genero = document.getElementById('filter-genero') ? document.getElementById('filter-genero').value : '';
  var editora = document.getElementById('filter-editora') ? document.getElementById('filter-editora').value : '';
  var autor = document.getElementById('filter-autor') ? document.getElementById('filter-autor').value : '';

  renderBookshelf(function(l) {
    var matchQ = !query || (l.titulo||'').toLowerCase().includes(query) || (l.autor||'').toLowerCase().includes(query);
    var matchG = !genero || l.genero === genero;
    var matchE = !editora || l.editora === editora;
    var matchA = !autor || l.autor === autor;
    return matchQ && matchG && matchE && matchA;
  });
}

function clearShelfFilters() {
  ['filter-genero','filter-editora','filter-autor'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var sq = document.getElementById('shelf-search'); if(sq) sq.value = '';
  renderBookshelf();
}

// ── ADD / EDIT LIVRO ──
function setJaLeu(val) {
  _jaLeuSim = val;
  document.getElementById('jaleu-sim').classList.toggle('active', val);
  document.getElementById('jaleu-nao').classList.toggle('active', !val);
  document.getElementById('jaleu-vezes-wrap').style.display = val ? 'block' : 'none';
}

function toggleLendoAgora() {
  _lendoAgoraOn = !_lendoAgoraOn;
  document.getElementById('lendo-agora-toggle').className = 'toggle-switch' + (_lendoAgoraOn ? ' on' : '');
}

function previewLivroCover(e) {
  var file = e.target.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    _selectedWebImg = ev.target.result;
    document.getElementById('livro-cover-img').src = ev.target.result;
    document.getElementById('livro-cover-preview').style.display = 'block';
    document.getElementById('livro-cover-empty').style.display = 'none';
    document.getElementById('web-image-search-wrap').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearLivroCover() {
  _selectedWebImg = null;
  document.getElementById('livro-cover-preview').style.display = 'none';
  document.getElementById('livro-cover-empty').style.display = 'block';
  document.getElementById('livro-cover-img').src = '';
}

function openWebImageSearch() {
  var wrap = document.getElementById('web-image-search-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  if(wrap.style.display === 'block') {
    var titulo = document.getElementById('livro-titulo').value;
    var autor = document.getElementById('livro-autor').value;
    if(titulo) document.getElementById('web-image-query').value = titulo + ' ' + autor + ' livro capa';
    document.getElementById('web-image-query').focus();
  }
}

function searchWebImages() {
  var query = document.getElementById('web-image-query').value.trim();
  if(!query) return;
  var results = document.getElementById('web-image-results');
  results.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px;grid-column:1/-1">🔍 Buscando imagens... <br><span style="font-size:10px">Dica: Cole a URL de uma imagem diretamente no campo abaixo.</span></div>';
  // Since we can't do real image search in GitHub Pages (no backend),
  // show URL input fallback
  results.innerHTML = '<div style="grid-column:1/-1">'
    + '<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Cole a URL da imagem da capa:</p>'
    + '<div style="display:flex;gap:8px">'
    + '<input id="cover-url-input" class="form-input" placeholder="https://..." style="flex:1;font-size:12px">'
    + '<button class="btn btn-primary btn-sm" onclick="applyCoverUrl()">Usar</button>'
    + '</div>'
    + '<p style="font-size:10px;color:var(--text-muted);margin-top:6px">Dica: Busque no Google Imagens, clique com botão direito na capa → "Copiar endereço da imagem"</p>'
    + '</div>';
}

function applyCoverUrl() {
  var url = document.getElementById('cover-url-input') ? document.getElementById('cover-url-input').value.trim() : '';
  if(!url) return;
  _selectedWebImg = url;
  document.getElementById('livro-cover-img').src = url;
  document.getElementById('livro-cover-preview').style.display = 'block';
  document.getElementById('livro-cover-empty').style.display = 'none';
  document.getElementById('web-image-search-wrap').style.display = 'none';
  toast('🖼 Capa aplicada!');
}

function resetLivroForm() {
  ['livro-titulo','livro-autor','livro-paginas','livro-genero','livro-editora','livro-ano','livro-vezes'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  clearLivroCover();
  _selectedWebImg = null;
  _jaLeuSim = false;
  _lendoAgoraOn = false;
  document.getElementById('jaleu-sim').classList.remove('active');
  document.getElementById('jaleu-nao').classList.add('active');
  document.getElementById('jaleu-vezes-wrap').style.display = 'none';
  document.getElementById('lendo-agora-toggle').className = 'toggle-switch';
  document.getElementById('web-image-search-wrap').style.display = 'none';
  document.getElementById('livro-edit-id').value = '';
  document.getElementById('livro-modal-title').textContent = 'Adicionar livro';
}

function openEditLivro(id) {
  var l = (state.livros||[]).find(function(x){ return x.id === id; });
  if(!l) return;
  resetLivroForm();
  document.getElementById('livro-modal-title').textContent = 'Editar livro';
  document.getElementById('livro-edit-id').value = l.id;
  document.getElementById('livro-titulo').value = l.titulo || '';
  document.getElementById('livro-autor').value = l.autor || '';
  document.getElementById('livro-paginas').value = l.paginas || '';
  document.getElementById('livro-genero').value = l.genero || '';
  document.getElementById('livro-editora').value = l.editora || '';
  document.getElementById('livro-ano').value = l.ano || '';
  if(l.cover) {
    _selectedWebImg = l.cover;
    document.getElementById('livro-cover-img').src = l.cover;
    document.getElementById('livro-cover-preview').style.display = 'block';
    document.getElementById('livro-cover-empty').style.display = 'none';
  }
  if(l.jaLeu) setJaLeu(true);
  if(l.vezes) document.getElementById('livro-vezes').value = l.vezes;
  _lendoAgoraOn = !!l.lendoAgora;
  document.getElementById('lendo-agora-toggle').className = 'toggle-switch' + (_lendoAgoraOn ? ' on' : '');
  openModal('modal-add-livro');
}

function saveLivro() {
  var titulo = document.getElementById('livro-titulo').value.trim();
  if(!titulo) { toast('⚠️ Informe o título do livro.'); return; }
  var paginas = parseInt(document.getElementById('livro-paginas').value) || 0;
  if(!paginas) { toast('⚠️ Informe a quantidade de páginas.'); return; }

  if(!state.livros) state.livros = [];

  var editId = document.getElementById('livro-edit-id').value;

  // If setting as lendo agora, unset others
  if(_lendoAgoraOn) {
    state.livros.forEach(function(l){ l.lendoAgora = false; });
  }

  if(editId) {
    var l = state.livros.find(function(x){ return x.id === editId; });
    if(l) {
      l.titulo = titulo;
      l.autor = document.getElementById('livro-autor').value.trim();
      l.paginas = paginas;
      l.genero = document.getElementById('livro-genero').value.trim();
      l.editora = document.getElementById('livro-editora').value.trim();
      l.ano = document.getElementById('livro-ano').value.trim();
      l.cover = _selectedWebImg || l.cover || null;
      l.jaLeu = _jaLeuSim;
      l.vezes = _jaLeuSim ? (parseInt(document.getElementById('livro-vezes').value)||1) : 0;
      l.lendoAgora = _lendoAgoraOn;
    }
    toast('✏️ Livro atualizado!');
  } else {
    var livro = {
      id: uid(), titulo: titulo,
      autor: document.getElementById('livro-autor').value.trim(),
      paginas: paginas,
      genero: document.getElementById('livro-genero').value.trim(),
      editora: document.getElementById('livro-editora').value.trim(),
      ano: document.getElementById('livro-ano').value.trim(),
      cover: _selectedWebImg || null,
      jaLeu: _jaLeuSim,
      vezes: _jaLeuSim ? (parseInt(document.getElementById('livro-vezes').value)||1) : 0,
      lendoAgora: _lendoAgoraOn,
      paginasLidas: 0,
      logLeitura: [],
      abandonado: false,
      createdAt: new Date().toISOString(),
    };
    state.livros.push(livro);
    toast('📚 Livro adicionado!');
  }

  saveState();
  closeModal('modal-add-livro');
  resetLivroForm();
  renderLeitura();
}

// ── REGISTRAR LEITURA ──
function openModal_registrarLeitura() {
  var active = (state.livros||[]).find(function(l){ return l.lendoAgora && !l.abandonado; });
  if(!active) { toast('⚠️ Nenhum livro em leitura ativa.'); return; }
  document.getElementById('registrar-paginas').value = '';
  document.getElementById('registrar-preview').textContent = '';
  openModal('modal-registrar-leitura');
}

document.addEventListener('input', function(e) {
  if(e.target.id === 'registrar-paginas') {
    var active = (state.livros||[]).find(function(l){ return l.lendoAgora && !l.abandonado; });
    if(!active) return;
    var novas = parseInt(e.target.value) || 0;
    var total = active.paginas || 1;
    var depois = Math.min(total, (active.paginasLidas||0) + novas);
    var pct = Math.round((depois/total)*100);
    document.getElementById('registrar-preview').textContent = depois + ' / ' + total + ' páginas (' + pct + '%)';
  }
});

function registrarLeitura() {
  var active = (state.livros||[]).find(function(l){ return l.lendoAgora && !l.abandonado; });
  if(!active) return;
  var novas = parseInt(document.getElementById('registrar-paginas').value) || 0;
  if(novas <= 0) { toast('⚠️ Informe quantas páginas você leu.'); return; }

  active.paginasLidas = Math.min(active.paginas, (active.paginasLidas||0) + novas);
  active.logLeitura = active.logLeitura || [];
  active.logLeitura.push({ data: new Date().toISOString(), paginas: novas });

  if(active.paginasLidas >= active.paginas) {
    active.lendoAgora = false;
    active.concluido = true;
    active.concluidoEm = new Date().toISOString();
    toast('🎉 Parabéns! Você terminou "' + active.titulo + '"!');
  } else {
    toast('📖 +' + novas + ' páginas registradas!');
  }

  saveState();
  closeModal('modal-registrar-leitura');
  renderLeitura();
}

// ── ABANDONAR ──
function openAbandonarLeitura() { openModal('modal-abandonar-leitura'); }

function abandonarLeitura() {
  var active = (state.livros||[]).find(function(l){ return l.lendoAgora; });
  if(active) { active.lendoAgora = false; active.abandonado = true; }
  saveState();
  closeModal('modal-abandonar-leitura');
  renderLeitura();
  toast('📖 Leitura abandonada. Até a próxima!');
}

// ── RESUMO ──
function updateResumoBar() {
  var el = document.getElementById('resumo-livros-count');
  if(el) {
    var total = (state.livros||[]).length;
    var concluidos = (state.livros||[]).filter(function(l){ return l.concluido; }).length;
    el.textContent = total + ' livros · ' + concluidos + ' concluídos';
  }
}

function openResumoLeitura() {
  document.getElementById('resumo-period-select').style.display = 'block';
  document.getElementById('resumo-loading').style.display = 'none';
  document.getElementById('resumo-result').style.display = 'none';
  openModal('modal-resumo-leitura');
}

function gerarResumo(periodo) {
  document.getElementById('resumo-period-select').style.display = 'none';
  document.getElementById('resumo-loading').style.display = 'block';
  document.getElementById('resumo-result').style.display = 'none';

  setTimeout(function() {
    document.getElementById('resumo-loading').style.display = 'none';
    document.getElementById('resumo-result').style.display = 'block';

    var livros = state.livros || [];
    var now = new Date();
    var logs = [];

    livros.forEach(function(l) {
      (l.logLeitura||[]).forEach(function(entry) {
        var d = new Date(entry.data);
        var include = false;
        if(periodo === 'hoje') include = d.toDateString() === now.toDateString();
        else if(periodo === 'semana') include = (now - d) <= 7*86400000;
        else if(periodo === 'mes') include = d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
        else if(periodo === 'ano') include = d.getFullYear()===now.getFullYear();
        if(include) logs.push({ livro: l, paginas: entry.paginas, data: d });
      });
    });

    var totalPaginas = logs.reduce(function(s,e){ return s+e.paginas; }, 0);
    var livrosAtivos = [...new Set(logs.map(function(e){ return e.livro.titulo; }))];

    var generos = {};
    var editoras = {};
    logs.forEach(function(e) {
      if(e.livro.genero) generos[e.livro.genero] = (generos[e.livro.genero]||0)+e.paginas;
      if(e.livro.editora) editoras[e.livro.editora] = (editoras[e.livro.editora]||0)+e.paginas;
    });
    var topGenero = Object.keys(generos).sort(function(a,b){ return generos[b]-generos[a]; })[0] || '—';
    var topEditora = Object.keys(editoras).sort(function(a,b){ return editoras[b]-editoras[a]; })[0] || '—';

    var periodoLabel = {hoje:'hoje',semana:'esta semana',mes:'este mês',ano:'este ano'}[periodo];
    var nomesPeriodo = {hoje:'Hoje',semana:'Esta semana',mes:'Este mês',ano:'Este ano'}[periodo];

    document.getElementById('resumo-result').innerHTML =
      '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">' + nomesPeriodo + '</div>'
      + '<div class="resumo-stat-grid">'
        + '<div class="resumo-stat-card"><div class="resumo-stat-value">' + totalPaginas + '</div><div class="resumo-stat-label">Páginas lidas</div></div>'
        + '<div class="resumo-stat-card"><div class="resumo-stat-value">' + livrosAtivos.length + '</div><div class="resumo-stat-label">Livros lidos</div></div>'
        + '<div class="resumo-stat-card"><div class="resumo-stat-value" style="font-size:16px">' + esc(topGenero) + '</div><div class="resumo-stat-label">Gênero favorito</div></div>'
        + '<div class="resumo-stat-card"><div class="resumo-stat-value" style="font-size:16px">' + esc(topEditora) + '</div><div class="resumo-stat-label">Editora favorita</div></div>'
      + '</div>'
      + (livrosAtivos.length ? '<div class="section-title" style="margin-top:0">Livros lidos</div><div style="display:flex;flex-direction:column;gap:6px">'
        + livrosAtivos.map(function(t){ return '<div style="font-size:13px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06)">📖 ' + esc(t) + '</div>'; }).join('')
        + '</div>' : '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">Nenhuma leitura registrada ' + periodoLabel + '.</div>');
  }, 1800);
}


// Delegacao de eventos dos cartoes da estante
document.addEventListener('click', function(e) {
  // Estrela de favorito
  var star = e.target.closest ? e.target.closest('.livro-fav') : null;
  if(star && star.dataset.favid) {
    e.stopPropagation();
    toggleFavorito(star.dataset.favid);
    return;
  }
  // Botao de adicionar
  var addBook = e.target.closest ? e.target.closest('[data-addbook]') : null;
  if(addBook) { openModal('modal-add-livro'); return; }
  // Toque/clique no cartao
  var book = e.target.closest ? e.target.closest('.livro-card') : null;
  if(book && book.dataset.id) {
    showShelfPopup(e, book.dataset.id);
    return;
  }
  // Close shelf popup on outside click
  var popup = document.getElementById('shelf-book-popup');
  if(popup && popup.style.display !== 'none') {
    if(!popup.contains(e.target)) {
      popup.style.display = 'none';
    }
  }
});
