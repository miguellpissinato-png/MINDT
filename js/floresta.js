// FLORESTA — cenario de fundo, compartilhado pela Home do app e pela
// pagina de convite (conheca/). Vive em arquivo proprio para as duas
// paginas usarem o mesmo cenario em vez de cada uma ter a sua copia.

// ═══════════════════════════════════════════════════════════════════════
// A FLORESTA DO TICOLINO
//
// O cenario e uma DESCIDA, nao um quadro. Quem rola a pagina desce pelo
// vale: as serras que estavam no alto sobem e saem por cima, e novas
// cristas entram por baixo. Tres bandas de silhueta viajam em velocidades
// diferentes (longe devagar, perto depressa) e cada uma DA A VOLTA no seu
// proprio periodo, entao a paisagem nunca acaba nem se repete como
// composicao: os periodos sao diferentes entre si, e a combinacao das tres
// so voltaria a se repetir depois de dezenas de milhares de pixels.
//
// POR QUE ISTO FOI REFEITO
// Antes havia cinco planos deslizando para cima sem limite, dentro de uma
// caixa de 62vh ancorada embaixo. Duas consequencias, as duas visiveis:
// as arvores da frente subiam mais rapido que todo o resto e eram CORTADAS
// na borda de cima da caixa, no meio da tela; e o chao ia embora, sobrando
// so as montanhas (que quase nao se moviam) sobre um fundo vazio. O palco
// agora ocupa a janela inteira — nao ha borda no meio da tela onde cortar —
// e o chao e um plano ANCORADO no pe da tela, que nunca viaja.
//
// AS CAMADAS, DO FUNDO PARA A FRENTE
//   ceu + brilho do sol  (fixo)
//   serras distantes     (viaja 0.09 px por px de rolagem)
//   passaros             (fixo)
//   cristas do meio      (0.26)
//   mata                 (0.52)
//   chao da frente       (ancorado embaixo; so respira com o mouse)
//   fogueira             (ancorada no canto direito de baixo)
//
// So a Home recebe o cenario. Em todas as paginas viraria papel de parede
// e deixaria de significar alguma coisa.
//
// As silhuetas sao `fill` de SVG e nao podem vir de token, entao o modulo
// observa o atributo data-theme e se repinta. No claro a profundidade volta
// ao normal: longe fica pálido, perto e o mais escuro da tela.
// ═══════════════════════════════════════════════════════════════════════

var FLORESTA_PALCO_W = 1200, FLORESTA_PALCO_H = 900;   // palco que viaja
var FLORESTA_CHAO_W  = 1200, FLORESTA_CHAO_H  = 260;   // chao ancorado

// ─── Desenho ───────────────────────────────────────────────────────────

// Conifera estilizada: andares de triangulos empilhados + tronco.
function floresteConifera(x, baseY, h, w, andares){
  andares = andares || 5;
  var d = '';
  for (var i = 0; i < andares; i++) {
    var t = i / andares;
    var topo = baseY - h * (1 - t * 0.78);
    var base = topo + h * 0.3;
    var meia = (w / 2) * (0.32 + 0.68 * ((i + 1) / andares));
    d += 'M' + x + ' ' + topo +
         'L' + (x + meia) + ' ' + base +
         'L' + (x + meia * 0.52) + ' ' + base +
         'L' + (x + meia * 0.78) + ' ' + (base + h * 0.06) +
         'L' + (x - meia * 0.78) + ' ' + (base + h * 0.06) +
         'L' + (x - meia * 0.52) + ' ' + base +
         'L' + (x - meia) + ' ' + base + 'Z';
  }
  var tw = Math.max(1.5, w * 0.045);
  d += 'M' + (x - tw) + ' ' + (baseY - h * 0.06) +
       'L' + (x + tw) + ' ' + (baseY - h * 0.06) +
       'L' + (x + tw) + ' ' + baseY +
       'L' + (x - tw) + ' ' + baseY + 'Z';
  return d;
}

