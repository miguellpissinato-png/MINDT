// PERSISTENCE — salvamento e carregamento dos dados do usuario
// (Supabase com fallback em localStorage) e estado inicial de conta nova.
//
// Depende de: sb e state (config.js). O registro do onAuthStateChange
// permanece no index.html e vai para auth.js na proxima etapa.

// SAVE/LOAD
async function saveState(){
  // 1. Save to localStorage immediately (instant backup)
  try{localStorage.setItem('mindt-local',JSON.stringify(state));}catch(e){}
  // 2. Save to Supabase immediately (no debounce, no setTimeout)
  if(!currentUser)return;
  try{
    var res=await sb.from('user_data').upsert(
      {user_id:currentUser.id,data:state,updated_at:new Date().toISOString()},
      {onConflict:'user_id'}
    );
    if(res.error){console.error('Supabase save error:',res.error);}
  }catch(e){console.error('saveState exception:',e);}
}

async function loadUserData(){
  try{
    var res=await sb.from('user_data').select('data').eq('user_id',currentUser.id).single();
    if(res.data&&res.data.data){
      var p=res.data.data;
      if(p.metas)p.metas.forEach(function(m){m._type='meta';});
      if(p.tasks)p.tasks.forEach(function(t){t._type='task';});
      state=Object.assign({},state,p);
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
            return;
          }
        }
      }catch(e){}
      seedDemo();
    }else{
      // Network error — fall back to localStorage
      try{
        var local2=localStorage.getItem('mindt-local');
        if(local2){
          var lp2=JSON.parse(local2);
          if(lp2.metas)lp2.metas.forEach(function(m){m._type='meta';});
          if(lp2.tasks)lp2.tasks.forEach(function(t){t._type='task';});
          state=Object.assign({},state,lp2);
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
      }
    }catch(e3){}
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
