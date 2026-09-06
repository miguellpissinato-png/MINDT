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

function mostrarBotaoInstalar(mostrar){
  var b = document.getElementById('btn-instalar');
  if (!b) return;
  b.textContent = '\u2b07\ufe0f  ' + T('instalar');
  b.style.display = mostrar ? '' : 'none';
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
  registrarServiceWorker();
  if (jaInstalado()) mostrarBotaoInstalar(false);
});
