// RELATORIO — o "Resumo de atividades", o documento que sai em PDF.
//
// COMO O PDF E GERADO
// Sem biblioteca. O documento e montado como HTML dentro de #relatorio e
// entregue ao proprio navegador pelo window.print(), onde o usuario escolhe
// "Salvar como PDF". Uma biblioteca (jsPDF, html2pdf) custaria centenas de
// KB, uma dependencia nova e uma segunda engine de layout para manter — e
// entregaria um PDF pior do que o que o Chrome ja imprime. As regras de
// pagina estao no bloco RELATORIO de styles/main.css.
//
// O PAPEL E CLARO DE PROPOSITO
// A tela do app e escura; o documento nao. Ele nasce para ser impresso ou
// lido em PDF, e fundo escuro em papel gasta tinta e le pior. A paleta aqui
// e a do tema claro do design system, fixa: o documento tem a mesma cara
// independentemente do tema que o usuario escolheu para o app.
//
// DE ONDE VEM CADA NUMERO
// Tudo que ja tem data propria (exercicios, gastos, leitura, agenda,
// tarefas, metas) e contado direto do state. O que o app nao guardava —
// itens do dia fechados, XP por dia, minutos de estudo — vem de
// js/historico.js, que so comecou a anotar quando esta funcionalidade
// entrou. Por isso todo bloco que depende do historico sabe se apresentar
// vazio, dizendo que ainda esta juntando dados, em vez de mostrar zero como
// se fosse um resultado.

// As duas unicas cores que o SVG dos graficos precisa em JavaScript. O
// resto da paleta do documento vive no CSS, no bloco RESUMO DE ATIVIDADES.
var REL_PAPEL = {laranja:'#C56800', cartao:'#FBF8EC'};

// A capa sorteia uma saudacao, e cada uma pede um humor do Ticolino.
var REL_SAUDACOES = [
  {frase:'Vamos ver como foi sua jornada?', humor:'animado'},
  {frase:'Vamos espiar sua evolução?!',     humor:'focado'},
  {frase:'Que tal ver seu desempenho?',     humor:'feliz'},
  {frase:'Quanto brilho!',                  humor:'orgulhoso'}
];

var relPeriodoAtual = 'mes';     // o que a aba Resumo esta mostrando
var relPeriodoModal = 'mes';     // o escolhido dentro do modal

// ─── Periodos ──────────────────────────────────────────────────────────

function relPeriodo(tipo){
  var hoje = new Date(), de, ate;
  if(tipo === 'semana'){
    de = exSegunda(hoje);
    ate = new Date(de.getTime()); ate.setDate(ate.getDate() + 6);
  } else if(tipo === 'ano'){
    de = new Date(hoje.getFullYear(), 0, 1, 12);
    ate = new Date(hoje.getFullYear(), 11, 31, 12);
  } else {
    de = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
    ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 12);
  }
  return {
    tipo: tipo,
    de: exISO(de), ate: exISO(ate),
    inicio: de, fim: ate,
    rotulo: relRotulo(tipo, de, ate),
    intervalo: relDiaMes(de) + ' — ' + relDiaMes(ate)
  };
}

var REL_QUANDO = {semana:'sua semana', mes:'seu mês', ano:'seu ano'};

var REL_MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];

function relRotulo(tipo, de, ate){
  if(tipo === 'semana') return 'Semana de ' + relDiaMes(de);
  if(tipo === 'ano')    return 'Ano de ' + de.getFullYear();
  return REL_MESES[de.getMonth()].charAt(0).toUpperCase()
       + REL_MESES[de.getMonth()].slice(1) + ' de ' + de.getFullYear();
}

function relDiaMes(d){ return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }

// Um item entra no periodo pela data dele. Datas ISO comparam como texto,
// o que evita a armadilha de fuso horario do construtor de Date.
function relNoPeriodo(iso, p){
  if(!iso) return false;
  var dia = String(iso).slice(0, 10);
  return dia >= p.de && dia <= p.ate;
}

