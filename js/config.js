// CONFIG — Supabase client e estado global do app
var SUPA_URL='https://eyhttiumvnhksbbjhhzt.supabase.co';
var SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5aHR0aXVtdm5oa3NiYmpoaHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTA2MzUsImV4cCI6MjA5OTI4NjYzNX0.KVGNxihHSBA2aU-iv4kCC3wBy-abNxzdOLN4UhX6AjM';
// ─── ONDE A SESSAO FICA GUARDADA ──────────────────────────────────────
//
// "Lembrar de mim" e isto: em qual gaveta do navegador o cracha de acesso
// e guardado.
//
//   ligado   → localStorage    sobrevive a fechar o app. E o padrao, e era
//                              o unico comportamento que existia.
//   desligado→ sessionStorage  morre junto com a aba. Ao reabrir o Mindt,
//                              pede a senha de novo.
//
// O Supabase aceita um armazem proprio, entao nao ha nada a inventar: e o
// mesmo cliente de sempre, so que perguntando a preferencia antes de cada
// leitura e escrita. Nenhuma outra parte do app precisa saber disso.
//
// Sem preferencia gravada = ligado. Quem ja estava logado antes desta
// mudanca continua logado, que e o que tem que acontecer.
var LEMBRAR_CHAVE = 'mindt-lembrar';

function lembrarLigado(){
  try { return localStorage.getItem(LEMBRAR_CHAVE) !== '0'; }
  catch(e){ return true; }   // navegador sem storage: nao atrapalha o login
}

// Cada chamada decide a gaveta na hora. Guardar a referencia uma vez so
// faria a troca de preferencia nao valer ate recarregar a pagina.
var MINDT_ARMAZEM = {
  getItem: function(k){
    try { return (lembrarLigado() ? localStorage : sessionStorage).getItem(k); }
    catch(e){ return null; }
  },
  setItem: function(k, v){
    try { (lembrarLigado() ? localStorage : sessionStorage).setItem(k, v); }
    catch(e){}
  },
  // Apaga nas duas: sair da conta tem que limpar tudo, venha de onde vier.
  removeItem: function(k){
    try { localStorage.removeItem(k); } catch(e){}
    try { sessionStorage.removeItem(k); } catch(e){}
  }
};

var sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    storage: MINDT_ARMAZEM,
    persistSession: true,
    autoRefreshToken: true,
    // Continua ligado: e ele que le o link de recuperacao de senha que chega
    // por e-mail e abre a tela de "criar nova senha".
    detectSessionInUrl: true
  }
});
var state={metas:[],tasks:[],notas:[],grupos:[],perfil:{name:'',avatar:null},gastos:[],categorias:[],livros:[],eventos:[],contatos:[],ganhos:[],instituicoes:[],ganhosPulados:{}};


var currentUser=null,saveTimer=null,authMode='login';
var currentDetailType=null,currentDetailId=null,currentNotaId=null;
var deleteMode={type:null,selected:[]},editMode={type:null};
