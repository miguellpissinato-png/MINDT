// LEMBRETES — o lado do app: pedir permissao, cadastrar o aparelho e
// guardar a hora escolhida.
//
// O QUE ESTE ARQUIVO NAO FAZ
// Ele nao dispara o lembrete. Nao tem como: uma pagina da web nao consegue
// agendar nada para quando estiver fechada, que e justamente quando o
// lembrete importa. O que ele faz e dar ao servidor o que o servidor precisa
// para avisar — o endereco deste navegador e a hora que a pessoa escolheu.
// Quem avisa e a funcao enviar-lembretes no Supabase, acordada de hora em
// hora pelo pg_cron.
//
// O CAMINHO INTEIRO
//   1. A pessoa liga o lembrete aqui e o navegador pede a permissao dela.
//   2. O navegador devolve um endereco de push, que vai para a tabela
//      lembrete_dispositivos.
//   3. Na hora marcada, a funcao manda a mensagem para esse endereco.
//   4. O servico de push (Google, Apple, Mozilla) acorda o service worker,
//      que mostra o aviso — com o app fechado.
//
// IPHONE
// A Apple so entrega push para site que foi adicionado a tela de inicio.
// Aberto no Safari, nem a permissao aparece. Por isso a tela explica o passo
// antes de deixar a pessoa tentar e achar que quebrou.
//
// POR ONDE O AVISO CHEGA: A PESSOA ESCOLHE
// Tres canais: 'tela' (so a notificacao), 'email' (so o e-mail) e 'ambos'.
//
// Isto nasceu de um defeito. Antes o servidor mandava o push e so mandava
// e-mail se o push FALHASSE — e a tela dizia "se o aparelho estiver
// desligado, o lembrete chega por e-mail". A promessa era impossivel: o
// servico de push responde "aceitei" assim que recebe a mensagem, e um
// celular desligado nao e uma falha para ele. O servidor achava que tinha
// entregue, o e-mail nunca saia, e quem estava com o aparelho desligado
// ficava sem nada.
//
// O Web Push nao tem confirmacao de entrega. Nao ha como o servidor saber
// se a notificacao apareceu. Entao quem decide e quem conhece o proprio
// aparelho, e a tela diz a verdade sobre cada escolha.
//
// 'tela' ainda cai para o e-mail num caso: quando nao ha aparelho nenhum
// cadastrado (permissao negada, ou iPhone sem o app instalado). Sem isso a
// pessoa nao receberia NADA — pior do que receber por um canal que nao
// escolheu. Por isso ligar o lembrete grava a preferencia ANTES de pedir a
// permissao: sem a linha na tabela, o servidor nao saberia que ela quer ser
// lembrada.

// A metade publica do par de chaves VAPID. Ela e publica por natureza — vai
// no navegador de todo mundo, e e assim que o servico de push confere quem
// assinou a mensagem.
//
// A metade privada NUNCA existiu fora do Supabase: quem gerou o par foi a
// propria funcao enviar-lembretes, na primeira vez que rodou, e ela guardou
// as duas metades no cofre do projeto. Ninguem digitou, copiou nem colou a
// chave privada em lugar nenhum.
//
// Se um dia for preciso trocar o par, lembre que todo aparelho ja inscrito
// se inscreveu com a chave ANTIGA: trocar aqui sem apagar a tabela
// lembrete_dispositivos deixa os avisos falhando em silencio.
var LEMBRETE_VAPID = 'BHOdYW0MFoZGMFLNqE5umr-_7pT-DqXh3AVA35AK3NROmd34rtmGqJkwzSHW8kKP7J8pOalbAfjeLGU24P6hSXk';

var lembrete = {ativo:false, hora:8, canal:'tela', temAparelho:false};

// ─── Leitura ───────────────────────────────────────────────────────────

async function carregarLembrete(){
  if(!currentUser) return;
  try{
    var res = await sb.from('lembretes')
      .select('ativo,hora,canal').eq('user_id', currentUser.id).maybeSingle();
    if(res.data){
      lembrete.ativo = !!res.data.ativo;
      lembrete.hora = res.data.hora;
      lembrete.canal = res.data.canal || 'tela';
    }
  }catch(e){ console.error('carregarLembrete:', e); }
  pintarLembrete();
}

// ─── Ligar e desligar ──────────────────────────────────────────────────

async function lembreteAlternar(){
  if(!temRecurso('lembretes')){ mostrarLimite('lembretes'); return; }
  if(lembrete.ativo) return lembreteDesligar();
  return lembreteLigar();
}