// ─── Os numeros de cada modulo ─────────────────────────────────────────

function relExercicios(p){
  var e = (typeof garantirExercicios === 'function') ? garantirExercicios() : null;
  if(!e) return null;
  var treinos  = (e.treinos  || []).filter(function(t){ return relNoPeriodo(t.data, p); });
  var corridas = (e.corridas || []).filter(function(c){ return relNoPeriodo(c.data, p); });
  var passos   = (e.passos   || []).filter(function(x){ return relNoPeriodo(x.data, p); });
  var segundos = treinos.reduce(function(s,t){ return s + (t.dur || 0); }, 0);
  var comDur   = treinos.filter(function(t){ return t.dur > 0; }).length;
  var km       = corridas.reduce(function(s,c){ return s + (parseFloat(c.dist) || 0); }, 0);
  return {
    treinos: treinos.length,
    horas: relDuracao(segundos),
    media: comDur ? Math.round(segundos / comDur / 60) : 0,
    corridas: corridas.length,
    km: km,
    passosMedia: passos.length
      ? Math.round(passos.reduce(function(s,x){ return s + (x.passos || 0); }, 0) / passos.length)
      : 0,
    porSemana: relPorSemana(p, treinos, function(){ return 1; })
  };
}

function relTarefas(p){
  var todas = state.tasks || [];
  var criadas = todas.filter(function(t){ return relNoPeriodo(t.createdAt, p); });
  var feitas  = todas.filter(function(t){ return t.done && relNoPeriodo(t.completedAt, p); });
  var abertas = todas.filter(function(t){ return !t.done; });
  return {
    criadas: criadas.length,
    feitas: feitas.length,
    abertas: abertas.length,
    // Tarefas antigas, de antes do app anotar a data de conclusao, ficam de
    // fora da contagem do periodo. Dizer isso e melhor que contar errado.
    semData: todas.filter(function(t){ return t.done && !t.completedAt; }).length,
    porSemana: relPorSemana(p, feitas, function(){ return 1; }, 'completedAt'),
    lista: abertas.slice().sort(function(a,b){
      return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1;
    }).slice(0, 6)
  };
}

function relMetas(p){
  var todas = state.metas || [];
  return {
    ativas: todas.filter(function(m){ return !m.done; }).length,
    concluidas: todas.filter(function(m){ return m.done && relNoPeriodo(m.completedAt, p); }).length,
    criadas: todas.filter(function(m){ return relNoPeriodo(m.createdAt, p); }).length,
    vencendo: todas.filter(function(m){ return !m.done && relNoPeriodo(m.deadline, p); }).length,
    lista: todas.filter(function(m){ return !m.done; }).slice(0, 5).map(function(m){
      return {nome: m.name || '', pct: calcProgress(m)};
    })
  };
}

function relAgenda(p){
  var eventos = (state.eventos || []).filter(function(ev){ return relNoPeriodo(ev.data, p); });
  var hoje = hojeStr();
  return {
    total: eventos.length,
    passados: eventos.filter(function(ev){ return String(ev.data).slice(0,10) < hoje; }).length,
    proximos: eventos.filter(function(ev){ return String(ev.data).slice(0,10) >= hoje; })
      .sort(function(a,b){ return a.data < b.data ? -1 : 1; }).slice(0, 5)
  };
}

function relGastos(p){
  var gastos = (state.gastos || []).filter(function(g){ return relNoPeriodo(g.data, p); });
  var total = gastos.reduce(function(s,g){ return s + (parseFloat(g.valor) || 0); }, 0);

  var porCategoria = {};
  gastos.forEach(function(g){
    var c = (typeof getCat === 'function') ? getCat(g.categoriaId) : null;
    var nome = (c && (c.nome || c.name)) || 'Sem categoria';
    porCategoria[nome] = (porCategoria[nome] || 0) + (parseFloat(g.valor) || 0);
  });
  var ranking = Object.keys(porCategoria).map(function(n){ return {nome:n, valor:porCategoria[n]}; })
    .sort(function(a,b){ return b.valor - a.valor; }).slice(0, 5);

  return {
    total: total,
    lancamentos: gastos.length,
    media: gastos.length ? total / gastos.length : 0,
    ranking: ranking,
    porSemana: relPorSemana(p, gastos, function(g){ return parseFloat(g.valor) || 0; })
  };
}

