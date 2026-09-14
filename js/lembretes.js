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
// SE O PUSH FALHAR, SOBRA O E-MAIL
// Quem nao aceitou a permissao, ou esta num iPhone sem instalar, ainda recebe
// o lembrete por e-mail. Por isso ligar o lembrete grava a preferencia mesmo
// quando a permissao e negada: sem a linha na tabela, o servidor nao teria
// como saber que essa pessoa quer ser lembrada.

// A metade publica do par de chaves VAPID. Ela e publica por natureza — vai
// no navegador de todo mundo. A metade privada vive so nos segredos do
// Supabase, e e ela que assina cada envio.
var LEMBRETE_VAPID = 'BBeAZNU0M81fFgj1uaRW4Np_88rW0fXfU9nfbiVN0EL5GNtaIWe_jUWPfcfLdEsbiqoAkHvfz64eElgQHc45ieA';

var lembrete = {ativo:false, hora:8, canal:'nenhum'};

// ─── Leitura ───────────────────────────────────────────────────────────

async function carregarLembrete(){
  if(!currentUser) return;
  try{
    var res = await sb.from('lembretes')
      .select('ativo,hora').eq('user_id', currentUser.id).maybeSingle();
    if(res.data){ lembrete.ativo = !!res.data.ativo; lembrete.hora = res.data.hora; }
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
    toast('⚠️ Não consegui salvar. Tenta de novo?');
    return;
  }
  lembrete.ativo = true;

  var canal = await cadastrarAparelho();
  lembrete.canal = canal;
  if(caixa) caixa.removeAttribute('aria-busy');
  pintarLembrete();

  toast(canal === 'push'
    ? '🔔 Lembrete ligado! Vou te avisar às ' + pad(lembrete.hora) + ':00.'
    : '📧 Lembrete ligado! Como o aviso na tela não foi liberado, ele chega por e-mail.');
}

async function lembreteDesligar(){
  var salvou = await lembreteSalvar({ativo:false});
  if(!salvou){ toast('⚠️ Não consegui salvar. Tenta de novo?'); return; }
  lembrete.ativo = false;
  lembrete.canal = 'nenhum';
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

// Grava a linha da pessoa. O fuso vai junto porque e ele que diz que horas
// sao "8 da manha" para quem mora onde: o servidor guarda o nome da zona
// ('America/Sao_Paulo') e o Postgres resolve o horario de verao sozinho.
async function lembreteSalvar(campos){
  if(!currentUser) return false;
  var linha = Object.assign({
    user_id: currentUser.id,
    email: currentUser.email,
    fuso: fusoDoAparelho(),
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
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return 'email';
  if(typeof Notification === 'undefined') return 'email';

  try{
    var permissao = Notification.permission;
    if(permissao === 'default') permissao = await Notification.requestPermission();
    if(permissao !== 'granted') return 'email';

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
    if(!j.keys || !j.keys.p256dh || !j.keys.auth) return 'email';

    var res = await sb.from('lembrete_dispositivos').upsert({
      user_id: currentUser.id,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth
    }, {onConflict:'endpoint'});
    if(res.error) throw res.error;
    return 'push';
  }catch(e){
    console.error('cadastrarAparelho:', e);
    return 'email';
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

  var horas = document.getElementById('lembrete-hora');
  if(horas){
    horas.value = String(lembrete.hora);
    horas.disabled = !lembrete.ativo || !liberado;
  }
  var quando = document.getElementById('lembrete-quando');
  if(quando) quando.hidden = !lembrete.ativo;

  var nota = document.getElementById('lembrete-nota');
  if(nota){
    if(!liberado){
      nota.textContent = 'Os lembretes diários são do Ticolino Pro.';
    }else if(!lembrete.ativo){
      nota.textContent = 'Todo dia, no horário que você escolher, o Ticolino avisa o que '
        + 'vence hoje e o que falta fechar.';
    }else if(lembrete.canal === 'email'){
      nota.textContent = 'O aviso na tela não está liberado neste aparelho, então o lembrete '
        + 'chega por e-mail em ' + (currentUser ? currentUser.email : '') + '.';
    }else{
      nota.textContent = 'Você recebe o aviso neste aparelho. Se ele estiver desligado, o '
        + 'lembrete chega por e-mail.';
    }
  }

  var dica = document.getElementById('lembrete-ios');
  if(dica) dica.hidden = !(liberado && precisaInstalarNoiPhone());
}
