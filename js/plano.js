// PLANO — quem e Free, quem e Pro, quem e Max, e o que cada um libera.
//
// DE ONDE VEM O PLANO
// Da tabela `subscriptions` no Supabase, escrita SOMENTE pelo webhook do
// Mercado Pago (funcao mp-webhook, com a chave de servico). O navegador so
// consegue LER, e so a propria linha: a RLS da tabela tem uma policy de
// SELECT com auth.uid() = user_id e nenhuma de escrita. Ou seja, ninguem
// vira Pro editando nada pelo navegador.
//
// STATUS MANDA MAIS QUE PLANO
// A linha guarda `plano` e `status`. O webhook escreve status 'ativo' so
// quando o Mercado Pago responde "authorized"; em cancelamento, falha de
// cartao ou pagamento pendente, ele escreve 'inativo' — mas o `plano`
// continua dizendo "pro". Por isso a conta aqui e:
//
//     plano vale  ⟺  status === 'ativo'
//
// Ler so o `plano`, como um atalho, deixaria quem cancelou com o Pro para
// sempre. E tambem e o que faz o cancelamento funcionar de ponta a ponta: a
// pessoa cancela no Mercado Pago, o MP avisa o webhook, a linha vira
// inativa e o app cai para o Free sozinho, sem precisar de endpoint nenhum.
//
// CONTAS DE CORTESIA
// A tabela tem tambem `origem` ('mercadopago' ou 'cortesia') e `nota`. Uma
// linha escrita a mao — a conta do fundador, um teste, um cliente que teve
// problema de cobranca — vale igual aqui: o app nao olha a origem, so plano e
// status. A marcacao existe para a contagem de faturamento nao somar quem
// nunca pagou. O mp-webhook nao envia essas duas colunas, entao assinatura
// paga nasce com origem 'mercadopago' e a marcacao de cortesia sobrevive a
// qualquer atualizacao vinda do Mercado Pago.
//
// A TRAVA AQUI E DE INTERFACE, NAO DE SEGURANCA
// Os limites do Free sao conferidos no navegador. Quem abrir o console
// consegue passar por eles. Enquanto o estado do usuario for um unico JSON
// gravado inteiro pelo proprio cliente, nao ha onde o servidor conferir —
// e a trava serve para convidar a assinar, nao para se defender de ataque.

var PLANO_ATUAL = 'free';
var PLANO_STATUS = 'inativo';

var PLANO_LIMITES = { tarefas: 20, metas: 20 };

// A chave publicavel do projeto. E publica por natureza, como a anon key que
// o app ja usa: nao da acesso a nada que a RLS nao permita.
var PLANO_CHAVE_PUB = 'sb_publishable_G3XsyrkXozLfrNjHp5ekVQ_nEpMMINS';
var PLANO_ENDPOINT  = SUPA_URL + '/functions/v1/criar-assinatura';

// Onde a pessoa cancela de verdade. Nao existe endpoint de cancelamento, e
// nem deveria: quem manda na assinatura e o Mercado Pago. Cancelado la, o
// webhook derruba a linha para inativo e o app acompanha.
var PLANO_URL_MP = 'https://www.mercadopago.com.br/subscriptions';

var PLANOS = {
  free: {nome:'Ticolino Free', preco:'R$ 0,00',  mensal:null},
  pro:  {nome:'Ticolino Pro',  preco:'R$ 10,00', mensal:10, semana:'R$ 2,50'},
  max:  {nome:'Ticolino Max',  preco:'R$ 15,00', mensal:15, semana:'R$ 3,75'}
};

// Os recursos, na ordem em que aparecem nos tres cartoes.
//
// `de` diz a partir de qual plano o recurso vale. `breve` marca o que foi
// anunciado mas ainda nao existe no app: aparece na lista com a etiqueta
// "Em breve" e sem o check, para ninguem pagar esperando encontrar hoje.
var PLANO_RECURSOS = [
  {chave:'tarefas',    de:'free', rotuloFree:'20 tarefas liberadas', rotulo:'Tarefas ilimitadas'},
  {chave:'metas',      de:'free', rotuloFree:'20 metas liberadas',   rotulo:'Metas ilimitadas'},
  {chave:'abas',       de:'free', rotulo:'Acesso a todas as abas'},
  {chave:'lembretes',  de:'pro',  rotulo:'Lembretes diários'},
  {chave:'xpDobro',    de:'max',  rotulo:'XP em dobro'},
  {chave:'relatorios', de:'max',  rotulo:'Relatórios'},
  {chave:'skins',      de:'max',  rotulo:'Skins do Ticolino',     breve:true},
  {chave:'temas',      de:'max',  rotulo:'Temas do aplicativo',   breve:true}
];

var PLANO_ORDEM = {free:0, pro:1, max:2};