function relLeitura(p){
  var livros = state.livros || [], paginas = 0, comLog = 0;
  livros.forEach(function(l){
    (l.logLeitura || []).forEach(function(r){
      if(relNoPeriodo(r.data, p)){ paginas += (r.paginas || 0); comLog++; }
    });
  });
  return {
    paginas: paginas,
    sessoes: comLog,
    emAndamento: livros.filter(function(l){
      return !l.abandonado && !l.concluido && !l.jaLeu && (l.paginasLidas || 0) > 0;
    }).length,
    concluidos: livros.filter(function(l){
      return typeof livroConcluido === 'function' ? livroConcluido(l) : !!l.concluido;
    }).length,
    lista: livros.filter(function(l){
      return (l.logLeitura || []).some(function(r){ return relNoPeriodo(r.data, p); });
    }).slice(0, 4).map(function(l){
      return {titulo: l.titulo || '', pct: typeof livroPct === 'function' ? livroPct(l) : 0};
    })
  };
}

function relEstudos(p){
  var minutos = minutosEstudoNoPeriodo(p.de, p.ate);
  return {
    minutos: minutos,
    horas: relDuracao(minutos * 60),
    xp: xpNoPeriodo(p.de, p.ate),
    xpTotal: (typeof studyXP === 'number') ? studyXP : (state.studyXP || 0),
    nivel: Math.floor(((typeof studyXP === 'number') ? studyXP : (state.studyXP || 0)) / 100) + 1
  };
}

// ─── Agrupar por semana, para os graficos ──────────────────────────────
// Devolve um valor por semana do periodo. `peso` diz quanto cada item vale:
// contar itens (sempre 1) ou somar um campo (o valor de um gasto).

function relPorSemana(p, itens, peso, campoData){
  var campo = campoData || 'data';
  var semanas = [], cursor = exSegunda(p.inicio);
  var limite = p.fim.getTime();
  while(cursor.getTime() <= limite && semanas.length < 60){
    var fim = new Date(cursor.getTime()); fim.setDate(fim.getDate() + 6);
    semanas.push({de: exISO(cursor), ate: exISO(fim), valor: 0});
    cursor = new Date(cursor.getTime()); cursor.setDate(cursor.getDate() + 7);
  }
  itens.forEach(function(it){
    var dia = String(it[campo] || '').slice(0, 10);
    for(var i = 0; i < semanas.length; i++){
      if(dia >= semanas[i].de && dia <= semanas[i].ate){ semanas[i].valor += peso(it); break; }
    }
  });
  return semanas.map(function(s){ return s.valor; });
}

// XP por semana, do historico.
function relXpPorSemana(p){
  var linhas = historicoNoPeriodo(p.de, p.ate);
  return relPorSemana(p, linhas, function(l){ return l.x; }, 'dia');
}

// ─── Formatadores ──────────────────────────────────────────────────────