// Uma linha de crista fechada ate `base`. `suave` troca os bicos de
// montanha por colina arredondada.
function florestaCrista(pontos, base, suave){
  var d = 'M' + pontos[0][0] + ' ' + pontos[0][1], i;
  if (suave) {
    for (i = 1; i < pontos.length; i++) {
      var a = pontos[i - 1], b = pontos[i], mx = ((a[0] + b[0]) / 2).toFixed(1);
      d += 'C' + mx + ' ' + a[1] + ',' + mx + ' ' + b[1] + ',' + b[0] + ' ' + b[1];
    }
  } else {
    for (i = 1; i < pontos.length; i++) d += 'L' + pontos[i][0] + ' ' + pontos[i][1];
  }
  return d + 'L' + pontos[pontos.length - 1][0] + ' ' + base +
             'L' + pontos[0][0] + ' ' + base + 'Z';
}

// As bandas passam de -80 a 1280 para o balanco do mouse nunca descobrir
// a borda do desenho.
var FL_E = -80, FL_D = 1280;

// ─── As tres bandas que viajam ─────────────────────────────────────────
//
// `periodo` e a altura do azulejo: o azulejo e repetido de `periodo` em
// `periodo` e o deslocamento e tirado em modulo, entao o que sai por cima
// reentra por baixo sem emenda visivel — as emendas caem sempre no ceu,
// entre uma serra e a seguinte.
//
// Os periodos sao diferentes de proposito. Se fossem iguais, as tres
// bandas voltariam juntas a mesma posicao e a paisagem se repetiria como
// um todo. Sendo 1000 / 820 / 760 com taxas 0.09 / 0.26 / 0.52, cada uma
// volta a cada 11.111, 3.154 e 1.462 pixels de rolagem — e a composicao
// das tres, so muito depois de qualquer pagina real.

var FLORESTA_BANDAS = [
  {
    nome:'serras', periodo:1000, taxa:0.09, balanco:9, cor:'longe', opacidade:0.62,
    desenhar: function(){
      return [
        florestaCrista([[FL_E,308],[40,182],[150,252],[286,120],[402,236],[520,166],
                        [648,262],[762,148],[900,238],[1030,176],[1160,266],[FL_D,306]], 468),
        florestaCrista([[FL_E,742],[96,640],[214,700],[340,586],[470,678],[598,612],
                        [726,704],[858,600],[982,690],[1108,628],[FL_D,736]], 912)
      ];
    },
    nevoas: [440, 884]
  },
  {
    nome:'cristas', periodo:820, taxa:0.26, balanco:18, cor:'meio', opacidade:0.86,
    desenhar: function(){
      return [
        florestaCrista([[FL_E,262],[150,228],[318,250],[486,214],[650,244],[820,210],
                        [990,240],[1140,216],[FL_D,246]], 470, true),
        florestaCrista([[FL_E,606],[170,578],[352,600],[530,566],[706,594],[882,562],
                        [1060,592],[FL_D,570]], 812, true)
      ];
    },
    // Coniferas pequenas pousadas nas duas cristas desta banda.
    arvores: [[262,254,52,24,4],[300,256,38,18,4],[742,238,58,26,5],[786,242,42,20,4],
              [206,584,64,30,5],[252,588,46,22,4],[934,572,68,32,5],[978,578,48,24,4]],
    nevoas: [446, 788]
  },
  {
    nome:'mata', periodo:760, taxa:0.52, balanco:30, cor:'mata', opacidade:1,
    desenhar: function(){
      return [
        florestaCrista([[FL_E,226],[186,196],[382,218],[576,188],[768,212],[962,186],
                        [1150,210],[FL_D,198]], 416, true),
        florestaCrista([[FL_E,586],[196,560],[404,580],[604,552],[800,576],[1000,550],
                        [1180,574],[FL_D,562]], 760, true)
      ];
    },
    arvores: [[118,206,104,46,6],[178,212,74,34,5],[860,198,116,50,6],[918,204,80,36,5],
              [332,572,96,42,6],[386,578,68,32,5],[1058,562,108,48,6]],
    nevoas: [398, 742]
  }
];

// ─── Chao ancorado ─────────────────────────────────────────────────────
// Nunca viaja. E ele que impede o "o chao some": haja a rolagem que houver,
// sempre ha terra no pe da tela para as serras nascerem atras.
var FLORESTA_CHAO = florestaCrista(
  [[FL_E,96],[150,74],[330,92],[520,70],[700,86],[880,96],[1060,78],[FL_D,92]], 260, true);
var FLORESTA_CHAO_ARVORES = [
  floresteConifera(58, 118, 176, 76, 7),
  floresteConifera(146, 132, 124, 56, 6),
  floresteConifera(1138, 114, 188, 78, 7)
];

