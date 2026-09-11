// LISTA DE ESPERA — o que acontece quando alguem deixa o e-mail aqui.
//
// A pagina e estatica (GitHub Pages), entao ela sozinha nao sabe guardar nem
// enviar nada. Quem faz isso e a funcao `boas-vindas` no Supabase: ela grava
// o endereco na tabela `leads` e dispara o e-mail de apresentacao.
//
// Se a funcao estiver fora do ar, o endereco NAO se perde em silencio: a
// pagina avisa a pessoa que deu errado e pede para tentar de novo.

var LISTA_ENDPOINT =
  'https://eyhttiumvnhksbbjhhzt.supabase.co/functions/v1/boas-vindas';

(function(){
  var form   = document.getElementById('form-lista');
  var campo  = document.getElementById('campo-email');
  var botao  = document.getElementById('botao-entrar');
  var recado = document.getElementById('recado');
  var bloco  = document.getElementById('formulario');
  var pronto = document.getElementById('pronto');
  if (!form) return;

  function avisar(texto){
    recado.textContent = texto;
    recado.hidden = !texto;
  }

  // Validacao de e-mail e sempre aproximada; o que importa e barrar o erro
  // de digitacao obvio. Quem decide se o endereco existe e a entrega.
  function pareceEmail(v){
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var email = (campo.value || '').trim();

    if (!pareceEmail(email)) {
      avisar('Esse e-mail parece incompleto. Confere pra mim?');
      campo.focus();
      return;
    }

    avisar('');
    botao.disabled = true;
    botao.textContent = 'Enviando…';

    fetch(LISTA_ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: email, origem: origem() })
    })
    .then(function(r){
      return r.json().catch(function(){ return {}; })
        .then(function(dados){ return { ok:r.ok, dados:dados }; });
    })
    .then(function(res){
      if (!res.ok) throw new Error(res.dados.erro || 'falhou');
      // O endereco ficou guardado. Se o envio ainda nao esta ligado, o
      // recado muda: prometer uma caixa de entrada que nao vai receber nada
      // seria pior do que dizer a verdade.
      if (res.dados.enviado === false) {
        document.getElementById('pronto-titulo').textContent = 'Anotado!';
        document.getElementById('pronto-recado').textContent =
          'Te aviso por e-mail assim que o Mindt abrir. Obrigado por entrar na lista!';
      }
      bloco.hidden = true;
      pronto.hidden = false;
      pronto.setAttribute('tabindex','-1');
      pronto.focus();
    })
    .catch(function(){
      botao.disabled = false;
      botao.textContent = 'Quero conhecer o Mindt';
      avisar('Não consegui enviar agora. Tenta de novo em instantes?');
    });
  });

  // De onde a pessoa veio, quando a rede social passa a informacao. Serve so
  // para saber qual post trouxe gente; nao identifica ninguem.
  function origem(){
    try {
      var p = new URLSearchParams(location.search);
      return (p.get('de') || p.get('utm_source') || '').slice(0,40);
    } catch(e){ return ''; }
  }
})();
