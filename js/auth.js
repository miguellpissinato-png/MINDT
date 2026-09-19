// AUTH — login, cadastro, logout e traducao das mensagens de erro.
//
// Depende de: sb (config.js), openModal/closeModal/resetConfirmBtn (helpers.js)
// e da variavel authMode (index.html). Contem apenas declaracoes de funcao —
// nada executa no carregamento.
//
// O registro do sb.auth.onAuthStateChange continua no index.html porque chama
// renderHome(); ele vem para ca quando o home.js for criado.

// ─── LEMBRAR DE MIM ────────────────────────────────────────────────────
//
// A preferencia em si mora em config.js, junto do armazem que o Supabase
// usa (lembrarLigado / MINDT_ARMAZEM). Aqui ficam as duas pontas que a
// pessoa toca: a caixa no login e a chave no Perfil.

// Nomes das chaves que o Supabase usa para o cracha: 'sb-<projeto>-auth-token'.
// Procuro pelo formato em vez de escrever o nome na mao — se o Supabase
// mudar a chave num dia, isto continua achando, e se nao achar nada o pior
// que acontece e sobrar uma chave velha numa gaveta.
function chavesDaSessao(armazem){
  var achadas = [];
  try {
    for (var i = 0; i < armazem.length; i++) {
      var k = armazem.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) achadas.push(k);
    }
  } catch(e){}
  return achadas;
}

// Troca a preferencia COM alguem ja logado.
//
// So virar a chave nao bastaria: o cracha ja esta gravado numa gaveta, e
// ficaria la. Por isso a sessao e reescrita depois da troca — setSession
// passa pelo armazem, que agora aponta para a gaveta nova — e so entao a
// gaveta antiga e limpa. Nessa ordem: se algo falhar no meio, o pior caso e
// o cracha existir nas duas, e nao em nenhuma.
async function definirLembrar(ligado){
  var antes = lembrarLigado();
  if (antes === ligado) return true;

  try {
    // A ORDEM AQUI E O CONSERTO DE UM ERRO QUE EU COMETI.
    //
    // Na primeira versao eu virava a chave e so depois lia a sessao. Mas
    // getSession() le PELO ARMAZEM, e o armazem ja estava apontando para a
    // gaveta nova — que esta vazia. Resultado: lia null, nao movia nada, e o
    // cracha ficava na gaveta antiga. Desligar "Lembrar de mim" nao desligava
    // coisa nenhuma. O teste pegou: depois de desligar, o cracha continuava
    // no localStorage.
    //
    // Entao: ler primeiro, com o armazem ainda apontando para a gaveta de
    // origem; virar a chave; regravar (cai na gaveta nova); limpar a antiga.
    var res = await sb.auth.getSession();
    var sessao = res && res.data && res.data.session;

    try { localStorage.setItem(LEMBRAR_CHAVE, ligado ? '1' : '0'); }
    catch(e){ return false; }     // sem storage nao ha o que lembrar

    if (sessao && sessao.access_token && sessao.refresh_token) {
      await sb.auth.setSession({
        access_token: sessao.access_token,
        refresh_token: sessao.refresh_token
      });
      // Limpa a gaveta de ONDE veio, nunca a de destino.
      var antiga = ligado ? sessionStorage : localStorage;
      chavesDaSessao(antiga).forEach(function(k){
        try { antiga.removeItem(k); } catch(e){}
      });
    }
    return true;
  } catch(e){
    console.error('definirLembrar:', e);
    // Desfaz a preferencia: a tela nao pode dizer uma coisa e o cracha estar
    // em outra.
    try { localStorage.setItem(LEMBRAR_CHAVE, antes ? '1' : '0'); } catch(e2){}
    return false;
  }
}

// A caixa da tela de login. Ela grava a preferencia na hora do clique, e
// nao no momento de entrar: assim o PRIMEIRO cracha ja nasce na gaveta
// certa, sem precisar ser movido depois.
function alternarLembrarLogin(){
  var cx = document.getElementById('auth-lembrar');
  if(!cx) return;
  var ligado = !cx.classList.contains('on');
  cx.classList.toggle('on', ligado);
  cx.setAttribute('aria-checked', String(ligado));
  try { localStorage.setItem(LEMBRAR_CHAVE, ligado ? '1' : '0'); } catch(e){}
}