// ─── Passaros ──────────────────────────────────────────────────────────

var FLORESTA_PASSARO = 'M0 0C4.2 -4.6 8.4 -4.6 12 -0.6C15.6 -4.6 19.8 -4.6 24 0';
var FLORESTA_BANDO = [
  {atraso:0,   dur:26, y:178, escala:1,    de:168, deriva:-34},
  {atraso:3.5, dur:30, y:236, escala:0.78, de:210, deriva:-20},
  {atraso:9,   dur:23, y:132, escala:0.62, de:138, deriva:-46},
  {atraso:15,  dur:34, y:286, escala:0.5,  de:246, deriva:-12}
];

// ─── Paletas ───────────────────────────────────────────────────────────

var FLORESTA_PALETAS = {
  dark:  {longe1:'#26332A',longe2:'#1B241D',meio1:'#1C271F',meio2:'#141C16',
          mata1:'#141D17',mata2:'#0C120E',
          arvCrista:'#1A241C',arvMata:'#0E1610',
          chao:'#080B08',arvChao:'#050705',
          passaro:'#EBE3A7',passaroOp:0.34,
          fumaca:'#EBE3A7',fumacaOp:0.26},
  light: {longe1:'#AFC0A8',longe2:'#9EB198',meio1:'#88A085',meio2:'#75906F',
          mata1:'#5E7C5B',mata2:'#4A6547',
          arvCrista:'#7E9779',arvMata:'#4E6B4B',
          chao:'#37502F',arvChao:'#2B4026',
          passaro:'#2E2910',passaroOp:0.6,
          fumaca:'#4A4326',fumacaOp:0.3}
};

// ═══════════════════════════════════════════════════════════════════════
// A FOGUEIRA
//
// Fica no canto direito de baixo, pequena: o tamanho e o que diz que ela
// esta longe, no meio do campo, e nao ao lado de quem olha. Vive num SVG
// proprio, com proporcao preservada — as bandas da paisagem sao esticadas
// na largura (silhueta abstrata aguenta), mas uma chama esticada tres
// vezes no celular viraria uma tira.
//
// Sao quatro coisas empilhadas, do fundo para a frente: o brilho no ar, a
// poca de luz no chao, as chamas e a fumaca. Cada chama tem sua propria
// duracao, nenhuma multipla da outra, para nunca baterem no mesmo quadro —
// fogo em sincronia parece um logo piscando.
//
// A fumaca sobe POUCO de proposito: 64 unidades num quadro de 170, e ja
// esta transparente na metade do caminho. Fumaca que sobe ate o topo da
// tela vira efeito; ficando baixa, vira clima.
// ═══════════════════════════════════════════════════════════════════════

var FLORESTA_FOGO_W = 120, FLORESTA_FOGO_H = 170, FLORESTA_FOGO_BASE = 152;

// Chama em gota: base larga no fogo, ponta fina em cima, com uma barriga
// de um lado so para nao ficar simetrica como um pingo de agua.
function florestaChama(altura, largura, curva){
  var b = FLORESTA_FOGO_BASE, x = 60;
  return 'M' + x + ' ' + b +
         'C' + (x - largura) + ' ' + (b - altura * 0.22) + ',' +
               (x - largura * curva) + ' ' + (b - altura * 0.62) + ',' +
               x + ' ' + (b - altura) +
         'C' + (x + largura * curva) + ' ' + (b - altura * 0.62) + ',' +
               (x + largura) + ' ' + (b - altura * 0.22) + ',' +
               x + ' ' + b + 'Z';
}

var FLORESTA_CHAMAS = [
  {d:florestaChama(46, 15, 0.72), cor:'#EB7D00', op:0.92, dur:1.45, atraso:0},
  {d:florestaChama(34, 11, 0.62), cor:'#F5A03D', op:0.95, dur:1.13, atraso:0.21},
  {d:florestaChama(20,  7, 0.55), cor:'#FFD98A', op:0.98, dur:0.79, atraso:0.07}
];
var FLORESTA_FUMACA = [
  {x:60, r:10,  dur:7.4, atraso:0,   deriva:-13, alto:60},
  {x:57, r:8,   dur:6.1, atraso:1.9, deriva:-19, alto:52},
  {x:63, r:9,   dur:8.3, atraso:3.4, deriva:-7,  alto:64},
  {x:59, r:6.5, dur:5.6, atraso:5.1, deriva:-22, alto:46}
];
var FLORESTA_FAISCAS = [
  {x:55, dur:3.1, atraso:0.4, deriva:-7, alto:34},
  {x:65, dur:3.9, atraso:2.2, deriva:5,  alto:28}
];

