// I18N — troca de idioma PT/EN.
//
// Duas frentes:
//  1. T(chave) — textos gerados pelo JavaScript.
//  2. traduzirDOM() — textos que estao escritos no HTML. Guarda o original
//     em português no proprio elemento, entao voltar para PT e sempre exato.

var IDIOMA_PADRAO = 'pt';

// Textos usados pelo codigo (chave -> {pt, en})
var TEXTOS = {
  goodMorning:{pt:'Bom dia',en:'Good morning'},
  goodAfternoon:{pt:'Boa tarde',en:'Good afternoon'},
  goodEvening:{pt:'Boa noite',en:'Good evening'},
  level:{pt:'Nível',en:'Level'},
  item:{pt:'item',en:'item'}, items:{pt:'itens',en:'items'},
  objective:{pt:'Objetivo',en:'Goal'},
  nothingRunning:{pt:'Sem itens em andamento',en:'Nothing in progress'},
  tag_leitura:{pt:'LEITURA',en:'READING'},
  tag_estudo:{pt:'ESTUDOS',en:'STUDY'},
  tag_grana:{pt:'GRANA',en:'MONEY'},
  day_leitura:{pt:'20 minutos de leitura',en:'20 minutes of reading'},
  day_estudo:{pt:'1 pomodoro de estudo',en:'1 study pomodoro'},
  day_grana:{pt:'Lançar os gastos do dia',en:"Log today's spending"},
  msgStart:{pt:'Nada marcado ainda. Sem pressa, mas sem enrolação.',en:'Nothing ticked yet. No rush, but no stalling.'},
  msgMid:{pt:'Metade do dia feito. O Ticolino tá te olhando.',en:'Half the day done. Ticolino is watching.'},
  msgDone:{pt:'Dia fechado! Agora sim pode deitar.',en:'Day closed! Now you may lie down.'},
  onbTitle:{pt:'O Ticolino cuida do seu dia.',en:'Ticolino looks after your day.'},
  onbSub:{pt:'Leitura, estudos, grana e metas em um só lugar. Ele lembra, você vive.',en:'Reading, study, money and goals in one place. He remembers, you live.'},
  onbCta:{pt:'Começar',en:'Get started'},
  errInvalid:{pt:'Email ou senha incorretos.',en:'Wrong email or password.'},
  errUnconfirmed:{pt:'Confirme seu email primeiro.',en:'Confirm your email first.'},
  errRegistered:{pt:'Email já cadastrado. Faça login.',en:'Email already registered. Sign in instead.'},
  errShort:{pt:'Senha muito curta (mín. 6 caracteres).',en:'Password too short (min. 6 characters).'},
  subLogin:{pt:'Organize sua vida',en:'Organize your life'},
  subSignup:{pt:'Crie sua conta gratuita',en:'Create your free account'},
  btnLogin:{pt:'Entrar',en:'Sign in'},
  btnSignup:{pt:'Criar conta',en:'Sign up'},
  novaVersao:{pt:'Nova versão disponível',en:'New version available'},
  atualizar:{pt:'Atualizar',en:'Update'},
  instalar:{pt:'Instalar app',en:'Install app'},
  sincronizando:{pt:'Sincronizando...',en:'Syncing...'},
  salvo:{pt:'Salvo',en:'Saved'},
  offline:{pt:'Sem conexão — salvo no aparelho',en:'Offline — saved on device'},
  erroSalvar:{pt:'Não deu para salvar no servidor',en:"Couldn't save to the server"},
  mesclado:{pt:'Dados de outro aparelho foram juntados',en:'Data from another device was merged'}
};