function relDuracao(seg){
  if(!seg) return '0h';
  var h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
  if(!h) return m + 'min';
  return h + 'h' + (m ? pad(m) : '');
}
function relNum(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

// ─── Desenho dos graficos ──────────────────────────────────────────────
// SVG cru, sem biblioteca: sao linhas de quatro a cinco pontos. Com menos
// de dois pontos nao ha linha para desenhar, e a funcao devolve vazio para
// quem chamou mostrar o aviso de "ainda juntando dados".

function relGrafico(valores, largura, altura, classe){
  if(!valores || valores.length < 2) return '';
  if(valores.every(function(v){ return !v; })) return '';

  // A margem vertical acompanha a altura: num grafico alto, 14px de folga
  // em cima deixaria o pico colado na borda.
  var mx = 16, my = Math.max(14, Math.round(altura * 0.08));
  var teto = Math.max.apply(null, valores) || 1;
  var passo = (largura - mx * 2) / (valores.length - 1);
  var pontos = valores.map(function(v, i){
    return {
      x: mx + i * passo,
      y: altura - my - ((v / teto) * (altura - my * 2))
    };
  });
  var linha = pontos.map(function(pt){ return pt.x.toFixed(1) + ',' + pt.y.toFixed(1); }).join(' ');
  var area = 'M' + linha.split(' ').join(' L').slice(1)
           + ' L' + (largura - mx) + ',' + (altura - my)
           + ' L' + mx + ',' + (altura - my) + ' Z';

  var guias = [my, altura / 2, altura - my].map(function(y, i){
    return '<line x1="' + mx + '" y1="' + y + '" x2="' + (largura - mx) + '" y2="' + y
         + '" stroke="rgba(46,41,16,' + (i === 2 ? '0.18' : '0.09') + ')" stroke-width="1"/>';
  }).join('');

  var bolas = pontos.map(function(pt, i){
    var ultimo = i === pontos.length - 1;
    return '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="' + (ultimo ? 5 : 3.6)
         + '" fill="' + REL_PAPEL.laranja + '"'
         + (ultimo ? '' : ' stroke="' + REL_PAPEL.cartao + '" stroke-width="2"') + '/>';
  }).join('');

  return '<svg viewBox="0 0 ' + largura + ' ' + altura + '" class="rel-grafico'
    + (classe ? ' ' + classe : '') + '" aria-hidden="true">'
    + guias
    + '<path d="' + area + '" fill="rgba(197,104,0,0.11)"/>'
    + '<polyline points="' + linha + '" fill="none" stroke="' + REL_PAPEL.laranja
    + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + bolas + '</svg>';
}

function relRotulosSemana(n){
  if(n < 2) return '';
  var s = '';
  for(var i = 0; i < n; i++) s += '<span>Sem ' + (i + 1) + '</span>';
  return '<div class="rel-eixo">' + s + '</div>';
}

// Bloco que aparece no lugar de um grafico enquanto nao ha o que mostrar.
function relSemDados(texto){
  return '<div class="rel-vazio">' + esc(texto) + '</div>';
}

// ─── O modal de escolher o periodo ─────────────────────────────────────

function relAbrirModal(){
  relPeriodoModal = relPeriodoAtual;
  relPintarModal();
  openModal('modal-relatorio');
}

function relEscolher(tipo){
  relPeriodoModal = tipo;
  relPintarModal();
}

function relPintarModal(){
  var caixa = document.getElementById('rel-opcoes');
  if(!caixa) return;
  var tipos = [
    {id:'semana', titulo:'Semana'},
    {id:'mes',    titulo:'Mês'},
    {id:'ano',    titulo:'Ano'}
  ];
  caixa.innerHTML = tipos.map(function(t){
    var p = relPeriodo(t.id), on = t.id === relPeriodoModal;
    return '<button type="button" class="rel-opcao' + (on ? ' on' : '') + '"'
      + ' aria-pressed="' + on + '" onclick="relEscolher(\'' + t.id + '\')">'
      + '<span class="rel-anel" aria-hidden="true"></span>'
      + '<span class="rel-opcao-texto">'
        + '<span class="rel-opcao-titulo">' + t.titulo + '</span>'
        + '<span class="rel-opcao-desc">' + esc(p.intervalo) + '</span>'
      + '</span></button>';
  }).join('');

  var tico = document.getElementById('rel-modal-tico');
  if(tico && typeof ticolino === 'function') tico.innerHTML = ticolino('animado', 54);
}

// ─── Montagem do documento ─────────────────────────────────────────────

function relGerar(){
  closeModal('modal-relatorio');
  var p = relPeriodo(relPeriodoModal);
  var alvo = document.getElementById('relatorio');
  if(!alvo) return;
  alvo.innerHTML = relCapa(p) + relParte1(p) + relParte2(p);
  document.body.classList.add('imprimindo');

  // Um quadro para o navegador pintar o documento antes de abrir a caixa de
  // impressao; sem isso o Safari as vezes captura a pagina ainda em branco.
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      window.print();
    });
  });
}

