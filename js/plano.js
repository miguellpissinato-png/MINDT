// PLANO — quem e Free, quem e Pro, quem e Max, e o que cada um libera.
//
// DE ONDE VEM O PLANO
// Da tabela `subscriptions` no Supabase, escrita SOMENTE pelo webhook do
// Mercado Pago (funcao mp-webhook, com a chave de servico). O navegador so
// consegue LER, e so a propria linha: a RLS da tabela tem uma policy de
// SELECT com auth.uid() = user_id e nenhuma de escrita. Ou seja, ninguem
// vira Pro editando nada pelo navegador.
//
// PRAZO: O TESTE GRATIS
// Toda conta nasce com 7 dias de Max (gatilho dar_teste_gratis no banco):
// origem 'teste' e `expira_em` preenchido. Passado o prazo a linha continua
// 'ativo', mas o plano deixa de valer — a conta abaixo olha o prazo. Pagar
// apaga o prazo (mp-webhook grava expira_em null).
//
//     plano vale  ⟺  status === 'ativo'  E  (sem prazo OU prazo no futuro)
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
// nunca pagou. O mp-webhook grava origem 'mercadopago' quando o pagamento e
// autorizado, e um aviso de pagamento pendente nao derruba nem cortesia nem
// teste em andamento.
//
// A TRAVA AQUI E DE INTERFACE, NAO DE SEGURANCA
// Os limites do Free sao conferidos no navegador. Quem abrir o console
// consegue passar por eles. Enquanto o estado do usuario for um unico JSON
// gravado inteiro pelo proprio cliente, nao ha onde o servidor conferir —
// e a trava serve para convidar a assinar, nao para se defender de ataque.

var PLANO_ATUAL = 'free';
var PLANO_STATUS = 'inativo';
var PLANO_ORIGEM = null;     // 'mercadopago' | 'cortesia' | 'teste'
var PLANO_EXPIRA = null;     // Date, so no teste gratis

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
  {chave:'financas',   de:'pro',  rotulo:'Gráficos e médias do Dinheiro'},
  {chave:'xpDobro',    de:'max',  rotulo:'XP em dobro'},
  {chave:'relatorios', de:'max',  rotulo:'Relatórios'},
  {chave:'skins',      de:'max',  rotulo:'Skins do Ticolino',     breve:true},
  {chave:'temas',      de:'max',  rotulo:'Temas do aplicativo',   breve:true}
];

var PLANO_ORDEM = {free:0, pro:1, max:2};

// ─── Leitura do plano ──────────────────────────────────────────────────

function planoAtivo(){
  if(PLANO_STATUS !== 'ativo') return 'free';
  if(PLANO_EXPIRA && PLANO_EXPIRA.getTime() <= Date.now()) return 'free';
  return PLANO_ATUAL;
}

// ─── Teste gratis ──────────────────────────────────────────────────────
function emTeste(){ return PLANO_ORIGEM === 'teste' && planoAtivo() !== 'free'; }
// Acabou e a pessoa nao assinou (se assinasse, a origem viraria mercadopago).
function testeAcabou(){
  return PLANO_ORIGEM === 'teste' && !!PLANO_EXPIRA && PLANO_EXPIRA.getTime() <= Date.now();
}
// Ultimo dia de uso: o prazo e a meia-noite DEPOIS dele.
function ultimoDiaTeste(){
  if(!PLANO_EXPIRA) return null;
  return new Date(PLANO_EXPIRA.getTime() - 1000);
}
function diasRestantesTeste(){
  var u = ultimoDiaTeste(); if(!u) return null;
  var a = new Date(); a.setHours(12,0,0,0);
  var b = new Date(u.getTime()); b.setHours(12,0,0,0);
  return Math.round((b - a) / 86400000);
}
function dataCurta(d){ return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) : ''; }