async function lembreteLigar(){
  var caixa = document.getElementById('lembrete-bloco');
  if(caixa) caixa.setAttribute('aria-busy', 'true');

  // A preferencia e gravada ANTES de pedir a permissao. Se a pessoa negar o
  // aviso na tela — ou estiver num iPhone que nem pergunta — ela continua
  // querendo ser lembrada, e o e-mail cobre. Gravar so depois do "sim"
  // perderia justamente quem mais precisa da rede de baixo.
  var salvou = await lembreteSalvar({ativo:true, hora:lembrete.hora});
  if(!salvou){
    if(caixa) caixa.removeAttribute('aria-busy');
    toast('⚠️ Não deu para ligar o lembrete agora. Tente de novo em instantes.');
    return;
  }
  lembrete.ativo = true;

  lembrete.temAparelho = lembrete.canal === 'email' ? false : await cadastrarAparelho();
  if(caixa) caixa.removeAttribute('aria-busy');
  pintarLembrete();

  toast(mensagemDeLigado());
}

async function lembreteDesligar(){
  var salvou = await lembreteSalvar({ativo:false});
  if(!salvou){ toast('⚠️ Não deu para desligar o lembrete agora. Ele continua ligado.'); return; }
  lembrete.ativo = false;
  lembrete.temAparelho = false;
  await descadastrarAparelho();
  pintarLembrete();
  toast('Lembrete desligado.');
}

async function lembreteTrocarHora(valor){
  var h = parseInt(valor, 10);
  if(isNaN(h) || h < 0 || h > 23) return;
  lembrete.hora = h;
  if(!lembrete.ativo) { pintarLembrete(); return; }
  await lembreteSalvar({hora:h});
  pintarLembrete();
}

// Trocar de canal com o lembrete ligado pode precisar cadastrar o aparelho
// (quem vinha de 'email' nunca pediu a permissao) ou descadastrar (quem vai
// para 'email' nao deve continuar recebendo push).
async function lembreteTrocarCanal(qual){
  if(qual !== 'tela' && qual !== 'email' && qual !== 'ambos') return;
  if(qual === lembrete.canal) return;
  var antes = lembrete.canal;
  lembrete.canal = qual;
  pintarLembrete();
  if(!lembrete.ativo) return;

  if(!(await lembreteSalvar({canal:qual}))){
    lembrete.canal = antes; pintarLembrete();
    toast('⚠️ Não deu para trocar o canal do lembrete. Ele segue como estava.');
    return;
  }
  if(qual === 'email'){
    await descadastrarAparelho();
    lembrete.temAparelho = false;
  }else if(!lembrete.temAparelho){
    lembrete.temAparelho = await cadastrarAparelho();
  }
  pintarLembrete();
  toast(mensagemDeLigado());
}

function mensagemDeLigado(){
  var h = pad(lembrete.hora) + ':00';
  if(lembrete.canal === 'email') return '📧 Pronto! O lembrete chega por e-mail às ' + h + '.';
  if(lembrete.canal === 'ambos'){
    return lembrete.temAparelho
      ? '🔔 Pronto! Aviso na tela e e-mail, às ' + h + '.'
      : '📧 Pronto! Como o aviso na tela não foi liberado, só o e-mail vai chegar, às ' + h + '.';
  }
  return lembrete.temAparelho
    ? '🔔 Pronto! Aviso neste aparelho às ' + h + '.'
    : '📧 Aviso na tela não liberado neste aparelho — o lembrete vai por e-mail às ' + h + '.';
}

// Grava a linha da pessoa. O fuso vai junto porque e ele que diz que horas
// sao "8 da manha" para quem mora onde: o servidor guarda o nome da zona
// ('America/Sao_Paulo') e o Postgres resolve o horario de verao sozinho.
async function lembreteSalvar(campos){
  if(!currentUser) return false;
  var linha = Object.assign({
    user_id: currentUser.id,
    email: currentUser.email,
    fuso: fusoDoAparelho(),
    canal: lembrete.canal,
    atualizado_em: new Date().toISOString()
  }, campos);
  try{
    var res = await sb.from('lembretes').upsert(linha, {onConflict:'user_id'});
    if(res.error) throw res.error;
    return true;
  }catch(e){ console.error('lembreteSalvar:', e); return false; }
}

function fusoDoAparelho(){
  try{
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  }catch(e){ return 'America/Sao_Paulo'; }
}

// ─── O aparelho ────────────────────────────────────────────────────────

async function cadastrarAparelho(){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if(typeof Notification === 'undefined') return false;

  try{
    var permissao = Notification.permission;
    if(permissao === 'default') permissao = await Notification.requestPermission();
    if(permissao !== 'granted') return false;

    var reg = await navigator.serviceWorker.ready;
    var inscricao = await reg.pushManager.getSubscription();
    if(!inscricao){
      inscricao = await reg.pushManager.subscribe({
        // Sem isto o navegador recusa: ele exige que todo push mostre algo
        // na tela, e nao deixa o site receber mensagem em silencio.
        userVisibleOnly: true,
        applicationServerKey: base64ParaBytes(LEMBRETE_VAPID)
      });
    }
    var j = inscricao.toJSON();
    if(!j.keys || !j.keys.p256dh || !j.keys.auth) return false;

    var res = await sb.from('lembrete_dispositivos').upsert({
      user_id: currentUser.id,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth
    }, {onConflict:'endpoint'});
    if(res.error) throw res.error;
    return true;
  }catch(e){
    console.error('cadastrarAparelho:', e);
    return false;
  }
}