function pintarLembrarLogin(){
  var cx = document.getElementById('auth-lembrar');
  if(!cx) return;
  var ligado = lembrarLigado();
  cx.classList.toggle('on', ligado);
  cx.setAttribute('aria-checked', String(ligado));
}

// A chave do Perfil. Aqui ha alguem logado, entao a troca precisa MOVER a
// sessao de gaveta — e isso pode falhar. Por isso a tela so muda depois de
// definirLembrar() dizer que deu certo.
async function lembrarAlternar(){
  var chave = document.getElementById('lembrar-chave');
  if(!chave) return;
  var querLigar = !lembrarLigado();
  chave.setAttribute('aria-busy', 'true');
  var ok = await definirLembrar(querLigar);
  chave.removeAttribute('aria-busy');
  if(!ok){ toast('⚠️ Não consegui salvar. Tenta de novo?'); pintarLembrar(); return; }
  pintarLembrar();
  toast(querLigar
    ? '🔒 Você vai continuar conectado neste aparelho.'
    : '🔓 Da próxima vez o Mindt vai pedir sua senha.');
}

function pintarLembrar(){
  var chave = document.getElementById('lembrar-chave');
  if(!chave) return;
  var ligado = lembrarLigado();
  chave.className = 'toggle-switch' + (ligado ? ' on' : '');
  chave.setAttribute('aria-checked', String(ligado));
  var estado = document.getElementById('lembrar-estado');
  if(estado) estado.textContent = ligado ? 'Ligado' : 'Desligado';
  var nota = document.getElementById('lembrar-nota');
  if(nota){
    nota.textContent = ligado
      ? 'Mantém você conectado neste aparelho, sem pedir a senha de novo ao abrir o Mindt.'
      : 'O Mindt vai pedir seu e-mail e senha toda vez que você abrir.';
  }
}

// Pinta o que a tela de login tem de proprio: o Ticolino no lugar do antigo
// selo "M" e o estado da caixa "Lembrar de mim".
document.addEventListener('DOMContentLoaded', function(){
  var av = document.getElementById('auth-avatar');
  if (av && typeof ticolino === 'function') av.innerHTML = ticolino('feliz', 46, true);
  pintarLembrarLogin();
  pintarLembrar();
});

// AUTH
function switchAuthTab(mode){
  authMode=mode;
  var tl=document.getElementById('tab-login'),ts=document.getElementById('tab-signup');
  var btn=document.getElementById('auth-btn'),sub=document.getElementById('auth-subtitle');
  if(mode==='login'){
    tl.className='auth-tab active';ts.className='auth-tab inactive';
    btn.textContent=T('btnLogin'); sub.textContent=T('subLogin');
  }else{
    ts.className='auth-tab active';tl.className='auth-tab inactive';
    btn.textContent=T('btnSignup'); sub.textContent=T('subSignup');
  }
  var f=document.getElementById('auth-forgot');
  if(f) f.style.display = (mode==='login') ? '' : 'none';
  setAuthError('');
}
function setAuthError(msg){var el=document.getElementById('auth-error');el.textContent=msg;el.style.display=msg?'block':'none';}
function setAuthLoading(on){document.getElementById('auth-btn').style.display=on?'none':'block';document.getElementById('auth-loading').style.display=on?'block':'none';}
function authSubmit(){
  var email=document.getElementById('auth-email').value.trim();
  var pass=document.getElementById('auth-password').value;
  setAuthError('');
  if(!email||!pass){setAuthError('Preencha email e senha.');return;}
  if(pass.length<6){setAuthError('Senha com no mínimo 6 caracteres.');return;}
  setAuthLoading(true);
  if(authMode==='signup'){
    sb.auth.signUp({email:email,password:pass}).then(function(res){
      if(res.error){setAuthError(authErr(res.error.message));setAuthLoading(false);return;}
      if(res.data.user&&!res.data.session){
        setAuthLoading(false);
        var w=document.getElementById('auth-form-wrap');w.innerHTML='';
        var d=document.createElement('div');d.className='auth-confirm';
        d.innerHTML='<div class="auth-confirm-icon">📧</div><div class="auth-confirm-title">Confirme seu email</div>'
          +'<div class="auth-confirm-text">Enviamos um link para <strong style="color:var(--accent-text)">'+email+'</strong>.<br>Após confirmar, volte e faça login.</div>';
        var b=document.createElement('button');b.className='auth-confirm-btn';b.textContent='Ir para login';
        b.onclick=function(){location.reload();};d.appendChild(b);w.appendChild(d);
      }
    });
  }else{
    sb.auth.signInWithPassword({email:email,password:pass}).then(function(res){
      if(res.error){setAuthError(authErr(res.error.message));setAuthLoading(false);}
    });
  }
}
function authErr(m){
  if(m.indexOf('Invalid login')!==-1)return T('errInvalid');
  if(m.indexOf('Email not confirmed')!==-1)return T('errUnconfirmed');
  if(m.indexOf('User already registered')!==-1)return T('errRegistered');
  if(m.indexOf('Password should be')!==-1)return T('errShort');
  return m;
}
function confirmLogout(){
  document.getElementById('confirm-icon').textContent='👋';
  document.getElementById('confirm-title').textContent='Sair da conta';
  document.getElementById('confirm-body').textContent='Tem certeza que deseja sair?';
  document.getElementById('confirm-ok-btn').textContent='Sair';
  document.getElementById('confirm-ok-btn').onclick=function(){closeModal('modal-confirm');sb.auth.signOut();resetConfirmBtn();};
  openModal('modal-confirm');
}

