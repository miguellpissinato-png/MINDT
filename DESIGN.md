---
name: Mindt
description: Organizador da vida pessoal em que cada dia dá para completar, com o Ticolino junto.
colors:
  brand-laranja: "#EB7D00"
  brand-copa: "#2C5745"
  brand-ink: "#2E2910"
  brand-ink-hi: "#F5A03D"
  action-shade: "#B85F00"
  accent-ink: "#9B5200"
  accent-soft: "#FBE3C4"
  page: "#F2EEDA"
  card: "#FBF8EC"
  card-muted: "#F5F1DF"
  line: "#E2DCC3"
  line-strong: "#D3CBAE"
  track: "#E6E0C6"
  control-line: "#958B66"
  ink: "#2E2910"
  ink-2: "#5A5333"
  danger: "#8C3420"
  nav: "#2E2910"
  nav-ink: "#CFC690"
  nav-active: "#F5A03D"
  area-tarefas: "#C56800"
  area-dinheiro: "#2C6B4C"
  area-metas: "#8A6714"
  area-leitura: "#A8412A"
  area-exercicio: "#5E6B33"
  area-estudos: "#2F6376"
  nozes: "#E3B341"
  page-escuro: "#12140E"
  card-escuro: "#1E251B"
  ink-escuro: "#EBE3A7"
  accent-escuro: "#6FB58C"
typography:
  hero:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  display:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  card-title:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  meta:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  check: "9px"
  control: "13px"
  result: "16px"
  card: "18px"
  card-lg: "20px"
  header: "30px"
  pill: "99px"
spacing:
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
components:
  button-primary:
    backgroundColor: "{colors.brand-laranja}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.control}"
    height: "50px"
    padding: "0 20px"
  button-header:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "50px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card-lg}"
    padding: "14px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-on:
    backgroundColor: "{colors.brand-ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
  app-header:
    backgroundColor: "{colors.brand-laranja}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.header}"
    padding: "14px 16px 20px"
  tab-bar:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.nav-ink}"
    height: "82px"
---

# Design System: Mindt

