# Plano de Modularização — index.html → estrutura de arquivos

Este documento complementa o `CLAUDE.md`. Ele detalha **como** dividir o monólito
atual em arquivos organizados, **sem quebrar nada que já funciona**.

Este é um documento de planejamento. Nenhum passo aqui está autorizado para
execução automática — siga a regra de autorização do `CLAUDE.md`: confirme com
o fundador antes de começar cada etapa.

---

## 1. Uma restrição técnica importante (leia antes de tudo)

O HTML atual chama funções JavaScript direto nos elementos, assim:

```html
<button onclick="openModal('modal-add-meta')">+ Adicionar</button>
```

Isso só funciona porque hoje toda função (`openModal`, `saveTask`, `renderNotas`, etc.)
é **global** — vive diretamente no `window` do navegador.

Isso importa porque existem duas formas diferentes de organizar JavaScript em
arquivos, e elas têm consequências bem diferentes:

| Abordagem | O que é | Efeito nos `onclick="..."` do HTML |
|---|---|---|
| **Múltiplos `<script src="...">` comuns** | Só divide o código em arquivos separados, mas cada função continua caindo no escopo global, do mesmo jeito que hoje | Continuam funcionando sem nenhuma mudança |
| **Módulos ES (`<script type="module">`)** | Padrão mais moderno, cada arquivo tem seu próprio escopo isolado | **Quebram todos** — seria necessário reescrever todos os `onclick="..."` do HTML para `addEventListener`, uma mudança grande e arriscada |

**Recomendação:** fazer a modularização em duas fases separadas, não uma só.

- **Fase 1 (este plano):** dividir em arquivos usando `<script>` comum. Zero risco
  de quebrar comportamento, ganho grande de organização.
- **Fase 2 (decisão futura, separada):** se um dia quisermos usar um bundler
  (Vite, por exemplo) e módulos ES de verdade — o que traria benefícios reais
  como checagem de dependências e preparação para um framework — isso exige
  reescrever a forma como o HTML chama as funções. É uma mudança de arquitetura
  maior, que deve ser discutida e autorizada separadamente, não incluída aqui.

---

## 2. Estrutura de arquivos proposta (Fase 1)

```
/index.html            → só a marcação HTML + tags <link> e <script>, sem lógica
/styles/
  main.css              → todo o CSS que hoje está no <style> do index.html
/js/
  config.js             → SUPA_URL, SUPA_KEY, criação do client `sb`, variável global `state`
  helpers.js             → esc(), formatDate(), uid(), toast(), openModal/closeModal, canvas de fundo
  auth.js                → login, signup, logout, authSubmit, authErr
  persistence.js          → saveState(), loadUserData(), seedDemo()
  nav.js                  → troca de páginas (desktop e mobile), sidebar
  home.js
  metas.js
  tarefas.js
  gastos.js               → inclui parcelas e juros
  agenda.js
  resumo.js
  estudos.js               → pomodoro + sistema de XP
  leitura.js               → estante de livros
  notas.js
  perfil.js
```

Cada arquivo `.js` recebe as funções que já existem hoje, apenas movidas —
**sem reescrever a lógica interna** nesta fase. É uma reorganização, não uma
reescrita.

---

## 3. Mapeamento: seções atuais do código → arquivo novo

Baseado nos comentários que já existem no código atual:

| Comentário no código atual | Vai para |
|---|---|
| `// AUTH` | `auth.js` |
| `// SAVE/LOAD` | `persistence.js` |
| `// QUOTES` | `home.js` |
| `// NAV` | `nav.js` |
| `// HOME` | `home.js` |
| `// METAS` | `metas.js` |
| `// TASKS` | `tarefas.js` |
| `// DETAIL` | junto do módulo correspondente (tarefas/metas) |
| `// SAVE ITEMS` | junto do módulo correspondente |
| `// GASTOS` | `gastos.js` |
| `// NOTAS` | `notas.js` |
| `// RESUMO` | `resumo.js` |
| `// PERFIL` | `perfil.js` |
| `// SELECTION`, `// CHECKLIST`, `// GROUPS`, `// PERIOD STATS` | `helpers.js` (são usados por vários módulos) |
| `// CALENDAR` | `agenda.js` |
| `// MODALS`, `// IMAGE`, `// FORM POPULATION`, `// HELPERS` | `helpers.js` |
| `// ESTUDOS` | `estudos.js` |
| `// SEED` | `persistence.js` |
| `// BACKGROUND` | `helpers.js` |

Funções relacionadas a livros/estante (mencionadas nas seções de leitura) → `leitura.js`.

---

## 4. Ordem de migração recomendada (do mais seguro ao mais arriscado)

A ideia é migrar **um pedaço por vez**, testando o app inteiro depois de cada
passo, começando pelo que tem menos dependência de outras partes.

1. **CSS → `styles/main.css`** (risco zero, é só visual, não afeta lógica).
2. **`config.js`** — precisa vir primeiro entre os JS porque todo o resto depende
   das variáveis `sb` e `state`.
3. **`helpers.js`** — funções puras usadas por quase tudo (`esc`, `formatDate`, `uid`, `toast`, modais).
4. **`persistence.js`** e **`auth.js`** — o "coração" do app (login e salvamento).
5. **`nav.js`** — troca de páginas.
6. **Módulos de página, do mais simples ao mais complexo:**
   - `notas.js` (mais simples e isolado)
   - `home.js`
   - `perfil.js`
   - `metas.js`
   - `tarefas.js`
   - `agenda.js`
   - `resumo.js`
   - `gastos.js` (mais complexo: parcelas, juros)
   - `estudos.js` (mais complexo: timer, XP)
   - `leitura.js` (mais complexo: estante, filtros, resumo de leitura)

Depois de cada item migrado, o `index.html` deve carregar os arquivos `<script>`
**nessa mesma ordem** (config → helpers → persistence/auth → nav → módulos),
porque um arquivo pode usar uma função definida em outro que vem antes.

---

## 5. Checklist de teste depois de cada etapa

Antes de considerar uma etapa concluída, testar manualmente:

- [ ] Login e criação de conta continuam funcionando.
- [ ] Cada página abre sem erro no console do navegador (F12 → Console).
- [ ] Criar, editar e excluir um item no módulo que acabou de ser movido.
- [ ] Os dados continuam salvando (recarregar a página e ver se o item continua lá).
- [ ] Nenhuma outra página quebrou (teste rápido em pelo menos 2-3 outras páginas).

Se algo quebrar, o passo deve ser revertido antes de seguir para o próximo.

---

## 6. O que NÃO está incluído neste plano (decisões futuras separadas)

- Trocar o modelo de dados (blob JSON único → tabelas por módulo no Supabase).
- Adotar um bundler (Vite) e módulos ES de verdade.
- Adotar um framework de componentes (React ou outro).
- Qualquer mudança visual ou de identidade de marca.

Essas são decisões de arquitetura maiores, cada uma com seus próprios trade-offs,
e devem ser discutidas e autorizadas individualmente quando chegar a hora.

---

## 7. Recomendação de fluxo de trabalho com o Git

Para não arriscar o site que já está no ar:

1. Criar uma branch nova: `git checkout -b refatoracao/modularizacao`.
2. Fazer as migrações e os testes todos nessa branch.
3. Só dar merge para a `main` (e portanto publicar) depois que tudo do checklist
   acima passar.