function florestaFogueira(P, claro){
  var chamas = FLORESTA_CHAMAS.map(function(c, i){
    return '<path class="fog-chama" d="' + c.d + '" fill="' + c.cor + '" opacity="' + c.op +
           '" style="animation-duration:' + c.dur + 's;animation-delay:' + c.atraso + 's' +
           ';transform-origin:60px ' + FLORESTA_FOGO_BASE + 'px"/>';
  }).join('');

  var fumaca = FLORESTA_FUMACA.map(function(f){
    return '<circle class="fog-fumaca" cx="' + f.x + '" cy="' + (FLORESTA_FOGO_BASE - 46) +
           '" r="' + f.r + '" fill="' + P.fumaca + '"' +
           ' style="--sobe:' + (-f.alto) + 'px;--lado:' + f.deriva + 'px;--pico:' + P.fumacaOp +
           ';animation-duration:' + f.dur + 's;animation-delay:' + f.atraso + 's"/>';
  }).join('');

  var faiscas = FLORESTA_FAISCAS.map(function(f){
    return '<circle class="fog-faisca" cx="' + f.x + '" cy="' + (FLORESTA_FOGO_BASE - 16) +
           '" r="1.3" fill="#FFD98A"' +
           ' style="--sobe:' + (-f.alto) + 'px;--lado:' + f.deriva + 'px' +
           ';animation-duration:' + f.dur + 's;animation-delay:' + f.atraso + 's"/>';
  }).join('');

  return '<svg class="floresta-fogueira" viewBox="0 0 ' + FLORESTA_FOGO_W + ' ' + FLORESTA_FOGO_H + '" aria-hidden="true">' +
    '<defs>' +
      '<radialGradient id="fog-brilho" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0%" stop-color="#FFB13D" stop-opacity="' + (claro ? 0.5 : 0.62) + '"/>' +
        '<stop offset="38%" stop-color="#EB7D00" stop-opacity="' + (claro ? 0.2 : 0.26) + '"/>' +
        '<stop offset="100%" stop-color="#EB7D00" stop-opacity="0"/></radialGradient>' +
      // A poca no chao e o que prende a fogueira ao terreno. Sem ela a
      // chama flutua e o olho percebe na hora.
      '<radialGradient id="fog-chao" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0%" stop-color="#EB7D00" stop-opacity="' + (claro ? 0.3 : 0.4) + '"/>' +
        '<stop offset="100%" stop-color="#EB7D00" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<ellipse class="fog-luz" cx="60" cy="' + (FLORESTA_FOGO_BASE - 20) + '" rx="40" ry="36" fill="url(#fog-brilho)"/>' +
    '<ellipse cx="60" cy="' + (FLORESTA_FOGO_BASE + 3) + '" rx="46" ry="10" fill="url(#fog-chao)"/>' +
    '<g class="fog-fumaca-grupo">' + fumaca + '</g>' +
    // As achas entram DEPOIS da fumaca e ANTES das chamas: a fumaca nasce
    // atras da lenha e o fogo cobre a juncao das duas.
    '<g fill="' + P.arvChao + '">' +
      '<rect x="36" y="' + (FLORESTA_FOGO_BASE - 4) + '" width="48" height="6" rx="3" transform="rotate(-9 60 ' + FLORESTA_FOGO_BASE + ')"/>' +
      '<rect x="38" y="' + (FLORESTA_FOGO_BASE - 3) + '" width="44" height="6" rx="3" transform="rotate(8 60 ' + FLORESTA_FOGO_BASE + ')"/>' +
    '</g>' +
    '<g class="fog-chamas">' + chamas + '</g>' +
    faiscas +
    '</svg>';
}

// ═══════════════════════════════════════════════════════════════════════

