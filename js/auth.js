// AUTH — login, cadastro, logout e traducao das mensagens de erro.
//
// Depende de: sb (config.js), openModal/closeModal/resetConfirmBtn (helpers.js)
// e da variavel authMode (index.html). Contem apenas declaracoes de funcao —
// nada executa no carregamento.
//
// O registro do sb.auth.onAuthStateChange continua no index.html porque chama
// renderHome(); ele vem para ca quando o home.js for criado.

// AUTH
function switchAuthTab(mode){
  authMode=mode;
  var tl=document.getElementById('tab-login'),ts=document.getElementById('tab-signup');
  var btn=document.getElementById('auth-btn'),sub=document.getElementById('auth-subtitle');
  if(mode==='login'){tl.className='auth-tab active';ts.className='auth-tab inactive';btn.textContent='Entrar';sub.textContent='Organize sua vida';}
  else{ts.className='auth-tab active';tl.className='auth-tab inactive';btn.textContent='Criar conta';sub.textContent='Crie sua conta gratuita';}
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
          +'<div class="auth-confirm-text">Enviamos um link para <strong style="color:#AAC4F5">'+email+'</strong>.<br>Após confirmar, volte e faça login.</div>';
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
  if(m.indexOf('Invalid login')!==-1)return 'Email ou senha incorretos.';
  if(m.indexOf('Email not confirmed')!==-1)return 'Confirme seu email primeiro.';
  if(m.indexOf('User already registered')!==-1)return 'Email já cadastrado. Faça login.';
  if(m.indexOf('Password should be')!==-1)return 'Senha muito curta (mín. 6 caracteres).';
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
function montarOnboarding(){
  var el = document.getElementById('onboarding');
  if (!el) return;
  if (jaViuOnboarding()) { el.style.display = 'none'; return; }
  document.getElementById('onb-mascote').innerHTML = ticolino('animado', 250);
  document.getElementById('onb-title').textContent = T('onbTitle');
  document.getElementById('onb-sub').textContent   = T('onbSub');
  document.getElementById('onb-cta').textContent   = T('onbCta');
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
  ['auth-form-wrap','auth-reset-wrap','auth-newpass-wrap'].forEach(function(id){
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