// O que a pessoa fez desde que o teste comecou — numeros dela, que e o que
// mais pesa na hora de decidir. Nada inventado: se nao fez nada, nao diz.
function conquistasDoTeste(){
  if(!PLANO_EXPIRA) return '';
  var inicio = new Date(PLANO_EXPIRA.getTime() - 8 * 86400000).toISOString();
  var gastos = (state.gastos || []).filter(function(g){ return String(g.createdAt || '') >= inicio; }).length;
  var feitas = 0;
  (state.tasks || []).forEach(function(t){
    var lista = typeof conclusoesDaTarefa === 'function' ? conclusoesDaTarefa(t)
              : ((t.done && t.completedAt) ? [t.completedAt] : []);
    lista.forEach(function(iso){ if(String(iso) >= inicio) feitas++; });
  });
  var partes = [];
  if(gastos) partes.push('lançou ' + plural(gastos, 'gasto', 'gastos'));
  if(feitas) partes.push('concluiu ' + plural(feitas, 'tarefa', 'tarefas'));
  return partes.join(' e ');
}

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
      .select('plano,status,origem,expira_em').eq('user_id', currentUser.id).maybeSingle();
    if(res.data){
      PLANO_ATUAL  = res.data.plano  || 'free';
      PLANO_STATUS = res.data.status || 'inativo';
      PLANO_ORIGEM = res.data.origem || null;
      PLANO_EXPIRA = res.data.expira_em ? new Date(res.data.expira_em) : null;
    }else{
      // Sem linha na tabela = nunca assinou. E o caso normal, nao um erro.
      PLANO_ATUAL = 'free'; PLANO_STATUS = 'inativo'; PLANO_ORIGEM = null; PLANO_EXPIRA = null;
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
  aplicarTravasDinheiro();
  pintarFaixaTeste();
  avisarFimDoTeste();
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
  financas: {
    humor:'rico',
    frase:'Seus gastos já estão aqui. Falta só enxergar o desenho deles.',
    nota:'Gráficos por categoria, médias e o dia da semana em que você mais gasta são do '
       + 'Ticolino Pro: R$ 10,00 por mês — R$ 2,50 por semana.'
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
  var cta = document.getElementById('limite-cta'); if(cta) cta.textContent = 'Ver os planos';
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
  if(!currentUser){ toast('⚠️ Entre na sua conta para assinar.'); return; }
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
    toast('⚠️ A tela de pagamento não abriu. Nada foi cobrado. Tente de novo em instantes.');
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

  // Em teste, o plano "atual" e o Max, mas NINGUEM paga: sem isto a tela
  // dizia "R$ 15,00 por mes, cobranca recorrente" e oferecia "Cancelar
  // assinatura" a quem nunca assinou.
  if(emTeste()){
    var faltam = diasRestantesTeste();
    alvo.innerHTML =
      '<div class="plano-atual">'
        + '<div>'
          + '<div class="plano-rotulo">Seu plano atual</div>'
          + '<div class="plano-atual-linha">'
            + '<span class="plano-atual-nome">Teste grátis do Ticolino Max</span>'
            + '<span class="plano-atual-preco">sem cobrança</span>'
          + '</div>'
          + '<div class="plano-atual-nota">Tudo liberado até ' + dataCurta(ultimoDiaTeste())
            + (faltam === 0 ? ' (hoje é o último dia)' : faltam === 1 ? ' (falta 1 dia)' : ' (faltam ' + faltam + ' dias)')
            + '. Depois, sua conta volta para o Free — seus dados ficam, e nada é cobrado sem você assinar.</div>'
        + '</div>'
      + '</div>'
      + '<div class="plano-grade">'
        + cartaoPlano('free', 'teste') + cartaoPlano('pro', 'teste') + cartaoPlano('max', 'teste')
      + '</div>'
      + '<p class="plano-letra-miuda">O teste grátis não pede cartão e termina sozinho. Se você assinar, '
        + 'a cobrança é mensal e recorrente no cartão cadastrado: R$ 10,00 por mês no Pro e R$ 15,00 por '
        + 'mês no Max. O valor por semana é só uma referência de comparação. Você pode cancelar quando '
        + 'quiser, pelo Mercado Pago.</p>';
    if(typeof tornarAcessivel === 'function') tornarAcessivel(alvo);
    return;
  }

  // Assinou, mas o pagamento ainda nao foi autorizado (ou falhou). Dizer
  // isso e melhor que mostrar "Free" para quem acabou de pagar.
  var pendente = PLANO_ATUAL !== 'free' && PLANO_STATUS !== 'ativo' && PLANO_ORIGEM !== 'teste';

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

  var emTesteAgora = atual === 'teste';
  var selos = {
    free: ehAtual ? 'Seu plano' : (emTesteAgora ? 'Depois do teste' : 'Plano gratuito'),
    pro:  ehAtual ? 'Seu plano' : 'Mais completo',
    max:  ehAtual ? 'Seu plano' : (emTesteAgora ? 'Você está testando' : 'Mais vantajoso')
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
  }else if(qual === 'free' && emTesteAgora){
    // No teste nao ha o que cancelar: o Free vem sozinho no fim.
    acao = '<button class="btn btn-ghost btn-sm" disabled>Vem sozinho no fim do teste</button>';
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

// ═══════════════════════════════════════════════════════════════════════
// TRAVAS DO DINHEIRO
//
// No Free ficam os bancos (aba Ganhos) e os lancamentos de gasto. Graficos,
// medias e a aba Geral sao do Pro para cima.
//
// A trava nao esconde o bloco: ela o mostra DESFOCADO, com os dados da
// propria pessoa por baixo. Um cadeado sobre uma caixa vazia nao diz nada;
// o desenho borrado do proprio grafico diz "isso ja e seu, falta destravar".
// O conteudo borrado fica inerte (sem foco, sem clique, fora do leitor de
// tela) — so o convite responde.
// ═══════════════════════════════════════════════════════════════════════

var TRAVAS_DINHEIRO = [
  {id:'metrica-maior-cat', compacta:true},
  {id:'metrica-media',     compacta:true},
  {id:'gastos-pizza-painel', titulo:'Para onde vai o seu dinheiro?',
    texto:'O gráfico por categoria mostra, num relance, o que mais pesa no seu mês.'},
  {id:'ganhos-dash', titulo:'De onde vem o seu dinheiro?',
    texto:'Veja quais entradas mais pesam e com que frequência cada uma cai.'},
  {id:'fin-aba-geral', titulo:'A visão completa do seu dinheiro',
    texto:'Saldo de tudo, médias por categoria e o dia da semana em que você mais gasta, numa tela só.'}
];

function aplicarTravasDinheiro(){
  var liberado = temRecurso('financas');
  TRAVAS_DINHEIRO.forEach(function(t){
    var el = document.getElementById(t.id);
    if(el) trancarBloco(el, !liberado, t);
  });
  // A aba Geral inteira e do Pro: o botao dela mostra o cadeado.
  var aba = document.getElementById('fin-tab-geral');
  if(aba){
    aba.classList.toggle('aba-trancada', !liberado);
    aba.setAttribute('aria-label', liberado ? 'Geral' : 'Geral, recurso do Ticolino Pro');
  }
}

function trancarBloco(el, trancar, t){
  var velha = el.querySelector(':scope > .tranca');
  Array.prototype.forEach.call(el.children, function(filho){
    if(filho.classList.contains('tranca')) return;
    if(trancar){ filho.setAttribute('inert', ''); filho.setAttribute('aria-hidden', 'true'); }
    else { filho.removeAttribute('inert'); filho.removeAttribute('aria-hidden'); }
  });
  el.classList.toggle('trancado', trancar);
  el.classList.toggle('trancado-compacto', trancar && !!t.compacta);
  if(!trancar){ if(velha) velha.remove(); return; }
  if(velha) return;
  var tr = document.createElement('div');
  tr.className = 'tranca';
  if(t.compacta){
    tr.innerHTML = '<button type="button" class="tranca-chip" onclick="mostrarLimite(\'financas\')">'
      + '<span aria-hidden="true">🔒</span> Pro</button>';
  }else{
    // Quem viu isso no teste gratis ouve outra frase: nao e novidade, e algo
    // que ela ja usou e continua ali.
    var jaViu = testeAcabou();
    tr.innerHTML = '<div class="tranca-caixa">'
      + '<div class="tranca-icone" aria-hidden="true">🔒</div>'
      + '<div class="tranca-titulo">' + esc(t.titulo) + '</div>'
      + '<p class="tranca-texto">' + esc(jaViu
          ? 'Você usou isso no teste grátis. Continua tudo aqui, com os seus dados — é só destravar.'
          : t.texto) + '</p>'
      + '<button type="button" class="btn btn-primary btn-sm" onclick="irParaPlanos()">Liberar com o Pro</button>'
      + '<div class="tranca-preco">R$ 10,00 por mês — R$ 2,50 por semana</div>'
      + '</div>';
  }
  el.appendChild(tr);
}

// ═══════════════════════════════════════════════════════════════════════
// FAIXA DO TESTE GRATIS
//
// Quando faltam 3 dias ou mais: discreta, so na Home, avisando que esta
// tudo liberado e ate quando. Nos ultimos 3 dias: em toda pagina, com o que
// volta a ficar trancado — e fechavel ate o dia seguinte. A urgencia e a
// data de verdade; nada de contador inventado.
// ═══════════════════════════════════════════════════════════════════════

function chaveFaixaHoje(){ return 'mindt-faixa-teste-' + (typeof hojeStr === 'function' ? hojeStr() : ''); }

function pintarFaixaTeste(){
  var f = document.getElementById('faixa-teste');
  if(!f) return;
  if(!emTeste()){ f.hidden = true; return; }
  var faltam = diasRestantesTeste();
  var ult = dataCurta(ultimoDiaTeste());
  var naHome = !!document.querySelector('#page-home.active');
  var fechada = false;
  try { fechada = localStorage.getItem(chaveFaixaHoje()) === '1'; } catch(e){}

  var urgente = faltam !== null && faltam <= 2;
  if((!urgente && !naHome) || (urgente && fechada)){ f.hidden = true; return; }

  var texto, cta;
  if(!urgente){
    texto = '🎁 Você está testando o Ticolino Max de graça até ' + ult + '. Gráficos, relatórios e lembretes estão liberados — aproveite.';
    cta = 'Ver os planos';
  }else if(faltam === 2){
    texto = '⏳ Faltam 2 dias do seu Ticolino Max. Depois de ' + ult + ', gráficos, relatórios e lembretes voltam a ficar trancados.';
    cta = 'Continuar com o Ticolino';
  }else if(faltam === 1){
    var feito = conquistasDoTeste();
    texto = '⏳ Amanhã acaba o seu Ticolino Max.' + (feito ? ' Nesses dias você ' + feito + ' — dá pra continuar sem perder o ritmo.' : ' Dá pra continuar sem perder nada do que você montou.');
    cta = 'Continuar com o Ticolino';
  }else{
    texto = '🐹 Hoje é o último dia do seu Ticolino Max. Ele acaba à meia-noite.';
    cta = 'Continuar com o Ticolino';
  }
  f.className = 'faixa-teste' + (urgente ? ' urgente' : '');
  f.innerHTML = '<span class="faixa-teste-texto">' + esc(texto) + '</span>'
    + '<button type="button" class="btn btn-sm ' + (urgente ? 'btn-primary' : 'btn-ghost') + '" onclick="irParaPlanos()">' + cta + '</button>'
    + (urgente ? '<button type="button" class="faixa-teste-fechar" aria-label="Fechar até amanhã" onclick="fecharFaixaTeste()">✕</button>' : '');
  f.hidden = false;
}

function fecharFaixaTeste(){
  try { localStorage.setItem(chaveFaixaHoje(), '1'); } catch(e){}
  var f = document.getElementById('faixa-teste'); if(f) f.hidden = true;
}

// ═══════════════════════════════════════════════════════════════════════
// FIM DO TESTE — um aviso so, na primeira abertura depois do fim.
// Sem culpa e sem susto: o que fica, o que tranca, e a porta aberta.
// ═══════════════════════════════════════════════════════════════════════

function avisarFimDoTeste(){
  if(!testeAcabou() || planoAtivo() !== 'free') return;
  var chave = 'mindt-fim-teste-visto';
  try { if(localStorage.getItem(chave) === '1') return; localStorage.setItem(chave, '1'); } catch(e){ return; }
  var feito = conquistasDoTeste();
  var tico = document.getElementById('limite-tico');
  if(tico && typeof ticolino === 'function') tico.innerHTML = ticolino('triste', 72);
  document.getElementById('limite-frase').textContent =
    'Seu teste do Ticolino Max acabou' + (feito ? ' — e nesses dias você ' + feito + '.' : '.');
  document.getElementById('limite-nota').textContent =
    'Tudo o que você criou continua aqui: tarefas, metas, gastos e bancos. '
    + 'O que volta a ficar trancado são os gráficos e as médias do Dinheiro, os relatórios, '
    + 'os lembretes e o XP em dobro. Para continuar com tudo, é só assinar — leva 1 minuto '
    + 'e dá para cancelar quando quiser.';
  var cta = document.getElementById('limite-cta');
  if(cta) cta.textContent = 'Continuar com o Ticolino';
  openModal('modal-limite');
}