function montarFloresta(){
  var host = document.getElementById('floresta');
  if (!host) return;
  var claro = document.documentElement.getAttribute('data-theme') === 'light';
  var P = FLORESTA_PALETAS[claro ? 'light' : 'dark'];

  // A ponta transparente e o que deixa o ceu aparecer entre uma serra e a
  // seguinte. Sem ela cada azulejo viraria uma faixa solida e a descida
  // sumiria.
  //
  // A cauda tem cinco paradas em vez de uma. Uma rampa linear que termina
  // em zero deixa um VINCO: a opacidade e continua, mas a inclinacao muda
  // de repente, e o olho le isso como uma linha reta atravessando a tela.
  // No tema escuro, com tudo quase preto, a linha fica obvia. Descendo por
  // 0,58 / 0,30 / 0,12 / 0,04 / 0 a transparencia chega a zero sem quebra.
  function degrade(id, c1, c2){
    var cauda = [[52,1],[68,0.58],[80,0.3],[89,0.12],[95,0.04],[100,0]];
    return '<linearGradient id="floresta-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + c1 + '"/>' +
             cauda.map(function(c){
               return '<stop offset="' + c[0] + '%" stop-color="' + c2 +
                      '" stop-opacity="' + c[1] + '"/>';
             }).join('') +
           '</linearGradient>';
  }

  // Cada faixa e um SVG separado, entao cada uma leva a sua copia das
  // definicoes: url(#id) nao atravessa a fronteira de um SVG para outro.
  var defs =
    degrade('longe', P.longe1, P.longe2) +
    degrade('meio',  P.meio1,  P.meio2) +
    degrade('mata',  P.mata1,  P.mata2) +
    '<linearGradient id="floresta-vale" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#3A7059" stop-opacity="0"/>' +
      '<stop offset="46%" stop-color="#3A7059" stop-opacity="' + (claro?0.07:0.15) + '"/>' +
      '<stop offset="100%" stop-color="#3A7059" stop-opacity="0"/></linearGradient>';

  function caminhos(lista, cor, op){
    return lista.map(function(d){
      return '<path d="' + d + '" fill="' + cor + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
    }).join('');
  }

  // Um azulejo da banda, repetido quantas vezes forem precisas para cobrir
  // o palco mais uma folga — e a folga que entra por baixo enquanto a de
  // cima ainda esta saindo.
  // Cada banda e um SVG proprio, e nao um <g> dentro de um SVG so.
  //
  // O motivo e de desempenho, e foi medido: mover um <g> por atributo
  // transform obriga o navegador a REDESENHAR aquele grupo inteiro a cada
  // quadro da rolagem — tres bandas de caminhos grandes com degrade, numa
  // tela cheia. Medido nesta maquina: 38 fps contra 60 de linha de base.
  // Um elemento SVG movido por transform de CSS com will-change vira uma
  // camada propria: o desenho e rasterizado UMA vez e a rolagem so reposi-
  // ciona a camada.
  //
  // Por isso o SVG e mais alto que a tela por exatamente um azulejo: o
  // pedaco que sobra pendurado embaixo e o que entra na tela enquanto a
  // banda sobe, sem nada precisar ser redesenhado.
  function banda(b){
    var corpo = (b.nevoas || []).map(function(y){
      return '<rect x="' + FL_E + '" y="' + (y - 104) + '" width="' + (FL_D - FL_E) +
             '" height="208" fill="url(#floresta-vale)"/>';
    }).join('');
    corpo += caminhos(b.desenhar(), 'url(#floresta-' + b.cor + ')');
    if (b.arvores) {
      var cor = b.cor === 'mata' ? P.arvMata : P.arvCrista;
      corpo += caminhos(b.arvores.map(function(a){
        return floresteConifera(a[0], a[1], a[2], a[3], a[4]);
      }), cor);
    }
    var alturaVB = FLORESTA_PALCO_H + b.periodo;
    // Os azulejos cobrem a caixa esticada inteira, com uma folga.
    var copias = Math.ceil(alturaVB / b.periodo) + 1, tijolos = '';
    for (var i = 0; i < copias; i++) {
      tijolos += '<g transform="translate(0 ' + (i * b.periodo) + ')">' + corpo + '</g>';
    }
    // A altura em % mantem a MESMA escala vertical de uma caixa de 900
    // unidades ocupando a tela: assim uma unidade vale o mesmo em todas as
    // bandas, e o deslocamento em pixels sai de uma conta so.
    return '<svg class="floresta-faixa" viewBox="0 0 ' + FLORESTA_PALCO_W + ' ' + alturaVB + '"' +
           ' preserveAspectRatio="none" aria-hidden="true"' +
           ' data-taxa="' + b.taxa + '" data-periodo="' + b.periodo + '" data-balanco="' + b.balanco + '"' +
           ' style="height:' + (alturaVB / FLORESTA_PALCO_H * 100).toFixed(3) + '%;opacity:' + b.opacidade + '">' +
           '<defs>' + defs + '</defs>' + tijolos + '</svg>';
  }

  var passaros = FLORESTA_BANDO.map(function(b, i){
    return '<g class="floresta-passaro" style="--deriva:' + b.deriva + 'px;' +
             'animation:floresta-voo ' + b.dur + 's linear ' + b.atraso + 's infinite">' +
             '<g transform="translate(' + b.de + ' ' + b.y + ') scale(' + b.escala + ')">' +
               '<g style="animation:floresta-asa ' + (0.42 + i * 0.07) + 's ease-in-out infinite;transform-origin:12px 0">' +
                 '<path d="' + FLORESTA_PASSARO + '" fill="none" stroke="' + P.passaro +
                 '" stroke-opacity="' + (P.passaroOp - i * 0.045) + '" stroke-width="2.4" stroke-linecap="round"/>' +
               '</g></g></g>';
  }).join('');

  // A ponta transparente e o que deixa o ceu aparecer entre uma serra e a
  // seguinte. Sem ela cada azulejo viraria uma faixa solida e a descida
  // sumiria.
  //
  // A cauda tem cinco paradas em vez de uma. Uma rampa linear que termina
  // em zero deixa um VINCO: a opacidade e continua, mas a inclinacao muda
  // de repente, e o olho le isso como uma linha reta atravessando a tela.
  // No tema escuro, com tudo quase preto, a linha fica obvia. Descendo por
  // 0,58 / 0,30 / 0,12 / 0,04 / 0 a transparencia chega a zero sem quebra.
  function degrade(id, c1, c2){
    var cauda = [[52,1],[68,0.58],[80,0.3],[89,0.12],[95,0.04],[100,0]];
    return '<linearGradient id="floresta-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
             '<stop offset="0%" stop-color="' + c1 + '"/>' +
             cauda.map(function(c){
               return '<stop offset="' + c[0] + '%" stop-color="' + c2 +
                      '" stop-opacity="' + c[1] + '"/>';
             }).join('') +
           '</linearGradient>';
  }

  host.innerHTML =
    '<div class="floresta-ceu" style="background:' +
      'radial-gradient(52% 40% at 68% 72%,rgba(245,160,61,' + (claro?0.16:0.22) + ') 0%,rgba(235,125,0,' + (claro?0.07:0.11) + ') 40%,rgba(235,125,0,0) 74%),' +
      'radial-gradient(130% 56% at 50% 100%,rgba(44,87,69,' + (claro?0.1:0.26) + ') 0%,rgba(44,87,69,0) 72%)"></div>' +

    // O palco leva a mascara que dissolve o topo. Ele nao se move: quem se
    // move sao as faixas dentro dele.
    '<div class="floresta-palco">' +
      banda(FLORESTA_BANDAS[0]) +
      // O sol entra aqui: na frente das serras, atras das cristas — e por
      // isso le como luz vindo de tras da montanha, e nao como um circulo
      // colado por cima do desenho. Em CSS, e nao em SVG, porque e um
      // borrao de cor sem forma: um degrade radial resolve sem um no a mais.
      '<div class="floresta-sol" style="background:radial-gradient(45% 34% at 67% 67%,' +
        'rgba(245,160,61,' + (claro?0.24:0.34) + ') 0%,' +
        'rgba(235,125,0,' + (claro?0.1:0.15) + ') 45%,rgba(235,125,0,0) 100%)"></div>' +
      '<svg class="floresta-passaros" viewBox="0 0 ' + FLORESTA_PALCO_W + ' ' + FLORESTA_PALCO_H + '"' +
        ' preserveAspectRatio="none" aria-hidden="true">' + passaros + '</svg>' +
      banda(FLORESTA_BANDAS[1]) +
      banda(FLORESTA_BANDAS[2]) +
    '</div>' +

    '<svg class="floresta-chao" viewBox="0 0 ' + FLORESTA_CHAO_W + ' ' + FLORESTA_CHAO_H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + FLORESTA_CHAO + '" fill="' + P.chao + '"/>' +
      caminhos(FLORESTA_CHAO_ARVORES, P.arvChao) +
    '</svg>' +

    florestaFogueira(P, claro);

  ligarParallaxFloresta(host);
}