async function descadastrarAparelho(){
  try{
    if(!('serviceWorker' in navigator)) return;
    var reg = await navigator.serviceWorker.ready;
    var inscricao = await reg.pushManager.getSubscription();
    if(!inscricao) return;
    await sb.from('lembrete_dispositivos').delete().eq('endpoint', inscricao.endpoint);
    await inscricao.unsubscribe();
  }catch(e){ console.error('descadastrarAparelho:', e); }
}

// A chave VAPID viaja em base64url e o navegador quer bytes crus.
function base64ParaBytes(txt){
  var completo = (txt + '='.repeat((4 - txt.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  var cru = atob(completo), bytes = new Uint8Array(cru.length);
  for(var i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
}

// ─── A tela ────────────────────────────────────────────────────────────

// iPhone e iPad: a Apple so entrega push para app adicionado a tela de
// inicio. Saber disso antes evita a pessoa achar que o recurso quebrou.
function precisaInstalarNoiPhone(){
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
         || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !(window.navigator.standalone === true
               || window.matchMedia('(display-mode: standalone)').matches);
}

function pintarLembrete(){
  var bloco = document.getElementById('lembrete-bloco');
  if(!bloco) return;
  var liberado = (typeof temRecurso === 'function') && temRecurso('lembretes');

  var chave = document.getElementById('lembrete-chave');
  if(chave) chave.className = 'toggle-switch' + (lembrete.ativo ? ' on' : '');
  if(chave) chave.setAttribute('aria-checked', String(lembrete.ativo));

  var estado = document.getElementById('lembrete-estado');
  if(estado) estado.textContent = lembrete.ativo ? 'Ligado' : 'Desligado';

  var horas = document.getElementById('lembrete-hora');
  if(horas){
    horas.value = String(lembrete.hora);
    horas.disabled = !lembrete.ativo || !liberado;
  }
  var quando = document.getElementById('lembrete-quando');
  if(quando) quando.hidden = !lembrete.ativo;

  var botoes = document.querySelectorAll('#lembrete-canal button');
  for(var i = 0; i < botoes.length; i++){
    var qual = botoes[i].getAttribute('data-canal');
    botoes[i].classList.toggle('on', qual === lembrete.canal);
    botoes[i].setAttribute('aria-pressed', String(qual === lembrete.canal));
    botoes[i].disabled = !liberado;
  }

  var nota = document.getElementById('lembrete-nota');
  if(nota) nota.textContent = textoDoLembrete(liberado);

  // A ressalva de cada canal. Dizer aqui o que cada escolha NAO garante e o
  // que impede alguem de contar com um aviso que pode nao chegar.
  var aviso = document.getElementById('lembrete-aviso');
  if(aviso){
    var t = '';
    if(liberado && lembrete.ativo){
      if(lembrete.canal === 'tela'){
        t = 'O aviso na tela só aparece com o aparelho ligado e com internet. '
          + 'Se ele estiver desligado na hora, o lembrete não chega — escolha '
          + '"E-mail" ou "Os dois" se quiser garantia.';
      }else if(lembrete.canal === 'ambos'){
        t = 'Você recebe os dois todo dia em que houver algo a lembrar.';
      }
    }
    aviso.textContent = t;
    aviso.hidden = !t;
  }

  var dica = document.getElementById('lembrete-ios');
  if(dica) dica.hidden = !(liberado && lembrete.canal !== 'email' && precisaInstalarNoiPhone());
}

function textoDoLembrete(liberado){
  if(!liberado) return 'Os lembretes diários são do Ticolino Pro.';
  if(!lembrete.ativo){
    return 'Todo dia, no horário que você escolher, o Ticolino avisa o que vence hoje '
         + 'e o que falta fechar.';
  }
  var email = currentUser ? currentUser.email : 'seu e-mail';
  if(lembrete.canal === 'email') return 'O lembrete chega por e-mail em ' + email + '.';
  if(lembrete.canal === 'ambos') return 'O lembrete chega neste aparelho e por e-mail em ' + email + '.';
  if(!lembrete.temAparelho){
    return 'O aviso na tela não está liberado neste aparelho, então o lembrete vai por '
         + 'e-mail em ' + email + '.';
  }
  return 'O lembrete aparece neste aparelho.';
}