// Textos que estao escritos no HTML (português -> ingles)
var DIC = {
"Confirme seu email":"Confirm your email","Ir para login":"Go to sign in",
"Crie sua conta gratuita":"Create your free account",
"Esqueci minha senha":"Forgot my password","Recuperar senha":"Reset password",
"Digite seu email. Enviaremos um link para você criar uma senha nova.":"Enter your email. We'll send you a link to create a new password.",
"Enviar link":"Send link","Voltar para o login":"Back to sign in","Criar nova senha":"Create a new password",
"Escolha uma senha nova para sua conta.":"Choose a new password for your account.",
"Nova senha":"New password","Repita a nova senha":"Repeat the new password","Salvar senha":"Save password",
"Home":"Home","Metas":"Goals","Tarefas":"Tasks","Gastos":"Money","Agenda":"Agenda","Resumo":"Summary",
"Estudos":"Study","Leitura":"Reading","Notas":"Notes","Perfil":"Profile","Mindt":"Mindt",
"Organize sua vida":"Organize your life","Entrar":"Sign in","Criar conta":"Sign up","Email":"Email","Senha":"Password",
"Olá":"Hello","Hoje":"Today","Em andamento":"In progress","Saldo do mês":"Month balance","dias seguidos":"day streak",
"Nível":"Level","Nível 1":"Level 1","0/100 XP":"0/100 XP","0 XP":"0 XP","0 itens":"0 items","total":"total",
"Nome":"Name","Descrição":"Description","Grupo":"Group","Grupos":"Groups","Prazo":"Deadline","Data":"Date",
"Título":"Title","Conteúdo":"Content","Categoria":"Categoria","Tipo":"Type","Valor total (R$)":"Total (R$)",
"Valor previsto (R$)":"Estimated (R$)","Valor por parcela":"Per installment","Nº de parcelas":"Installments",
"Taxa de juros (%)":"Interest rate (%)","Juros simples":"Simple interest","Juros compostos":"Compound interest",
"Com juros":"With interest","Compra parcelada":"Installment purchase","Dividir em parcelas":"Split into installments",
"Adicionar juros nas parcelas":"Add interest to installments","Sem categoria":"No category","Sem grupo":"No group",
"Salvar":"Save","Cancelar":"Cancel","Criar":"Create","Confirmar":"Confirm","Fechar":"Close","Aplicar":"Apply",
"Editar":"Edit","Excluir":"Delete","Buscar":"Search","Abandonar":"Give up","Sim":"Yes","Não":"No",
"Todos":"All","Todas":"All","Pendentes":"Pending","Concluídas":"Done","Recentes":"Recent","Antigas":"Oldest",
"Dia":"Day","Semana":"Week","Mês":"Month","Ano":"Year","Este mês":"This month","Esta semana":"This week","Este ano":"This year",
"Sub-tarefas":"Subtasks","Progresso das metas":"Goal progress","Metas criadas":"Goals created","Tarefas criadas":"Tasks created",
"Total em gastos":"Total spending","Total gasto":"Total spent","Transações":"Transactions","Lançamentos":"Entries",
"Previsto em metas e tarefas":"Planned in goals and tasks","Distribuição por categoria":"By category",
"Nenhum gasto registrado ainda.":"No spending logged yet.","Categorias criadas":"Categories created",
"Categorias de gastos":"Spending categories","Nova categoria":"New category","Nova meta":"New goal","Nova nota":"New note",
"Nova tarefa":"New task","Novo grupo":"New group","Novo gasto":"New expense","Novo evento":"New event",
"Notas recentes":"Recent notes","Escreva aqui...":"Write here...","Adicionar item...":"Add item...",
"Autor":"Author","Editora":"Publisher","Gênero":"Genre","Capa do livro":"Book cover","Título da obra":"Book title",
"O que você está lendo?":"What are you reading?","Estou lendo agora":"Reading now","Continuar lendo":"Keep reading",
"Já leu este livro antes?":"Read this book before?","Define como leitura ativa":"Set as current read",
"Registrar leitura":"Log reading","Páginas lidas hoje":"Pages read today","0 páginas lidas":"0 pages read",
"Quantidade de páginas":"Number of pages","Resumo de leitura":"Reading summary","Ver resumo":"See summary",
"Gerando seu resumo...":"Building your summary...","De qual período você deseja seu resumo?":"Which period?",
"Quer realmente abandonar essa história?":"Really give up on this story?","Adicionar livro":"Add book",
"Limpar filtros":"Clear filters","Aplicar filtro":"Apply filter","Buscar livros na estante...":"Search the shelf...",
"Sessões hoje":"Sessions today","XP acumulado":"Total XP","XP para o próximo":"XP to next level",
"Minutos":"Minutes","Segundos":"Seconds","Clique no tempo para editar":"Click the time to edit",
"0 / 5 desbloqueados":"0 / 5 unlocked","Uhull! Você desbloqueou o troféu":"Yay! You unlocked the trophy",
"Nome do evento":"Event name","Horário":"Time","Duração":"Duration","Participantes":"Participants",
"Ícone do evento":"Event icon","Importância":"Importance","Repetir evento":"Repeat event",
"Recorrência automática":"Automatic recurrence","Lembrete por email":"Email reminder","Observações":"Notes",
"Salvar evento":"Save event","Criar evento":"Create event","Gerenciar eventos":"Manage events",
"Próximos eventos":"Upcoming","Quantas vezes?":"How many times?","No dia do evento":"On the event day",
"1 dia antes":"1 day before","1 semana antes":"1 week before","1 mês antes":"1 month before",
"Toda semana":"Every week","A cada 2 semanas":"Every 2 weeks","Todo mês":"Every month","Todo ano":"Every year",
"Todos os meses":"Every month","Selecionar da lista...":"Pick from the list...",
"Adicionar contato":"Add contact","Contatos salvos":"Saved contacts","Minha lista de contatos":"My contact list",
"Meu Nome":"My name","Editar perfil":"Edit profile",
"Segunda":"Monday","Seg":"Mon","Ter":"Tue","Qua":"Wed","Qui":"Thu","Sex":"Fri","Sáb":"Sat","Dom":"Sun",
"Janeiro":"January","Fevereiro":"February","Março":"March","Abril":"April","Maio":"May","Junho":"June",
"Julho":"July","Agosto":"August","Setembro":"September","Outubro":"October","Novembro":"November","Dezembro":"December",
"Janeiro 2026":"January 2026",
"+ Adicionar":"+ Add","+ Adicionar gasto":"+ Add expense","+ Criar nota":"+ New note","+ Novo grupo":"+ New group",
"+ Criar evento neste dia":"+ New event this day",
"✓ Concluir":"✓ Complete","✎ Customizar":"✎ Customize","✏️ Editar":"✏️ Edit","✏️ Editar nome":"✏️ Edit name",
"✏️ Editar selecionados":"✏️ Edit selected","🗑 Excluir":"🗑 Delete","🗑 Excluir selecionados":"🗑 Delete selected",
"☑ Selecionar todos":"☑ Select all","⚙️ Categorias":"⚙️ Categories","✅ Tarefas":"✅ Tasks","📌 Metas":"📌 Goals",
"🏆 Troféus":"🏆 Trophies","📖 Registrar leitura":"📖 Log reading","🔍 Buscar na web":"🔍 Search the web",
"📁 Do dispositivo":"📁 From device","📅 Hoje":"📅 Today","📆 Esta semana":"📆 This week","🗓 Este mês":"🗓 This month",
"📊 Este ano":"📊 This year","↩ Sair da conta":"↩ Sign out","↗ Ver página":"↗ Open page","↺ Resetar":"↺ Reset",
"▶ Iniciar":"▶ Start","⏸ Pausar":"⏸ Pause","⏳ Aguarde...":"⏳ Please wait...",
"🔴 Alta":"🔴 High","🟡 Média":"🟡 Medium","🔵 Padrão":"🔵 Normal",
"Clique para adicionar imagem":"Click to add an image","Clique para adicionar a capa":"Click to add the cover",
"Clique para imagem de capa":"Click for a cover image","Detalhes adicionais...":"More details...",
"Descreva sua meta...":"Describe your goal...","Descreva a tarefa...":"Describe the task...",
"👥 Adicionar pessoas na sua lista":"👥 Add people to your list","Ver meu troféu 🎉":"See my trophy 🎉"
};