// ─── Movimento ─────────────────────────────────────────────────────────

var florestaSolto = null;   // guarda como desligar o parallax anterior

function ligarParallaxFloresta(host){
  if (florestaSolto) { florestaSolto(); florestaSolto = null; }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var faixas = host.querySelectorAll('.floresta-faixa');
  var chao   = host.querySelector('.floresta-chao');
  var fogo   = host.querySelector('.floresta-fogueira');
  var mx = 0, my = 0, rolagem = 0, quadro = null;

  // O deslocamento vai em PORCENTAGEM, nao em pixels.
  //
  // Isto nao e preferencia de estilo, e o que faz a volta fechar. A volta
  // so nao tem emenda se mover a faixa por exatamente um azulejo puser o
  // azulejo de baixo onde estava o de cima. Em pixels isso exige saber
  // quantos pixels vale uma unidade do viewBox — uma medida que depende do
  // tamanho da janela no instante em que foi tirada, e que eu tirei errada:
  // o valor medido na montagem (770/900) nao era o da tela ja pronta
  // (860/900), e cada volta dava um pulo de uns 100px.
  //
  // Porcentagem de transform se resolve contra a propria caixa do
  // elemento, que e exatamente a caixa do viewBox. Entao `sobe/alturaVB`
  // vale `sobe` unidades em qualquer tela, sem medir nada e sem nada para
  // atualizar quando a janela muda de tamanho.

  function aplicar(){
    quadro = null;
    for (var i = 0; i < faixas.length; i++) {
      var f = faixas[i];
      var taxa = Number(f.getAttribute('data-taxa'));
      var periodo = Number(f.getAttribute('data-periodo'));
      var bal = Number(f.getAttribute('data-balanco'));
      // O modulo e o truque inteiro: a banda anda para sempre, mas o
      // deslocamento aplicado nunca passa de um azulejo. O que saiu por
      // cima ja esta desenhado embaixo, na posicao exata — e por isso a
      // volta nao tem emenda nem salto.
      var alturaVB = FLORESTA_PALCO_H + periodo;
      var sobe = -((((rolagem * taxa) % periodo) + periodo) % periodo);
      f.style.transform =
        'translate3d(' + (mx * bal / FLORESTA_PALCO_W * 100).toFixed(4) + '%,' +
        ((sobe + my * bal * 0.3) / alturaVB * 100).toFixed(4) + '%,0)';
    }
    // O chao nao viaja com a rolagem: so respira com o mouse. E ele que
    // garante que sempre haja terra no pe da tela.
    if (chao) chao.style.transform =
      'translate3d(' + (mx * 14).toFixed(2) + 'px,' + (my * 5).toFixed(2) + 'px,0)';
    if (fogo) fogo.style.transform =
      'translate3d(' + (mx * 18).toFixed(2) + 'px,' + (my * 6).toFixed(2) + 'px,0)';
  }
  function agendar(){ if (quadro == null) quadro = requestAnimationFrame(aplicar); }

  function noMouse(e){
    var r = host.getBoundingClientRect();
    mx = (e.clientX - r.left) / Math.max(r.width, 1) * 2 - 1;
    my = (e.clientY - r.top) / Math.max(r.height, 1) * 2 - 1;
    agendar();
  }
  // Quem rola de verdade e o #main, nao a janela.
  var rolante = document.getElementById('main') || window;
  function naRolagem(){
    rolagem = rolante === window ? window.scrollY : rolante.scrollTop;
    agendar();
  }
  window.addEventListener('mousemove', noMouse, {passive:true});
  rolante.addEventListener('scroll', naRolagem, {passive:true});
  naRolagem();

  florestaSolto = function(){
    window.removeEventListener('mousemove', noMouse);
    rolante.removeEventListener('scroll', naRolagem);
    if (quadro != null) cancelAnimationFrame(quadro);
  };
}

document.addEventListener('DOMContentLoaded', function(){
  montarFloresta();
  // As silhuetas sao fill de SVG: nao seguem token, precisam ser repintadas.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(montarFloresta).observe(document.documentElement,
      {attributes:true, attributeFilter:['data-theme']});
  }
});