// A classe sai quando a impressao termina (ou e cancelada), senao o app
// ficaria escondido atras do documento.
window.addEventListener('afterprint', function(){
  document.body.classList.remove('imprimindo');
  var alvo = document.getElementById('relatorio');
  if(alvo) alvo.innerHTML = '';
});

function relCapa(p){
  var s = REL_SAUDACOES[Math.floor(Math.random() * REL_SAUDACOES.length)];
  var nome = (state.perfil && state.perfil.name) || '';
  var est = relEstudos(p);
  var fechados = diasFechados(p.de, p.ate);
  var pct = percentualItens(p.de, p.ate);
  var dias = diasEntre(p.de, p.ate > hojeStr() ? hojeStr() : p.ate);
  var temHistorico = historicoNoPeriodo(p.de, p.ate).length > 0;
  var xpSemana = relXpPorSemana(p);
  var graficoXp = relGrafico(xpSemana, 700, 430, 'rel-grafico-capa');

  return '<section class="rel-pagina rel-capa">'
    + '<header class="rel-hero">'
      + '<div class="rel-hero-texto">'
        + '<div class="rel-marca">'
          + '<span class="rel-selo">M</span><span class="rel-marca-nome">Mindt</span>'
          + '<span class="rel-marca-risco"></span>'
          + '<span class="rel-marca-etiqueta">Resumo de atividades</span>'
        + '</div>'
        + '<h1>' + esc(s.frase) + '</h1>'
        + '<p>' + (nome ? esc(nome) + ', aqui' : 'Aqui') + ' está '
          + REL_QUANDO[p.tipo] + ' em poucas folhas.<br>'
          + 'O Ticolino anotou tudo enquanto você vivia.</p>'
        + '<div class="rel-chips">'
          + '<span class="rel-chip">' + esc(p.rotulo) + '</span>'
          + '<span class="rel-chip">' + esc(p.intervalo) + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="rel-hero-tico">'
        + (typeof ticolino === 'function' ? ticolino(s.humor, 176) : '')
      + '</div>'
    + '</header>'

    + '<div class="rel-corpo">'
      + '<div class="rel-metricas">'
        + relMetrica('Nível', est.nivel, relNum(est.xpTotal) + ' XP acumulados')
        + relMetrica('Sequência', (state.streak && state.streak.count) || 0, 'dias seguidos ativos')
        + relMetrica('Dias fechados', temHistorico ? fechados : '—',
            temHistorico ? 'de ' + dias + (dias === 1 ? ' dia' : ' dias') : 'sem histórico ainda')
        + relMetrica('Itens do dia', pct === null || !temHistorico ? '—' : pct + '%',
            temHistorico ? 'concluídos no período' : 'sem histórico ainda', true)
      + '</div>'

      + '<div class="rel-cartao">'
        + '<div class="rel-cartao-topo">'
          + '<span class="rel-cartao-titulo">Evolução do período</span>'
          + '<span class="rel-cartao-nota">XP ganho, semana a semana</span>'
        + '</div>'
        + (graficoXp || relSemDados(
            'O app começou a anotar o XP dia a dia agora. Este gráfico se desenha '
            + 'sozinho conforme as semanas passam.'))
        + relRotulosSemana(graficoXp ? xpSemana.length : 0)
      + '</div>'

      + '<div class="rel-recado">'
        + '<div class="rel-recado-tico">' + (typeof ticolino === 'function' ? ticolino('feliz', 62) : '') + '</div>'
        + '<p>' + relFrase(p) + '</p>'
      + '</div>'
    + '</div>'
  + '</section>';
}