Este arquivo descreve o visual que está no código hoje (`styles/ds2.css`), a partir do Mindt Design System 2 (https://claude.ai/artifact/GiP7UkDSMwsyZn9qC4pt1p), Propostas D (claro) e E (escuro). Os tokens do topo são os do tema claro. No escuro, os mesmos nomes recebem outros valores em `:root:not([data-theme="light"])`.

## Overview

**Creative North Star: "O caderno de bolso do Ticolino"**

Toda tela abre com um cabeçalho de marca: um bloco cheio de cor (laranja no claro, verde copa no escuro) com os cantos de baixo arredondados, onde ficam o nome da tela, um número grande e o Ticolino. Abaixo dele, o conteúdo é calmo: papel creme, cartões com borda de 2px e texto em marrom-tinta. É uma interface de uso rápido, várias vezes ao dia, no celular, então a densidade é média e cada linha tem um alvo de toque grande.

O que dá personalidade não é enfeite, é a sensação de apertar. Botões, caixinhas, cartões de toque e linhas de atividade têm uma base sólida embaixo, e descem quando são tocados. A cor carrega assunto: cada área (Tarefas, Dinheiro, Metas, Leitura, Exercícios, Estudos) tem sua cor e não troca em lugar nenhum. O Ticolino aparece uma vez por tela e mostra o estado do dia, não decora.

**Key Characteristics:**
- Cabeçalho de marca em toda tela, com abas do grupo, número-herói e Ticolino.
- Conteúdo em creme e tinta, com cor só onde ela significa alguma coisa.
- Profundidade tátil: base sólida embaixo do que se toca.
- Uma família de letra (Poppins), números grandes com espaçamento negativo e algarismos tabulares.
- Claro e escuro com os mesmos componentes; só os tokens mudam.

## Colors

Uma marca forte no topo, um conteúdo neutro e quente, e seis cores de assunto.

### Primary
- **Laranja Mindt** (#EB7D00): fundo do cabeçalho e do botão principal no tema claro, barras de progresso e caixinha marcada. No escuro, o cabeçalho e a ação passam para o **Verde Copa** (#2C5745) e as barras para o **Verde Broto** (#6FB58C), porque o verde copa some sobre o preto em tamanhos pequenos.
- **Tinta de Marca** (#2E2910): os elementos escuros sobre o cabeçalho (botões do cabeçalho, aba ativa, pílulas), com texto creme (#FBF8EC). Destaques sobre esses elementos usam **Laranja Claro** (#F5A03D).
- **Laranja Queimado** (#9B5200): links e "+XP" escritos no conteúdo claro, onde o laranja puro não passa contraste.

### Neutral
- **Papel** (#F2EEDA): o fundo da página.
- **Cartão** (#FBF8EC) e **Cartão Feito** (#F5F1DF): superfícies; o segundo marca item já feito e áreas internas.
- **Linha** (#E2DCC3) e **Linha Forte** (#D3CBAE): bordas de 2px dos cartões e divisórias.
- **Trilho** (#E6E0C6): o fundo das barras e dos controles segmentados.
- **Tinta** (#2E2910) e **Tinta Suave** (#5A5333): texto principal e secundário.
- **Borda de Controle** (#958B66): a caixinha vazia, que precisa de 3:1 sobre o cartão.

### Cores de assunto
- **Tarefas e Agenda** (#C56800), **Dinheiro** (#2C6B4C), **Metas** (#8A6714), **Leitura** (#A8412A), **Exercícios** (#5E6B33), **Estudos** (#2F6376). Cada uma tem uma versão suave (fundo do ícone) e uma sólida (bloco com texto creme). Classes `a-<area>` definem `--a`, `--a-soft` e `--a-solid`.
- **Nozes** (#E3B341) e a chama da ofensiva usam cores próprias nos dois temas.

### Named Rules
**A Regra da Cor com Assunto.** A cor de uma área significa aquela área. Nunca use o verde do Dinheiro para "sucesso" genérico nem o vermelho da Leitura para erro; erro usa `danger` (#8C3420).

**A Regra do Token.** Nenhuma cor solta numa tela. Tudo passa por token, para o tema trocar sozinho.

## Typography

**Fonte:** Poppins (com system-ui, sans-serif), pesos 400, 500, 600 e 700.

**Character:** Uma família só, redonda e amigável, que fica séria nos números graças ao peso 700 e ao espaçamento negativo.

### Hierarchy
- **Hero** (700, 48px, 1.05, −0.04em): o número da tela no cabeçalho (R$ 489,74, 20%).
- **Display** (700, 40px, 1.05, −0.04em): "3 ativas", "2 pra hoje", o timer. Um número-herói por tela, sempre no cabeçalho.
- **Title** (700, 28px, 1.15): o nome da tela e a saudação.
- **Subtitle** (700, 22px): o destaque do cabeçalho (o livro atual, o nome no Perfil).
- **Section** (600, 17px) e **Card title** (600, 15px): títulos no conteúdo.
- **Body** (500, 15px): itens de lista. **Caption** (13px) em subtítulos e comentários; **Meta** (12px) em prazos e contagens.
- **Label** (700, 11px, 0.08em, caixa alta): só o rótulo de área ("LEITURA · +10 XP", "DINHEIRO · FEITO") e o título de grupo de lista. A faixa do cartão de resultado usa 10px.

### Named Rules
**A Regra do Número Brasileiro.** Valores no formato brasileiro e com algarismos tabulares (`font-variant-numeric: tabular-nums`): R$ 489,74 · 1.095 XP · 3 de 7 etapas. Quantidade pequena vira "2 de 4", não porcentagem.

## Layout

Celular primeiro, com tela de referência de 390px. Ordem fixa: cabeçalho de marca (`.md-hdr`), conteúdo (`.md-in`, margem lateral de 16px e 10px entre blocos) e a barra de abas fixa no rodapé (82px mais a área segura). A partir de 769px a barra vira um menu lateral escuro de 236px e o conteúdo vai até 1080px; em telas largas (960px+) algumas páginas usam duas colunas.

Navegação em cinco destinos: Hoje, Rotina (Tarefas, Agenda, Exercícios, Notas), Dinheiro, Evolução (Metas, Estudos, Leitura, Resumo) e Você (Perfil, Amizades). Dentro do grupo, as abas ficam no topo do cabeçalho. Números aparecem em grupos de 2 ou 3 colunas iguais.

## Elevation & Depth

Não há sombra difusa. A profundidade é tátil: uma base sólida, deslocada para baixo, embaixo do que se toca. Ao pressionar, o elemento desce o tamanho da base e ela some (90ms).

### Shadow Vocabulary
- **Base de ação** (`box-shadow: 0 4px 0 #B85F00`): botão principal.
- **Base de tinta** (`box-shadow: 0 4px 0 #000000`): botões do cabeçalho.
- **Base do check** (`box-shadow: 0 3px 0 #B85F00`): caixinha marcada.
- **Base de bloco** (`box-shadow: 0 4px 0 rgba(46,41,16,0.18)`): cartões de resultado e notas.
- **Borda de base** (`border-bottom-width: 5px` em `line`): cartões e linhas que se tocam.

### Named Rules
**A Regra do Tátil Só no Toque.** A base embaixo existe só no que se toca. Texto, rótulos e cartões de leitura ficam planos.

## Shapes

Cantos arredondados em escala fixa: check 9px, controle 13px (botões, quadrados de ícone, bloco de data), resultado 16px, cartão 18px, cartão grande 20px, cabeçalho 30px (só embaixo) e pílula 99px (barras, chips, abas). Bordas de cartão sempre com 2px. Barras de progresso têm um fio claro translúcido no topo da parte cheia, e o rótulo dentro da barra troca de cor onde ela está cheia.

## Components

### Buttons
- **Shape:** controle (13px).
- **Primary** (`.md-btn--primary`): ação, 50px de altura, texto 16px semibold, base de ação.
- **Header** (`.md-btn--header`): tinta de marca, 40px (46px quando só ícone), base de tinta.
- **Secondary** (`.md-btn--secondary`): cartão com borda de 2px e base em `line`.
- **Focus:** contorno sólido de 3px em tinta (creme-escuro dentro do cabeçalho), afastado 2px.

### Chips
- **Style:** pílula em cartão com borda; selecionado em tinta de marca com texto creme (`aria-pressed="true"`). Chips de filtro rolam de lado em vez de quebrar linha.

### Cards / Containers
- **Corner Style:** 18–20px.
- **Background:** cartão; item feito em cartão feito.
- **Border:** 2px em `line`; cartões de toque com 5px embaixo.
- **Internal Padding:** 14px.

### Inputs / Fields
- **Style:** cartão com borda de 2px e raio de 16px; rótulo em caixa alta pequena acima.
- **Focus:** borda em tinta. Pop-ups viram folha que sobe de baixo no celular.

### Navigation
- **Barra de abas:** fundo `nav`, ícones de traço em `nav-ink`, ativa em `nav-active` com pílula translúcida. A aba Você mostra o rosto do Ticolino.
- **Abas do grupo** (`.md-gt`): no topo do cabeçalho; ativa em tinta de marca.

### Signature: cabeçalho de marca (`.md-hdr`)
Bloco em `brand` com cantos de baixo de 30px. Ordem: abas do grupo, título, número-herói, subtítulo, Ticolino à direita e, por último, as ações. Variações reais: anel do dia (Hoje), anel do timer (Estudos), faixa da semana (Agenda e Exercícios), livro atual com barra (Leitura).

### Signature: linha de atividade (`.md-row`) e cartão de resultado (`.md-rc`)
A linha tem quadrado de ícone na cor da área, rótulo de área, título e a caixinha tátil. O cartão de resultado tem uma faixa colorida com o rótulo e o número embaixo, num miolo creme.

## Do's and Don'ts

### Do:
- **Do** começar toda tela com o cabeçalho de marca e um único número-herói.
- **Do** usar a cor da área para o ícone e o rótulo daquela área, e `accent` para barras de Tarefas.
- **Do** escrever em português do Brasil, frases curtas; botões começam com verbo ("Iniciar sessão", "Registrar leitura").
- **Do** mostrar recompensa como número (+10 XP, +50 nozes).
- **Do** usar o Ticolino uma vez por tela, com o humor da situação (focado no timer, lendo em Leitura, orgulhoso ao fechar algo).

### Don't:
- **Don't** usar emoji na interface; ícones são de traço (estilo Feather, 24×24). Chama e noz são os únicos preenchidos.
- **Don't** usar degradê, sombra difusa ou cartão com faixa colorida na lateral.
- **Don't** recolorir nem redesenhar o logo: a cabeça do Ticolino sobre laranja, igual nos dois temas.
- **Don't** mostrar função que não existe (missão em dupla, ranking da semana, conquistas, baú dos passos).