// ─── Leitura do plano ──────────────────────────────────────────────────

function planoAtivo(){ return PLANO_STATUS === 'ativo' ? PLANO_ATUAL : 'free'; }

// O recurso esta liberado? O que ainda nao existe (`breve`) nunca libera —
// nao ha o que liberar.
function temRecurso(chave){
  var r = null;
  for(var i = 0; i < PLANO_RECURSOS.length; i++){
    if(PLANO_RECURSOS[i].chave === chave){ r = PLANO_RECURSOS[i]; break; }
  }
  if(!r || r.breve) return false;
  return PLANO_ORDEM[planoAtivo()] >= PLANO_ORDEM[r.de];
}

function semLimite(){ return planoAtivo() !== 'free'; }
function xpEmDobro(){ return temRecurso('xpDobro'); }

async function carregarPlano(){
  if(!currentUser) return;
  try{
    var res = await sb.from('subscriptions')
      .select('plano,status').eq('user_id', currentUser.id).maybeSingle();
    if(res.data){
      PLANO_ATUAL  = res.data.plano  || 'free';
      PLANO_STATUS = res.data.status || 'inativo';
    }else{
      // Sem linha na tabela = nunca assinou. E o caso normal, nao um erro.
      PLANO_ATUAL = 'free'; PLANO_STATUS = 'inativo';
    }
  }catch(e){
    // Rede fora: segue como Free. Tratar falha como "provavelmente e Pro"
    // liberaria recurso pago para quem nao pagou.
    console.error('carregarPlano:', e);
  }
  aplicarPlano();
}

// Tudo que muda de aparencia conforme o plano passa por aqui.
function aplicarPlano(){
  var botao = document.getElementById('res-relatorio-btn');
  if(botao){
    var liberado = temRecurso('relatorios');
    botao.classList.toggle('travado', !liberado);
    botao.setAttribute('title', liberado ? '' : 'Recurso do Ticolino Max');
  }
  if(document.getElementById('perfil-assinaturas')) renderAssinaturas();
  if(typeof pintarLembrete === 'function') pintarLembrete();
}

// ─── Limites do Free ───────────────────────────────────────────────────
// "Ativas" = ainda nao concluidas. Concluir uma tarefa devolve a vaga; do
// contrario o limite viraria um teto de historico, e quem usa o app direito
// seria punido por usar o app direito.

function tarefasAtivas(){ return (state.tasks || []).filter(function(t){ return !t.done; }).length; }
function metasAtivas(){   return (state.metas || []).filter(function(m){ return !m.done; }).length; }

// Devolve true quando PODE criar. Quando nao pode, abre o convite e devolve
// false, para quem chamou so precisar de um `if`.
function podeCriarTarefa(){
  if(semLimite() || tarefasAtivas() < PLANO_LIMITES.tarefas) return true;
  mostrarLimite('tarefas');
  return false;
}
function podeCriarMeta(){
  if(semLimite() || metasAtivas() < PLANO_LIMITES.metas) return true;
  mostrarLimite('metas');
  return false;
}

var PLANO_RECADOS = {
  tarefas: {
    humor:'triste',
    frase:'Ticolino tá com as patinhas cheias de tarefas! 🐾 Assine o Pro pra ele dar conta de tudo com você.',
    nota:'Você tem ' + PLANO_LIMITES.tarefas + ' tarefas em aberto, o limite do plano gratuito. '
       + 'Concluir uma libera a vaga — ou o Pro tira o limite de vez.'
  },
  metas: {
    humor:'triste',
    frase:'Ticolino tá com as patinhas cheias de metas! 🐾 Assine o Pro pra ele dar conta de tudo com você.',
    nota:'Você tem ' + PLANO_LIMITES.metas + ' metas em andamento, o limite do plano gratuito. '
       + 'Concluir uma libera a vaga — ou o Pro tira o limite de vez.'
  },
  lembretes: {
    humor:'sonolento',
    frase:'O Ticolino ainda não pode te cutucar.',
    nota:'Os lembretes diários são do Ticolino Pro. Todo dia, no horário que você '
       + 'escolher, ele avisa o que vence hoje e o que falta fechar — no celular ou por e-mail.'
  },
  relatorios: {
    humor:'focado',
    frase:'O Resumo de atividades é do Ticolino Max.',
    nota:'Ele junta seu mês inteiro — treinos, gastos, leitura, metas — num documento '
       + 'que você salva em PDF. Está no Max, por R$ 15,00 por mês.'
  }
};

function mostrarLimite(motivo){
  var r = PLANO_RECADOS[motivo] || PLANO_RECADOS.tarefas;
  var tico = document.getElementById('limite-tico');
  if(tico && typeof ticolino === 'function') tico.innerHTML = ticolino(r.humor, 72);
  document.getElementById('limite-frase').textContent = r.frase;
  document.getElementById('limite-nota').textContent = r.nota;
  openModal('modal-limite');
}

