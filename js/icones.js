// ICONES DO MINDT — familia "Toca do Ticolino" (aprovada no quadro de
// design "Mindt — Icones", proposta 2).
//
// POR QUE ESTE ARQUIVO EXISTE
// Os icones antigos eram os do Feather/Lucide, o padrao de quase todo app
// feito com IA. Estes moram no mundo do Ticolino (toca, cafe, noz, broto,
// folha) e seguem tres regras:
//   - traco de 2px, pontas redondas, grade 24x24;
//   - preenchimento suave (a propria cor do traco a 16%);
//   - UM detalhe na cor de destaque (classe ic-a / ic-as).
//
// A cor de destaque vem do CSS (ds2.css), pela variavel --ico-acc: na barra
// e a cor da aba ativa; dentro do quadrado de uma area e a cor da area
// (cor e assunto, nao se mistura); num botao cheio e a cor do texto.
// O "voce" tem classes no rosto, nos olhos e nas listras: na barra ele
// ganha a cor do Ticolino que a pessoa escolheu.
//
// ico(nome) em helpers.js procura aqui primeiro. Os nomes antigos (home,
// gastos, perfil, halter, edit, trash) continuam valendo, como apelidos.

var ICONES_TOCA = {
  hoje: '<circle class="ic-a" cx="16.6" cy="7" r="2.8"/><path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2.5 19.6C4.2 13.8 7.7 11 12 11s7.8 2.8 9.5 8.6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.6 19.6v-1.3a2.4 2.4 0 0 1 4.8 0v1.3"/>',
  rotina: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4.6 10.2h11.2v4.2a5 5 0 0 1-5 5h-1.2a5 5 0 0 1-5-5z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15.8 11.6h1.3a2.5 2.5 0 0 1 0 5h-1.5"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.2 21.4h14.6"/><path fill="none" class="ic-as" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M7.8 8.2c-1.2-1.1-.2-2 .4-2.6.7-.7.6-1.6-.2-2.4M11.8 8.2c-1.2-1.1-.2-2 .4-2.6.7-.7.6-1.6-.2-2.4"/>',
  dinheiro: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6.6 9.4h10.8c-.1 5.4-2.6 9.6-5.4 10.8-2.8-1.2-5.3-5.4-5.4-10.8z"/><path class="ic-a" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M5.2 9.4c.2-3.4 3-5.6 6.8-5.6s6.6 2.2 6.8 5.6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3.8V2.3"/>',
  evolucao: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 14.6c-3.9.2-6.6-2-6.8-5.8 3.8-.2 6.6 1.9 6.8 5.8z"/><path class="ic-a" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 12.2c-.2-4.3 2.5-7.4 7-7.6.2 4.4-2.6 7.4-7 7.6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 20.8v-8.6M6.6 20.8h10.8"/>',
  voce: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5.2 9.6a2.4 2.4 0 1 1 3.4-3.2M18.8 9.6a2.4 2.4 0 1 0-3.4-3.2"/><path class="ic-rosto" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 14.2c0-3.9 3.4-6.9 7.5-6.9s7.5 3 7.5 6.9c0 3.5-3.4 5.8-7.5 5.8s-7.5-2.3-7.5-5.8z"/><circle class="ic-olho" fill="currentColor" cx="9.4" cy="13.4" r="1.1"/><circle class="ic-olho" fill="currentColor" cx="14.6" cy="13.4" r="1.1"/><ellipse class="ic-a" cx="7.5" cy="16" rx="1.3" ry=".9"/><ellipse class="ic-a" cx="16.5" cy="16" rx="1.3" ry=".9"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" class="ic-listra" d="M11.2 15.6h1.6"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4" class="ic-listra" d="M10.6 9.2v1.4M12 8.9v1.7M13.4 9.2v1.4"/>',
  tarefas: '<rect fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><path fill="none" class="ic-as" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M8.2 12.3l2.6 2.6 5-5.2"/>',
  agenda: '<rect fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" x="3.4" y="5.2" width="17.2" height="15.4" rx="3.6"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.4 9.8h17.2M8 3.2v3.8M16 3.2v3.8"/><circle class="ic-a" cx="15.4" cy="15.2" r="2"/>',
  quadro: '<rect fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" x="2.8" y="4" width="18.4" height="14.6" rx="2.6"/><rect fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" x="6" y="7.4" width="5" height="5" rx="1"/><rect class="ic-a" transform="rotate(8 15.5 11.9)" x="13" y="9.4" width="5" height="5" rx="1"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 18.6L5.6 21M17 18.6l1.4 2.4"/>',
  exercicios: '<rect class="ic-a" stroke="currentColor" stroke-width="2" stroke-linejoin="round" x="4.2" y="7" width="3.4" height="10" rx="1.4"/><rect class="ic-a" stroke="currentColor" stroke-width="2" stroke-linejoin="round" x="16.4" y="7" width="3.4" height="10" rx="1.4"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2.4 10v4M21.6 10v4M7.6 12h8.8"/>',
  notas: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 19C4.4 11 9.6 4.6 19.2 4.4c.4 9.4-5.6 15.2-14.2 14.6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.6 20.4 15 9"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.6 14.4h3.4M12 12v-2.8"/><circle class="ic-a" cx="3.8" cy="20.2" r="1.3"/>',
  metas: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2.5 20.6c2.4-4.2 5.6-6.4 9.5-6.4s7.1 2.2 9.5 6.4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 14.2V3.4"/><path class="ic-a" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3.8h6.6l-1.7 2.7 1.7 2.7H12z"/>',
  estudos: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 19.5V4.8A1.8 1.8 0 0 1 6.8 3h12.2v15.2H6.8A1.8 1.8 0 0 0 5 20a1.8 1.8 0 0 0 1.8 1.6h12.2v-3.4"/><path class="ic-a" d="M13.6 3v6.4l1.9-1.5 1.9 1.5V3z"/>',
  leitura: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2.8 6.2c3.2-.9 6.3-.4 9.2 1.6 2.9-2 6-2.5 9.2-1.6v12.4c-3.2-.9-6.3-.4-9.2 1.6-2.9-2-6-2.5-9.2-1.6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 7.8v12"/><path class="ic-a" d="M15 7v5.4l1.5-1.2 1.5 1.2V6.2z"/>',
  adicionar: '<circle fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" cx="12" cy="12" r="8.8"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 8v8M8 12h8"/>',
  concluir: '<circle fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" cx="12" cy="12" r="8.8"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 12.4l2.8 2.8 5.2-5.6"/>',
  editar: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14.8 4.6l4.6 4.6L9.4 19.2H4.8v-4.6z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12.6 6.8l4.6 4.6"/>',
  apagar: '<path fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5.6 7.6h12.8l-1 11.6a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3.6 7.6h16.8M9.4 7.6V4.6a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v3M10.2 11.4v5.6M13.8 11.4v5.6"/>',
  resumo: '<rect fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" x="3.4" y="12.4" width="4.4" height="8.2" rx="1.4"/><rect fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" x="9.8" y="8.4" width="4.4" height="12.2" rx="1.4"/><rect class="ic-a" stroke="currentColor" stroke-width="2" stroke-linejoin="round" x="16.2" y="3.8" width="4.4" height="16.8" rx="1.4"/>'
};

// Nomes que o app ja usava antes, apontando para o desenho novo.
var ICONES_APELIDOS = { home: 'hoje', gastos: 'dinheiro', perfil: 'voce', halter: 'exercicios', edit: 'editar', trash: 'apagar' };

// O SVG de um icone da familia, ou '' se o nome nao for dela. O grupo de
// fora zera fill e stroke: assim o CSS antigo que pinta ".md-ico" so de
// contorno nao vaza para dentro do desenho.
function icoToca(nome, tam, classe){
  var d = ICONES_TOCA[ICONES_APELIDOS[nome] || nome];
  if(!d) return '';
  tam = tam || 20;
  return '<svg class="md-ico md-ico--toca' + (classe ? ' ' + classe : '') + '" viewBox="0 0 24 24" width="' + tam + '" height="' + tam + '" aria-hidden="true">'
    + '<g fill="none" stroke="none">' + d + '</g></svg>';
}
