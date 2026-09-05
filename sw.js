// SERVICE WORKER — faz o MINDT abrir sem internet.
//
// Guarda os arquivos do app (HTML, CSS, JS, icones) no celular.
// NAO guarda nada do Supabase: dados vem sempre da rede ou do localStorage,
// senao o app mostraria informacao velha achando que esta certa.
//
// Para publicar uma versao nova, mude o VERSAO abaixo. O app avisa o usuario
// e troca quando ele aceitar.

var VERSAO = 'mindt-v2';

var ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './js/config.js',
  './js/helpers.js',
  './js/i18n.js',
  './js/sync.js',
  './js/persistence.js',
  './js/auth.js',
  './js/nav.js',
  './js/home.js',
  './js/notas.js',
  './js/perfil.js',
  './js/metas.js',
  './js/tarefas.js',
  './js/agenda.js',
  './js/resumo.js',
  './js/gastos.js',
  './js/estudos.js',
  './js/leitura.js',
  './js/pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
  './icons/favicon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(VERSAO).then(function(c){
      // addAll falha inteiro se um arquivo faltar; guarda um por um para ser tolerante.
      return Promise.all(ARQUIVOS.map(function(u){
        return c.add(new Request(u, {cache:'reload'})).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(nomes){
      return Promise.all(nomes.filter(function(n){
        return n !== VERSAO && n.indexOf('mindt-') === 0;
      }).map(function(n){ return caches.delete(n); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// O app pede a troca imediata quando o usuario aceita a nova versao.
self.addEventListener('message', function(e){
  if (e.data === 'trocar-agora') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;                       // gravacoes nunca do cache
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase e fontes: direto na rede

  // Navegacao: tenta a rede primeiro para pegar atualizacoes; sem rede, usa o cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function(r){
        var copia = r.clone();
        caches.open(VERSAO).then(function(c){ c.put('./index.html', copia); });
        return r;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
      })
    );
    return;
  }

  // Arquivos do app: responde do cache (rapido) e atualiza por tras.
  e.respondWith(
    caches.match(req).then(function(cacheado){
      var rede = fetch(req).then(function(r){
        if (r && r.status === 200) {
          var copia = r.clone();
          caches.open(VERSAO).then(function(c){ c.put(req, copia); });
        }
        return r;
      }).catch(function(){ return cacheado; });
      return cacheado || rede;
    })
  );
});
