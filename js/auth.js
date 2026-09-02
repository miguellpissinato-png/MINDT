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
          +'<div class="auth-confirm-text">Enviamos um link para <strong style="color:#7a45d4">'+email+'</strong>.<br>Após confirmar, volte e faça login.</div>';
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