function relMetrica(rotulo, valor, nota, destaque){
  return '<div class="rel-metrica' + (destaque ? ' destaque' : '') + '">'
    + '<div class="rel-metrica-rotulo">' + esc(rotulo) + '</div>'
    + '<div class="rel-metrica-valor">' + esc(String(valor)) + '</div>'
    + '<div class="rel-metrica-nota">' + esc(nota) + '</div>'
  + '</div>';
}

// A frase do Ticolino sai de um numero real do periodo, nunca de invencao.
// A ordem e a da prioridade: fala do que mais aconteceu.
function relFrase(p){
  var ex = relExercicios(p), ta = relTarefas(p), le = relLeitura(p), ga = relGastos(p);
  var partes = [];
  if(ex && ex.treinos) partes.push(ex.treinos + (ex.treinos === 1 ? ' treino' : ' treinos')
    + (ex.horas !== '0h' ? ', ' + ex.horas + ' no total' : ''));
  if(ta.feitas) partes.push(ta.feitas + (ta.feitas === 1 ? ' tarefa concluída' : ' tarefas concluídas'));
  if(le.paginas) partes.push(relNum(le.paginas) + (le.paginas === 1 ? ' página lida' : ' páginas lidas'));
  if(ga.lancamentos) partes.push(ga.lancamentos
    + (ga.lancamentos === 1 ? ' gasto lançado' : ' gastos lançados'));

  if(!partes.length){
    return 'Este período ainda está em branco. Nada de errado nisso — '
         + 'é só o começo, e eu continuo anotando.';
  }
  var fim = partes.pop();
  return esc(partes.length ? partes.join(', ') + ' e ' + fim : fim)
       + '. Está tudo anotado aqui, do jeito que aconteceu.';
}

// ─── Parte 1 — rotina e compromissos ───────────────────────────────────

function relParte1(p){
  var ex = relExercicios(p), ta = relTarefas(p), me = relMetas(p), ag = relAgenda(p);

  var cartaoExercicios = ex ? relCartao('Exercícios', REL_ICONES.halter,
    ex.treinos, ex.treinos === 1 ? 'treino' : 'treinos',
    [ ex.horas !== '0h' ? ex.horas + ' no total' : null,
      ex.media ? ex.media + ' min em média' : null,
      ex.corridas ? ex.corridas + (ex.corridas === 1 ? ' corrida' : ' corridas')
        + (ex.km ? ' · ' + exKm(ex.km) + ' km' : '') : null,
      ex.passosMedia ? relNum(ex.passosMedia) + ' passos por dia' : null ],
    ex.porSemana,
    'Cada ponto é uma semana do período.') : '';

  var cartaoTarefas = relCartao('Tarefas', REL_ICONES.tarefas,
    ta.feitas, ta.feitas === 1 ? 'concluída' : 'concluídas',
    [ ta.criadas + (ta.criadas === 1 ? ' criada no período' : ' criadas no período'),
      ta.abertas + (ta.abertas === 1 ? ' ainda em aberto' : ' ainda em aberto'),
      ta.semData ? ta.semData + ' sem data de conclusão' : null ],
    ta.porSemana,
    'Tarefas concluídas por semana.');

  var listaMetas = me.lista.length
    ? me.lista.map(function(m){
        return '<div class="rel-barra">'
          + '<div class="rel-barra-topo"><span>' + esc(m.nome) + '</span><span>' + m.pct + '%</span></div>'
          + '<div class="rel-barra-trilho"><div class="rel-barra-fita" style="width:' + m.pct + '%"></div></div>'
        + '</div>';
      }).join('')
    : relSemDados('Nenhuma meta em andamento.');

  var listaAgenda = ag.proximos.length
    ? '<ul class="rel-lista">' + ag.proximos.map(function(ev){
        return '<li><span class="rel-ponto"></span><span class="rel-lista-nome">'
          + esc(ev.nome || ev.titulo || 'Evento') + '</span>'
          + '<span class="rel-lista-data">' + esc(relDataCurta(ev.data)) + '</span></li>';
      }).join('') + '</ul>'
    : relSemDados('Nenhum compromisso à frente neste período.');

  return '<section class="rel-pagina">'
    + relCabecalho('Parte 1', 'Rotina e compromissos', p)
    + '<div class="rel-grade">'
      + cartaoExercicios
      + cartaoTarefas
      + '<div class="rel-cartao">'
        + relTituloCartao('Metas', REL_ICONES.metas)
        + '<div class="rel-numero"><b>' + me.ativas + '</b><span>'
          + (me.ativas === 1 ? 'meta em andamento' : 'metas em andamento') + '</span></div>'
        + relEtiquetas([
            me.concluidas ? me.concluidas + ' concluída' + (me.concluidas > 1 ? 's' : '') + ' no período' : null,
            me.criadas ? me.criadas + ' criada' + (me.criadas > 1 ? 's' : '') + ' no período' : null,
            me.vencendo ? me.vencendo + ' vence' + (me.vencendo > 1 ? 'm' : '') + ' até o fim' : null
          ])
        + '<div class="rel-cartao-lista">' + listaMetas + '</div>'
      + '</div>'
      + '<div class="rel-cartao">'
        + relTituloCartao('Agenda', REL_ICONES.agenda)
        + '<div class="rel-numero"><b>' + ag.total + '</b><span>'
          + (ag.total === 1 ? 'compromisso' : 'compromissos') + '</span></div>'
        + relEtiquetas([ ag.passados ? ag.passados + ' já ' + (ag.passados > 1 ? 'passaram' : 'passou') : null,
                         ag.proximos.length ? ag.proximos.length + ' pela frente' : null ])
        + '<div class="rel-cartao-lista">' + listaAgenda + '</div>'
      + '</div>'
    + '</div>'
  + '</section>';
}