function irParaPlanos(){
  closeModal('modal-limite');
  goToPage('perfil');
  perfilAba('assinaturas');
}

// ─── Assinar ───────────────────────────────────────────────────────────

function planoConfirmar(qual){
  var p = PLANOS[qual];
  if(!p || !p.mensal) return;
  document.getElementById('assinar-nome').textContent = p.nome;
  document.getElementById('assinar-total').textContent = p.preco;
  document.getElementById('assinar-cobranca').textContent = p.preco + ' por mês';
  document.getElementById('assinar-ganho').textContent = qual === 'max'
    ? 'Você libera tudo do Pro, o XP em dobro e os relatórios. As skins do Ticolino e os temas do aplicativo entram assim que ficarem prontos.'
    : 'Você libera tarefas e metas ilimitadas. Os lembretes de tarefas entram assim que ficarem prontos.';
  var botao = document.getElementById('assinar-ok');
  botao.disabled = false;
  botao.textContent = 'Ir para o pagamento';
  botao.onclick = function(){ assinarPlano(qual); };
  openModal('modal-assinar');
}

async function assinarPlano(qual){
  if(!currentUser){ toast('⚠️ Entre na sua conta primeiro.'); return; }
  var botao = document.getElementById('assinar-ok');
  botao.disabled = true;
  botao.textContent = 'Abrindo o pagamento…';

  try{
    var r = await fetch(PLANO_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer ' + PLANO_CHAVE_PUB},
      body: JSON.stringify({user_id: currentUser.id, email: currentUser.email, plano: qual})
    });
    var dados = await r.json().catch(function(){ return {}; });

    // A funcao responde 200 mesmo quando o Mercado Pago falha, com
    // init_point nulo. Sem esta conferencia o app mandaria o usuario para
    // um endereco "undefined".
    if(!r.ok || !dados.init_point) throw new Error(dados.error || 'sem init_point');

    window.location.href = dados.init_point;
  }catch(e){
    console.error('assinarPlano:', e);
    botao.disabled = false;
    botao.textContent = 'Ir para o pagamento';
    toast('⚠️ Não consegui abrir o pagamento. Tenta de novo em instantes?');
  }
}

function planoCancelar(){
  var tico = document.getElementById('cancelar-tico');
  if(tico && typeof ticolino === 'function') tico.innerHTML = ticolino('chorando', 84);
  openModal('modal-cancelar');
}

function planoIrAoMercadoPago(){
  closeModal('modal-cancelar');
  window.open(PLANO_URL_MP, '_blank', 'noopener');
}

// ─── A tela de Assinaturas ─────────────────────────────────────────────

function renderAssinaturas(){
  var alvo = document.getElementById('perfil-assinaturas');
  if(!alvo) return;
  var atual = planoAtivo();
  var p = PLANOS[atual];

  // Assinou, mas o pagamento ainda nao foi autorizado (ou falhou). Dizer
  // isso e melhor que mostrar "Free" para quem acabou de pagar.
  var pendente = PLANO_ATUAL !== 'free' && PLANO_STATUS !== 'ativo';

  alvo.innerHTML =
    '<div class="plano-atual">'
      + '<div>'
        + '<div class="plano-rotulo">Seu plano atual</div>'
        + '<div class="plano-atual-linha">'
          + '<span class="plano-atual-nome">' + esc(p.nome) + '</span>'
          + '<span class="plano-atual-preco">' + esc(p.preco)
          + (p.mensal ? ' por mês' : '') + '</span>'
        + '</div>'
        + '<div class="plano-atual-nota">' + (p.mensal
            ? 'Cobrança mensal recorrente, renovada automaticamente.'
            : 'Sem cobrança. Você usa ' + PLANO_LIMITES.tarefas + ' tarefas e '
              + PLANO_LIMITES.metas + ' metas.') + '</div>'
        + (pendente ? '<div class="plano-aviso">Recebemos sua assinatura do '
            + esc(PLANOS[PLANO_ATUAL].nome) + ', mas o Mercado Pago ainda não confirmou o '
            + 'pagamento. Assim que confirmar, os recursos liberam sozinhos.</div>' : '')
      + '</div>'
      + '<div class="plano-atual-acoes">'
        + (atual !== 'max'
            ? '<button class="btn btn-primary btn-sm" onclick="planoConfirmar(\'max\')">Aprimorar plano</button>' : '')
        + (atual !== 'free'
            ? '<button class="btn btn-ghost btn-sm" onclick="planoCancelar()">Cancelar assinatura</button>' : '')
      + '</div>'
    + '</div>'

    + (atual !== 'max'
        ? '<div class="plano-chamada">'
          + '<div class="plano-chamada-tico">'
            + (typeof ticolino === 'function' ? ticolino('rico', 64) : '') + '</div>'
          + '<div><b>O Ticolino Max é o mais vantajoso.</b>'
          + '<span>Tudo do Pro, mais o XP em dobro e os relatórios, por R$ 5,00 a mais por mês.</span></div>'
        + '</div>' : '')

    + '<div class="plano-grade">'
      + cartaoPlano('free', atual) + cartaoPlano('pro', atual) + cartaoPlano('max', atual)
    + '</div>'

    + '<p class="plano-letra-miuda">Valores em reais, já com impostos. A cobrança é mensal e '
      + 'recorrente no cartão cadastrado: R$ 10,00 por mês no Pro e R$ 15,00 por mês no Max. '
      + 'O valor por semana é só uma referência de comparação — não existe cobrança semanal '
      + 'nem plano semanal. A renovação é automática e você pode cancelar quando quiser, pelo '
      + 'Mercado Pago; o acesso continua até o fim do período já pago, sem multa. Os itens '
      + 'marcados como "Em breve" ainda não estão no aplicativo e não são cobrados à parte — '
      + 'eles entram no seu plano assim que ficarem prontos.</p>';

  if(typeof tornarAcessivel === 'function') tornarAcessivel(alvo);
}

