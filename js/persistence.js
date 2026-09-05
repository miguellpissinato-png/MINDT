// PERSISTENCE — salvamento e carregamento dos dados do usuario
// (Supabase com fallback em localStorage) e estado inicial de conta nova.
//
// Depende de: sb e state (config.js). O registro do onAuthStateChange
// permanece no index.html e vai para auth.js na proxima etapa.

// SAVE/LOAD
// saveState() e chamado em 41 pontos do app. A logica de verdade vive em
// sync.js: guarda de versao, marcacao do que mudou e mesclagem no conflito.
// Aqui ficou so a porta de entrada, para nao mexer nos 41 pontos.
async function saveState(){
  return gravar();
}

async function loadUserData(){
  // Marca se realmente conseguimos dados de alguma origem. Sem isso a funcao
  // terminava igual quando carregava e quando falhava, e quem chamava nao
  // tinha como saber a diferenca — o app abria vazio como se estivesse certo.
  var recuperado = false;
  try{
    var res=await sb.from('user_data').select('data,updated_at').eq('user_id',currentUser.id).single();
    if(res.data&&res.data.data){
      var p=res.data.data;
      if(p.metas)p.metas.forEach(function(m){m._type='meta';});
      if(p.tasks)p.tasks.forEach(function(t){t._type='task';});
      state=Object.assign({},state,p);
      // Guarda a versao vista e a sombra: base para detectar conflito depois.
      revLocal=res.data.updated_at||null; guardarRev(); fixarSombra();
      recuperado = true;
    }else if(res.error&&(res.error.code==='PGRST116'||res.error.details==='The result contains 0 rows')){
      // Brand new user
      try{
        var local=localStorage.getItem('mindt-local');
        if(local){
          var lp=JSON.parse(local);
          if(lp.metas&&lp.metas.length>0){
            if(lp.metas)lp.metas.forEach(function(m){m._type='meta';});
            if(lp.tasks)lp.tasks.forEach(function(t){t._type='task';});
            state=Object.assign({},state,lp);
            await saveState();
            return;   // conta nova com backup local: recuperado
          }
        }
      }catch(e){}
      seedDemo();          // conta nova de verdade: vazia por direito
      recuperado = true;
    }else{
      // Network error — fall back to localStorage
      try{
        var local2=localStorage.getItem('mindt-local');
        if(local2){
          var lp2=JSON.parse(local2);
          if(lp2.metas)lp2.metas.forEach(function(m){m._type='meta';});
          if(lp2.tasks)lp2.tasks.forEach(function(t){t._type='task';});
          state=Object.assign({},state,lp2);
          recuperado = true;   // servidor falhou, mas o backup local serviu
        }
      }catch(e2){}
    }
  }catch(err){
    // Any unexpected error — try localStorage
    console.error('loadUserData caught:', err);
    try{
      var local3=localStorage.getItem('mindt-local');
      if(local3){
        var lp3=JSON.parse(local3);
        if(lp3.metas)lp3.metas.forEach(function(m){m._type='meta';});
        if(lp3.tasks)lp3.tasks.forEach(function(t){t._type='task';});
        state=Object.assign({},state,lp3);
        recuperado = true;
      }
    }catch(e3){}
  }

  // Servidor fora do ar E sem backup local: nao ha o que mostrar. Avisar quem
  // chamou, para nunca abrir o app vazio — o usuario concluiria que perdeu
  // tudo, e a primeira alteracao gravaria por cima dos dados de verdade.
  if(!recuperado){
    var e = new Error('sem-dados');
    e.semDados = true;
    throw e;
  }
  if(!state.perfil)state.perfil={name:'',avatar:null};
  if(!state.perfil.name)state.perfil.name=currentUser.email.split('@')[0];
}

// SEED
function seedDemo(){
  // Only runs once for brand new users — data is immediately saved to Supabase
  state.grupos=[];
  state.metas=[];
  state.tasks=[];
  state.notas=[];
  state.perfil={name:'',avatar:null};
  saveState();
}


// Ao fechar a pagina, guarda o backup local.
//
// Aqui havia um navigator.sendBeacon para o Supabase, que nunca funcionou:
// sendBeacon nao permite enviar cabecalhos, e sem a chave de API o Supabase
// recusa a requisicao. Era um salvamento que so parecia existir. O backup em
// localStorage abaixo funciona de verdade, e a sincronizacao acontece na
// proxima abertura ou quando a conexao voltar.
window.addEventListener('beforeunload', function(){
  if (currentUser && state) {
    try { marcarMudancas(); } catch(e){}
    guardarLocal();
  }
});