// ─── Parte 2 — numeros do periodo ──────────────────────────────────────

function relParte2(p){
  var ga = relGastos(p), es = relEstudos(p), le = relLeitura(p);
  var temHistorico = historicoNoPeriodo(p.de, p.ate).length > 0;

  var rankingGastos = ga.ranking.length
    ? '<ul class="rel-lista">' + ga.ranking.map(function(c){
        return '<li><span class="rel-ponto"></span><span class="rel-lista-nome">' + esc(c.nome) + '</span>'
          + '<span class="rel-lista-data">' + moeda(c.valor) + '</span></li>';
      }).join('') + '</ul>'
    : relSemDados('Nenhum gasto lançado no período.');

  var listaLivros = le.lista.length
    ? le.lista.map(function(l){
        return '<div class="rel-barra">'
          + '<div class="rel-barra-topo"><span>' + esc(l.titulo) + '</span><span>' + l.pct + '%</span></div>'
          + '<div class="rel-barra-trilho"><div class="rel-barra-fita" style="width:' + l.pct + '%"></div></div>'
        + '</div>';
      }).join('')
    : relSemDados('Nenhuma leitura registrada no período.');

  return '<section class="rel-pagina">'
    + relCabecalho('Parte 2', 'Dinheiro, estudo e leitura', p)
    + '<div class="rel-grade">'
      + '<div class="rel-cartao rel-cartao-largo">'
        + relTituloCartao('Gastos', REL_ICONES.gastos)
        + '<div class="rel-numero"><b>' + moeda(ga.total) + '</b><span>'
          + ga.lancamentos + (ga.lancamentos === 1 ? ' lançamento' : ' lançamentos') + '</span></div>'
        + relEtiquetas([ ga.lancamentos ? moeda(ga.media) + ' por lançamento' : null,
                         ga.ranking.length ? 'Maior categoria: ' + ga.ranking[0].nome : null ])
        + (relGrafico(ga.porSemana, 660, 150)
            || relSemDados('Sem lançamentos suficientes para desenhar a linha.'))
        + '<div class="rel-cartao-lista">' + rankingGastos + '</div>'
      + '</div>'
      + '<div class="rel-cartao">'
        + relTituloCartao('Estudos', REL_ICONES.estudos)
        + '<div class="rel-numero"><b>' + (temHistorico ? es.horas : '—') + '</b><span>'
          + (temHistorico ? 'de foco no período' : 'sem histórico ainda') + '</span></div>'
        + relEtiquetas([ es.xp ? '+' + relNum(es.xp) + ' XP no período' : null,
                         'Nível ' + es.nivel + ' · ' + relNum(es.xpTotal) + ' XP no total' ])
        + (temHistorico ? '' : relSemDados(
            'As sessões de estudo passaram a ser anotadas com data agora. '
            + 'No próximo resumo este bloco já mostra as horas.'))
      + '</div>'
      + '<div class="rel-cartao">'
        + relTituloCartao('Leitura', REL_ICONES.leitura)
        + '<div class="rel-numero"><b>' + relNum(le.paginas) + '</b><span>'
          + (le.paginas === 1 ? 'página lida' : 'páginas lidas') + '</span></div>'
        + relEtiquetas([ le.sessoes ? le.sessoes + (le.sessoes === 1 ? ' registro' : ' registros') : null,
                         le.emAndamento ? le.emAndamento + ' em andamento' : null,
                         le.concluidos ? le.concluidos + ' concluído' + (le.concluidos > 1 ? 's' : '') : null ])
        + '<div class="rel-cartao-lista">' + listaLivros + '</div>'
      + '</div>'
    + '</div>'
    + '<footer class="rel-rodape">'
      + '<span>Mindt · Resumo de atividades</span>'
      + '<span>' + esc(p.rotulo) + ' · gerado em ' + new Date().toLocaleDateString('pt-BR') + '</span>'
    + '</footer>'
  + '</section>';
}

