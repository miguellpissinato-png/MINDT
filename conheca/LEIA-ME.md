# A página de convite (o link da bio)

O que é: a página que abre quando alguém clica no link do seu perfil do
Instagram ou do TikTok. Ela apresenta o Ticolino, mostra o app e pede o
e-mail. Quem deixa o e-mail recebe a apresentação do Mindt com o link.

**O link para colar na bio:**

```
https://miguellpissinato-png.github.io/MINDT/conheca/
```

Para saber de onde veio cada pessoa, dá para pôr um apelido no fim do link.
Ele não aparece para quem clica, mas fica gravado junto com o e-mail:

```
.../conheca/?de=instagram
.../conheca/?de=tiktok
```

---

## Como as peças se encaixam

| Peça | Onde fica | O que faz |
|---|---|---|
| A página | `conheca/` | Mostra o Mindt e pede o e-mail |
| O e-mail | `email/boas-vindas.html` | A mensagem que a pessoa recebe |
| O motor | Supabase → Edge Functions → `boas-vindas` | Guarda o e-mail e dispara a mensagem |
| A lista | Supabase → Table Editor → `leads` | Todos os e-mails deixados |

A página sozinha não guarda nem envia nada — ela é um arquivo estático no
GitHub Pages. Quem faz isso é a função no Supabase.

---

## O que falta para o e-mail sair

A página já funciona e **já guarda os e-mails** desde o primeiro visitante.
O que ainda não está ligado é o disparo automático. São três passos, uma vez só:

**1. Criar a conta no Brevo** (grátis, 300 e-mails por dia)

- Entre em <https://www.brevo.com> e crie a conta.
- Em *Senders, Domains & Dedicated IPs* → *Senders*, adicione o seu e-mail
  como remetente. O Brevo manda um link de confirmação para ele; é só clicar.
- Em *SMTP & API* → *API Keys*, gere uma chave e copie.

O Brevo foi escolhido porque aceita um Gmail verificado como remetente. Os
concorrentes (Resend, por exemplo) exigem um domínio próprio — algo como
`mindt.com.br`, que você ainda não tem.

**2. Guardar a chave no Supabase**

No painel do Supabase → *Edge Functions* → *Secrets*, crie:

| Nome | Valor |
|---|---|
| `REMETENTE_EMAIL` | o e-mail que você verificou no Brevo |
| `REMETENTE_NOME` | `Ticolino do Mindt` |
| `BREVO_API_KEY` | a chave que você copiou |

**3. Testar**

Abra a página, deixe um e-mail seu e veja se a mensagem chega. Se não chegar,
olhe a coluna `erro_envio` na tabela `leads`: o motivo fica escrito lá.

### Enquanto isso não é feito

Nenhum e-mail se perde. A função guarda o endereço do mesmo jeito e a página
troca o recado: em vez de *"olha sua caixa de entrada"*, ela diz *"te aviso
assim que o Mindt abrir"*. Quando você ligar o envio, os endereços já estarão
todos na tabela `leads`.

---

## Mexer no texto do e-mail

Edite `email/boas-vindas.html` direto pelo GitHub e salve. A função busca esse
arquivo na hora de enviar, então a mudança vale no envio seguinte — não
precisa reinstalar nada.

Duas coisas o sistema preenche sozinho, **não apague**:

- `{{unsubscribe}}` — o link de sair da lista
- `{{contato}}` — o seu e-mail no rodapé

## Trocar o dia em que o Mindt sair do "em desenvolvimento"

Quando o app deixar de ser lista de espera, mude em `conheca/index.html`:
o selo **"Em desenvolvimento"**, o **"Lista de espera"** no topo e o texto
do cartão de captura.