// ─── ONBOARDING — tela de boas-vindas na primeira visita ───
function jaViuOnboarding(){
  try { return localStorage.getItem('mindt-onboarded') === '1'; } catch(e){ return true; }
}
function fecharOnboarding(){
  try { localStorage.setItem('mindt-onboarded','1'); } catch(e){}
  var el = document.getElementById('onboarding');
  if (el) { el.style.opacity = '0'; setTimeout(function(){ el.style.display = 'none'; }, 280); }
}
// Escreve (ou reescreve) os textos do onboarding no idioma atual.
// Chamado tambem por definirIdioma, para a troca valer na hora.
function textosOnboarding(){
  var t = document.getElementById('onb-title');
  if (!t) return;
  document.getElementById('onb-mascote').innerHTML = ticolino('animado', 250);
  t.textContent = T('onbTitle');
  document.getElementById('onb-sub').textContent = T('onbSub');
  document.getElementById('onb-cta').textContent = T('onbCta');
}
function montarOnboarding(){
  var el = document.getElementById('onboarding');
  if (!el) return;
  if (jaViuOnboarding()) { el.style.display = 'none'; return; }
  textosOnboarding();
}

document.addEventListener('DOMContentLoaded', function(){
  definirIdioma(idiomaAtual());
  montarOnboarding();
  montarOlhos();
});

// ─── VER SENHA — o olhinho ao lado do campo ───────────────
var OLHO_ABERTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
var OLHO_FECHADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>';

function alternarVerSenha(idCampo, idBotao){
  var campo = document.getElementById(idCampo), botao = document.getElementById(idBotao);
  if (!campo || !botao) return;
  var mostrando = campo.type === 'text';
  campo.type = mostrando ? 'password' : 'text';
  botao.innerHTML = mostrando ? OLHO_ABERTO : OLHO_FECHADO;
  botao.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
  campo.focus();
}
// Desenha os olhinhos no estado inicial (senha oculta).
function montarOlhos(){
  ['auth-eye','new-eye','new-eye2'].forEach(function(id){
    var b = document.getElementById(id);
    if (b) b.innerHTML = OLHO_ABERTO;
  });
}

// ─── RECUPERAÇÃO DE SENHA ─────────────────────────────────
// Alterna entre as tres telas do cartao de login.
function mostrarEtapaAuth(qual){
  ['auth-form-wrap','auth-reset-wrap','auth-newpass-wrap','auth-falha'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = (id === qual) ? '' : 'none';
  });
  var abas = document.querySelector('.auth-tabs');
  if (abas) abas.style.display = (qual === 'auth-form-wrap') ? '' : 'none';
}
function abrirRecuperar(){
  setAuthError('');
  document.getElementById('reset-email').value = document.getElementById('auth-email').value.trim();
  document.getElementById('reset-error').style.display = 'none';
  mostrarEtapaAuth('auth-reset-wrap');
}
function voltarAoLogin(){ mostrarEtapaAuth('auth-form-wrap'); }