// ─── Pecas reaproveitadas ──────────────────────────────────────────────

function relCabecalho(parte, titulo, p){
  return '<header class="rel-cabecalho">'
    + '<div><div class="rel-parte">' + esc(parte) + '</div><h2>' + esc(titulo) + '</h2></div>'
    + '<span class="rel-cabecalho-data">' + esc(p.rotulo) + '</span>'
  + '</header>';
}

function relTituloCartao(nome, icone){
  return '<div class="rel-cartao-cabeca">'
    + '<span class="rel-icone">' + icone + '</span>'
    + '<span class="rel-cartao-nome">' + esc(nome) + '</span>'
  + '</div>';
}

function relEtiquetas(lista){
  var etiquetas = lista.filter(Boolean);
  if(!etiquetas.length) return '';
  return '<div class="rel-etiquetas">' + etiquetas.map(function(t){
    return '<span class="rel-etiqueta">' + esc(t) + '</span>';
  }).join('') + '</div>';
}

function relCartao(nome, icone, valor, unidade, etiquetas, serie, legenda){
  var grafico = relGrafico(serie, 320, 120);
  return '<div class="rel-cartao">'
    + relTituloCartao(nome, icone)
    + '<div class="rel-numero"><b>' + esc(String(valor)) + '</b><span>' + esc(unidade) + '</span></div>'
    + relEtiquetas(etiquetas)
    + (grafico
        ? grafico + relRotulosSemana(serie.length)
          + '<div class="rel-legenda">' + esc(legenda) + '</div>'
        : relSemDados('Ainda não há registros suficientes para uma linha.'))
  + '</div>';
}

function relDataCurta(iso){
  if(!iso) return '';
  var d = String(iso).slice(0, 10).split('-');
  return d.length === 3 ? d[2] + '/' + d[1] : String(iso);
}

// Os mesmos desenhos do menu do app, em traco fino para o papel.
var REL_ICONES = {
  halter: relSvg('<path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.829-2.828l2.828-2.829a2 2 0 1 1 2.829 2.829l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>'),
  tarefas: relSvg('<path d="M4 12l5 5L20 6"/>'),
  metas:   relSvg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  agenda:  relSvg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  gastos:  relSvg('<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M2 11h20"/>'),
  estudos: relSvg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  leitura: relSvg('<path d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2z"/><path d="M20 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2z"/>')
};

function relSvg(miolo){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + miolo + '</svg>';
}
