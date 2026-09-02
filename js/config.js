// CONFIG — Supabase client e estado global do app
var SUPA_URL='https://eyhttiumvnhksbbjhhzt.supabase.co';
var SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5aHR0aXVtdm5oa3NiYmpoaHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTA2MzUsImV4cCI6MjA5OTI4NjYzNX0.KVGNxihHSBA2aU-iv4kCC3wBy-abNxzdOLN4UhX6AjM';
var sb=window.supabase.createClient(SUPA_URL,SUPA_KEY);
var state={metas:[],tasks:[],notas:[],grupos:[],perfil:{name:'',avatar:null},gastos:[],categorias:[],livros:[],eventos:[],contatos:[]};


var currentUser=null,saveTimer=null,authMode='login';
var currentDetailType=null,currentDetailId=null,currentNotaId=null;
var deleteMode={type:null,selected:[]},editMode={type:null};