function idiomaAtual(){
  try { return localStorage.getItem('mindt-lang') || IDIOMA_PADRAO; } catch(e){ return IDIOMA_PADRAO; }
}
function T(chave){
  var e = TEXTOS[chave];
  return e ? (e[idiomaAtual()] || e.pt) : chave;
}

// Percorre o HTML trocando os textos. O original em português fica guardado
// no elemento (dataset.pt), entao a volta e sempre fiel.
function traduzirDOM(){
  var en = idiomaAtual() === 'en';
  var alvos = document.querySelectorAll('body *:not(script):not(style):not(svg):not(defs)');
  for (var i=0;i<alvos.length;i++){
    var el = alvos[i];
    // so elementos cujo conteudo e um unico texto
    if (el.children.length === 0 && el.textContent && el.textContent.trim()){
      var atual = el.textContent.trim();
      // Se o texto mudou para outra frase conhecida, o original guardado
      // esta desatualizado — corrige, senao a traducao volta o texto errado.
      if (el.dataset.pt === undefined || (DIC[atual] && el.dataset.pt !== atual)) el.dataset.pt = atual;
      var orig = el.dataset.pt;
      if (DIC[orig]) el.textContent = en ? DIC[orig] : orig;
    }
    if (el.placeholder){
      if (el.dataset.ptPh === undefined) el.dataset.ptPh = el.placeholder;
      var op = el.dataset.ptPh;
      if (DIC[op]) el.placeholder = en ? DIC[op] : op;
    }
  }
}

// Escreve num elemento um texto do dicionario, ja no idioma atual, e guarda
// o original. Use isto sempre que o JavaScript trocar um texto do HTML.
function setTextoDic(el, pt){
  if (!el) return;
  el.dataset.pt = pt;
  el.textContent = (idiomaAtual() === 'en' && DIC[pt]) ? DIC[pt] : pt;
}

function definirIdioma(lang){
  try { localStorage.setItem('mindt-lang', lang); } catch(e){}
  traduzirDOM();
  var b = document.getElementById('lang-btn');
  if (b) b.textContent = lang === 'pt' ? 'EN' : 'PT';
  document.querySelectorAll('[data-lang-opt]').forEach(function(el){
    el.classList.toggle('on', el.getAttribute('data-lang-opt') === lang);
  });
  // Textos escritos por T() nao passam pelo dicionario do HTML, entao
  // precisam ser reescritos por quem os gerou.
  if (typeof textosOnboarding === 'function') textosOnboarding();
  if (typeof renderHome === 'function' && document.getElementById('home-today-list')) renderHome();
}
function alternarIdioma(){ definirIdioma(idiomaAtual() === 'pt' ? 'en' : 'pt'); }
