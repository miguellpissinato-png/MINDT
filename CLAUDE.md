# MINDT — Contexto do Projeto para Claude Code

Este arquivo é lido automaticamente pelo Claude Code ao abrir este repositório.
Ele contém o contexto do produto, as regras de trabalho e o plano de evolução atual.
Leia isto por completo antes de fazer qualquer alteração.

---

## 1. O que é o MINDT

Plataforma de gerenciamento da vida pessoal (finanças, tarefas, metas, hábitos,
rotina, estudos, leitura, notas). O objetivo é um produto comercial real —
não um projeto de estudo. Visão: **Web → app mobile → produto comercial → empresa**.

O fundador (responsável pelo produto) não tem conhecimento técnico avançado.
Explique decisões técnicas importantes de forma simples: problema → opções →
recomendação → por quê → consequências futuras.

---

## 2. Regra de autorização (OBRIGATÓRIA)

**Antes de executar qualquer uma das ações abaixo, pergunte e aguarde autorização
explícita do fundador:**

- Comandos destrutivos (delete, drop, force push, rewrite de histórico).
- Instalação de novas dependências ou frameworks.
- Criação significativa de arquivos/módulos novos.
- Mudança de arquitetura (ex: dividir o monólito, trocar estrutura de dados).
- Qualquer alteração que remova ou reescreva uma funcionalidade já existente.

Dentro de uma tarefa **já autorizada**, não é necessário pedir permissão para cada
passo interno. Se surgir uma decisão nova e importante que não estava prevista na
autorização original, pare e consulte antes de prosseguir.

Nunca destrua ou substitua partes funcionais sem necessidade clara. Se encontrar um
problema estrutural sério, avise antes de propor uma refatoração grande.

---

## 3. Como programar neste projeto

- Analise o código existente antes de modificar.
- Não crie arquivos ou componentes duplicados; reutilize o que já existe.
- Corrija a causa raiz dos bugs, não apenas o sintoma.
- Evite soluções temporárias sem deixar isso marcado explicitamente no código (`// TODO` ou similar).
- Teste as alterações sempre que possível antes de considerar a tarefa concluída.
- Priorize legibilidade e organização modular sobre "código esperto".

---

## 4. Diagnóstico técnico atual (levantado em 30/08/2026)

### Estrutura
- Repositório contém **um único arquivo**: `index.html` (~5.230 linhas, ~286KB).
- HTML, CSS (1 bloco `<style>`) e JavaScript (186 funções, todas em escopo global)
  estão todos no mesmo arquivo.
- Sem `package.json`, sem build tool, sem framework — JS puro direto no navegador.
- Hospedagem provável via GitHub Pages.

### Backend
- Supabase (auth + Postgres).
- Projeto: `eyhttiumvnhksbbjhhzt` (região sa-east-1).
- Tabela `user_data`: `id (uuid)`, `user_id (uuid, fk → auth.users)`, `data (jsonb)`, `updated_at`.
- **Todo o estado do usuário é salvo como um único blob JSON** na coluna `data`,
  reescrito por completo a cada `saveState()`.
- Fallback em `localStorage` para funcionamento offline/erro de rede.

### Segurança (auditado via Supabase Advisors em 30/08/2026)
- ✅ RLS (Row Level Security) **habilitada** na tabela `user_data` — cada usuário só
  acessa seus próprios dados. Ponto crítico já resolvido corretamente.
- ⚠️ Proteção contra senhas vazadas (leaked password protection) está **desativada**
  no Auth. Ajuste de baixo esforço e alto benefício, pendente.
  Ref: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Módulos existentes (10 páginas)
Home, Metas, Tarefas, Gastos (com parcelas e juros), Agenda, Resumo, Estudos
(pomodoro + sistema de XP/nível), Leitura (estante de livros), Notas, Perfil.

### Principais riscos técnicos identificados
1. **Arquivo monolítico + escopo global**: qualquer alteração pequena tem risco de
   quebrar funcionalidades não relacionadas; dificulta manutenção e colaboração futura.
2. **Estado como blob JSON único**: não escala bem, gera risco de perda de dados em
   edições concorrentes (ex: duas abas abertas), e dificulta queries/analytics futuras
   por módulo.
3. **Sem separação de camadas**: UI, lógica de negócio e acesso a dados estão
   misturados nas mesmas funções.
4. **Sem testes automatizados.**

O que já funciona bem e deve ser preservado: autenticação funcional, 10 módulos
com funcionalidades reais implementadas, persistência com fallback offline,
identidade visual inicial (tema escuro roxo, glassmorphism).

---

## 5. Roadmap priorizado

**Essencial (antes de qualquer coisa nova)**
- Habilitar leaked password protection no Supabase Auth.
- Definir e documentar a estratégia de reformulação da arquitetura (monólito →
  módulos) antes de tocar em código de produto.

**Importante**
- Modularizar o front-end (separar HTML/CSS/JS em arquivos, isolar lógica por módulo).
- Revisar o modelo de dados: sair do blob JSON único para tabelas por módulo
  (metas, tarefas, gastos, etc.), preservando compatibilidade com os dados existentes.
- Construir a identidade visual definitiva (paleta, tipografia, logo, mascote).

**Opcional**
- Sistema de gamificação expandido (o módulo Estudos já tem uma base de XP/nível
  que pode inspirar um sistema geral).
- Integrações entre módulos (ex: gastos vinculados a metas e tarefas já existe
  parcialmente — expandir essa conexão).

**Futuro**
- Versão mobile nativa ou PWA.
- Multiusuário avançado (compartilhamento, contas familiares).
- Camada de analytics/dashboards agregados.

Nenhuma etapa do roadmap acima está autorizada para execução automática — cada uma
deve ser confirmada com o fundador antes de começar, conforme a regra de autorização
da seção 2.