function setResetError(msg, ok){
  var el = document.getElementById('reset-error');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
  el.classList.toggle('ok', !!ok);
}

// Envia o email com o link de recuperação.
// O link volta para esta mesma pagina, onde o Supabase dispara PASSWORD_RECOVERY.
function enviarLinkRecuperacao(){
  var email = document.getElementById('reset-email').value.trim();
  setResetError('');
  if (!email) { setResetError('Digite seu email.'); return; }
  var btn = document.getElementById('reset-btn');
  btn.disabled = true; btn.textContent = 'Enviando...';
  var destino = location.origin + location.pathname;
  sb.auth.resetPasswordForEmail(email, { redirectTo: destino }).then(function(res){
    btn.disabled = false; btn.textContent = 'Enviar link';
    if (res.error) { setResetError(authErr(res.error.message)); return; }
    // Resposta sempre positiva: nao revelamos se o email existe ou nao.
    setResetError('Se existir uma conta com esse email, o link acabou de ser enviado. Confira sua caixa de entrada e o spam.', true);
  });
}

// ─── NOVA SENHA (apos clicar no link do email) ────────────
function abrirNovaSenha(){
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.visibility = 'hidden';
  var onb = document.getElementById('onboarding');
  if (onb) onb.style.display = 'none';
  mostrarEtapaAuth('auth-newpass-wrap');
}
function setNewPassError(msg){
  var el = document.getElementById('newpass-error');
  el.textContent = msg; el.style.display = msg ? 'block' : 'none';
}
function salvarNovaSenha(){
  var a = document.getElementById('new-password').value;
  var b = document.getElementById('new-password2').value;
  setNewPassError('');
  if (a.length < 6) { setNewPassError('Senha com no mínimo 6 caracteres.'); return; }
  if (a !== b)      { setNewPassError('As duas senhas não são iguais.'); return; }
  sb.auth.updateUser({ password: a }).then(function(res){
    if (res.error) { setNewPassError(authErr(res.error.message)); return; }
    // Limpa o token da URL para o link nao ser reutilizado ao recarregar.
    try { history.replaceState(null, '', location.pathname); } catch(e){}
    toast('Senha alterada! Entrando...');
    mostrarEtapaAuth('auth-form-wrap');
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.visibility = 'visible';
    if (typeof renderHome === 'function') renderHome();
  });
}


// ─── FALHA AO CARREGAR OS DADOS ──────────────────────────
// Antes, uma falha aqui abria o app vazio em silencio: o usuario concluiria
// que perdeu tudo, e a primeira alteracao gravaria por cima dos dados reais.
function mostrarFalhaDeCarga(err){
  var tela = document.getElementById('auth-screen');
  var caixa = document.getElementById('auth-falha');
  if (!tela || !caixa) return;
  document.getElementById('app').style.visibility = 'hidden';
  tela.style.display = 'flex';
  mostrarEtapaAuth('auth-falha');
  var det = document.getElementById('auth-falha-detalhe');
  if (det) det.textContent = (err && err.message) ? err.message : '';
}
function tentarCarregarDeNovo(){
  var btn = document.getElementById('auth-falha-btn');
  if (btn) { btn.disabled = true; btn.textContent = T('tentando'); }
  loadUserData().then(function(){
    if (typeof loadStudyXP === 'function') loadStudyXP();
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.visibility = 'visible';
    updateGroupSelects(); updateGroupFilters(); renderHome();
    mostrarEtapaAuth('auth-form-wrap');
  }).catch(function(e){
    console.error('nova tentativa falhou:', e);
    var det = document.getElementById('auth-falha-detalhe');
    if (det) det.textContent = (e && e.message) ? e.message : '';
  }).then(function(){
    if (btn) { btn.disabled = false; btn.textContent = T('tentarDeNovo'); }
  });
}