function cartaoPlano(qual, atual){
  var p = PLANOS[qual], ehAtual = qual === atual;
  var ordem = PLANO_ORDEM[qual];

  var selos = {
    free: ehAtual ? 'Seu plano' : 'Plano gratuito',
    pro:  ehAtual ? 'Seu plano' : 'Mais completo',
    max:  ehAtual ? 'Seu plano' : 'Mais vantajoso'
  };
  var descricoes = {
    free: 'Para organizar o básico do dia sem pagar nada.',
    pro:  'Sem limite de tarefas e metas.',
    max:  'Tudo liberado, com os relatórios e o XP em dobro.'
  };

  var linhas = PLANO_RECURSOS.map(function(r){
    var incluso = ordem >= PLANO_ORDEM[r.de];
    var rotulo = (qual === 'free' && r.rotuloFree) ? r.rotuloFree : r.rotulo;
    var estado = !incluso ? 'nao' : (r.breve ? 'breve' : 'sim');
    return '<li class="plano-item ' + estado + '">'
      + PLANO_MARCAS[estado]
      + '<span>' + esc(rotulo) + '</span>'
      + (estado === 'breve' ? '<span class="plano-breve">Em breve</span>' : '')
    + '</li>';
  }).join('');

  var acao;
  if(ehAtual){
    acao = '<button class="btn btn-ghost btn-sm" disabled>Plano atual</button>';
  }else if(qual === 'free'){
    acao = '<button class="btn btn-ghost btn-sm" onclick="planoCancelar()">Voltar para o Free</button>';
  }else{
    acao = '<button class="btn ' + (qual === 'max' ? 'btn-primary' : 'btn-ghost')
         + ' btn-sm" onclick="planoConfirmar(\'' + qual + '\')">Assinar o '
         + (qual === 'max' ? 'Max' : 'Pro') + '</button>';
  }

  return '<div class="plano-cartao' + (ehAtual ? ' atual' : '') + (qual === 'max' ? ' destaque' : '') + '">'
    + '<div class="plano-selo' + (ehAtual ? ' on' : '') + '">' + selos[qual] + '</div>'
    + '<div class="plano-nome">' + esc(p.nome) + '</div>'
    + '<div class="plano-desc">' + esc(descricoes[qual]) + '</div>'
    + '<div class="plano-preco"><b>' + esc(p.preco) + '</b>'
      + (p.mensal ? '<span>por mês</span>' : '') + '</div>'
    + '<div class="plano-preco-nota">' + (p.mensal
        ? 'Equivale a ' + p.semana + ' por semana'
        : 'Grátis para sempre, sem cartão') + '</div>'
    + '<ul class="plano-lista">' + linhas + '</ul>'
    + '<div class="plano-acao">' + acao + '</div>'
  + '</div>';
}

var PLANO_MARCAS = {
  sim:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>',
  breve: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  nao:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

// ─── Abas do Perfil ────────────────────────────────────────────────────

function perfilAba(qual){
  var conta = qual !== 'assinaturas';
  document.getElementById('perfil-conta').hidden = !conta;
  document.getElementById('perfil-assinaturas').hidden = conta;
  var botoes = document.querySelectorAll('#page-perfil .aba');
  for(var i = 0; i < botoes.length; i++){
    botoes[i].setAttribute('aria-pressed', String((i === 0) === conta));
  }
  if(!conta) renderAssinaturas();
}
