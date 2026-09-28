// PWA — registro do service worker, aviso de nova versao e botao de instalar.

var swRegistro = null;

function registrarServiceWorker(){
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(function(reg){
    swRegistro = reg;
    // Se ja existe uma versao nova esperando, avisa.
    if (reg.waiting) avisarNovaVersao();
    reg.addEventListener('updatefound', function(){
      var novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', function(){
        // Só é atualizacao se ja havia um controlador antes; na 1a visita, nao.
        if (novo.state === 'installed' && navigator.serviceWorker.controller) avisarNovaVersao();
      });
    });
    // O navegador so reconfere o sw.js por conta propria de tempos em tempos.
    // Sem pedir explicitamente, uma versao nova podia demorar horas para ser
    // notada: a navegacao ja trazia o index.html novo da rede, mas o CSS e o
    // JS continuavam vindo do cache antigo — o app parecia nao ter mudado.
    reg.update().catch(function(){});

    // E reconfere sempre que a aba volta ao primeiro plano, no maximo uma vez
    // a cada 30s para nao pesar.
    var ultimaChecagem = Date.now();
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - ultimaChecagem < 30000) return;
      ultimaChecagem = Date.now();
      reg.update().catch(function(){});
    });
  }).catch(function(e){ console.warn('service worker nao registrou:', e); });

  // Quando o worker novo assume, recarrega uma vez para o app ficar consistente.
  var recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if (recarregou) return;
    recarregou = true;
    location.reload();
  });
}

function avisarNovaVersao(){
  var barra = document.getElementById('aviso-versao');
  if (barra) { barra.style.display = 'flex'; return; }
  barra = document.createElement('div');
  barra.id = 'aviso-versao';
  barra.innerHTML = '<span>' + T('novaVersao') + '</span>' +
    '<button onclick="aplicarNovaVersao()">' + T('atualizar') + '</button>';
  document.body.appendChild(barra);
}
function aplicarNovaVersao(){
  if (swRegistro && swRegistro.waiting) swRegistro.waiting.postMessage('trocar-agora');
  else location.reload();
}

// ─── Botao de instalar ───────────────────────────────────
// O navegador dispara beforeinstallprompt quando o app e instalavel.
// Guardamos o evento para abrir o convite quando o usuario clicar.
var conviteInstalar = null;

window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  conviteInstalar = e;
  mostrarBotaoInstalar(true);
});
window.addEventListener('appinstalled', function(){
  conviteInstalar = null;
  mostrarBotaoInstalar(false);
});

// O convite fica so na Home (nas outras paginas ele cobria o conteudo, ate
// o botao de ativar as Amizades) e some por 14 dias no "x".
var INSTALAR_PAUSA = 14 * 24 * 3600 * 1000;
function instalarDispensado(){
  try { return Date.now() - (parseInt(localStorage.getItem('mindt-instalar-fechado'), 10) || 0) < INSTALAR_PAUSA; }
  catch(e){ return false; }
}
function dispensarInstalar(){
  try { localStorage.setItem('mindt-instalar-fechado', String(Date.now())); } catch(e){}
  mostrarBotaoInstalar(false);
}
function mostrarBotaoInstalar(mostrar){
  var b = document.getElementById('btn-instalar'), w = document.getElementById('instalar-wrap');
  if (!b || !w) return;
  b.textContent = '\u2b07\ufe0f  ' + T('instalar');
  w.style.display = (mostrar && !instalarDispensado()) ? '' : 'none';
}
function instalarApp(){
  if (!conviteInstalar) return;
  conviteInstalar.prompt();
  conviteInstalar.userChoice.then(function(r){
    if (r.outcome === 'accepted') mostrarBotaoInstalar(false);
    conviteInstalar = null;
  });
}
// Se ja esta rodando instalado, nao ha o que oferecer.
function jaInstalado(){
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

document.addEventListener('DOMContentLoaded', function(){
  avisarEscuroForcado();
  if (jaInstalado()) mostrarBotaoInstalar(false);
  registrarServiceWorker();
});

// ─── Modo escuro forcado do navegador ───────────────────
// O Samsung Internet (e o Chrome com "escurecer sites") repinta paginas por
// conta propria, mesmo as que ja tem tema escuro: o fundo vira preto, as
// cores desbotam e o Ticolino perde os olhos. A pagina nao tem como
// desligar isso em todos os casos, entao avisamos uma vez como resolver.
function avisarEscuroForcado(){
  try {
    if (!/SamsungBrowser/i.test(navigator.userAgent)) return;
    if (!window.matchMedia || !matchMedia('(prefers-color-scheme: dark)').matches) return;
    if (localStorage.getItem('mindt-aviso-escuro')) return;
  } catch(e){ return; }
  var el = document.createElement('div');
  el.id = 'aviso-escuro';
  el.setAttribute('role', 'status');
  el.innerHTML = '<p><b>As cores estão estranhas?</b> O modo escuro do navegador Samsung repinta o Mindt por cima. '
    + 'Para ver as cores certas: toque no menu <b>☰</b> do navegador e desligue <b>Modo escuro</b>. '
    + 'O Mindt já tem tema escuro próprio, em Perfil → Tema.</p>'
    + '<button type="button">Entendi</button>';
  el.querySelector('button').onclick = function(){
    try { localStorage.setItem('mindt-aviso-escuro', '1'); } catch(e){}
    el.remove();
  };
  document.body.appendChild(el);
}
