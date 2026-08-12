# Dash Motors — Painel Admin de Estoque (template)

Painel administrativo Next.js pra lojistas de veículos: cadastro/edição de
estoque com fotos, geração e publicação de posts/stories/carrosséis no
Instagram, e um **conector MCP** que permite gerenciar tudo isso pelo Claude
normal (claude.ai, com a assinatura do próprio usuário — sem custo extra de
API embutido no painel).

Esse repositório é um **molde**: o código não referencia nenhum lojista
específico. Pra colocar em produção pra um cliente novo, siga o checklist
abaixo — em ~30-40 min o painel está no ar pra esse cliente.

## Stack

- **Next.js 16** (App Router, Turbopack) — front + back num só deploy
- **Supabase** — banco (Postgres) + autenticação dos usuários do painel
- **Cloudflare R2** — armazenamento das fotos (egress grátis, compatível S3)
- **Vercel** — hospedagem, deploy automático via `git push`
- **MCP** (`mcp-handler` + OAuth próprio) — conector pro Claude.ai

Sem nenhuma chamada paga à API da Anthropic — o conector só responde ao
Claude.ai que o próprio usuário já paga via assinatura.

---

## Checklist — colocar no ar pra um cliente novo

### 1. Duplicar o repositório

No GitHub, "Use this template" (se marcado como template) ou `git clone` +
trocar o remote pra um repo novo do cliente. Cada cliente = 1 repo, 1 projeto
Supabase, 1 bucket R2, 1 projeto Vercel — infraestrutura isolada, zero risco
de um cliente ver dado de outro.

### 2. Criar o projeto Supabase

1. [supabase.com](https://supabase.com) → New Project.
2. **SQL Editor** → cole o conteúdo de `supabase-schema.sql` (raiz do repo)
   → Run. Cria as tabelas (`profiles`, `vehicles`, mídias, tabelas do OAuth
   do conector MCP) e a view pública que o site institucional consome.
3. **Authentication → Users → Add user** → cria o login de quem vai usar o
   painel (email + senha). O perfil em `profiles` é criado sozinho por um
   trigger, já com `active = true` — não precisa de passo extra. Pra esse
   usuário conseguir usar o conector MCP, edite a role dele pra
   `SUPER_ADMIN` ou `INVENTORY_MANAGER` (padrão é `VENDEDOR`, sem acesso ao
   conector).
4. **Project Settings → API** → guarde `Project URL`, chave `anon public` e
   chave `service_role` (essa última nunca vai pro browser).

### 3. Criar o bucket Cloudflare R2

1. Painel Cloudflare → R2 → criar bucket (nome sugerido: nome do cliente em
   slug, ex: `dashmotors-veiculos`).
2. Conectar um domínio público de leitura (custom domain) ou usar a URL
   `r2.dev` padrão do bucket.
3. **Manage API Tokens** → criar token com permissão de leitura/escrita
   nesse bucket → guardar Account ID, Access Key ID, Secret Access Key.

### 4. Identidade visual do cliente

Só 2 arquivos:

- **`lib/constants.ts`** — troque `STORE_NAME`, `STORE_CITY`,
  `STORE_ADDRESS`, `STORE_WHATSAPP`, `STORE_HASHTAGS` e (se tiver vendedores
  com contato próprio nas legendas) `SELLERS`.
- **`public/dash-motors-logo.png`** — troque pelo logo real do cliente
  (mesma proporção 1:1 funciona melhor — é usado em tamanhos pequenos, de
  36px a 1024px). Se trocar o nome do arquivo, atualize `STORE_LOGO_PATH`
  em `lib/constants.ts` junto.

Cores (dourado/escuro) ficam em `lib/theme.ts` — só mexa se o cliente quiser
uma paleta diferente da padrão do template.

### 5. Criar o projeto Vercel

```bash
vercel link      # cria/conecta um projeto novo
```

Linka no repo do cliente (GitHub) pra deploy automático a cada `git push`.

⚠️ **Deixe "Root Directory" em branco** nas Project Settings da Vercel — esse
repo já é a raiz do app (diferente do painel original da Splendore, que vive
numa subpasta `site/estoque` dentro de um repo maior). Se Root Directory
ficar apontando pra uma subpasta por engano, `vercel --prod` rodado da
própria máquina falha com o path duplicado — ver `docs/mcp-server.md` seção
2 pro detalhe completo desse bug.

Variáveis de ambiente (Project Settings → Environment Variables, ou
`vercel env add`):

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Passo 2.4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Passo 2.4 |
| `SUPABASE_SERVICE_ROLE_KEY` | Passo 2.4 |
| `R2_ACCOUNT_ID` | Passo 3.3 |
| `R2_ACCESS_KEY_ID` | Passo 3.3 |
| `R2_SECRET_ACCESS_KEY` | Passo 3.3 |
| `R2_BUCKET` | Passo 3.1 |
| `R2_PUBLIC_BASE_URL` | Passo 3.2 (sem barra no final) |
| `NEXT_PUBLIC_SITE_URL` | URL que a Vercel vai dar ao projeto — preencha depois do primeiro deploy (ver passo 6) |
| `META_PAGE_ACCESS_TOKEN`, `META_IG_USER_ID` | Opcional — publicação direta no Instagram (passo 8) |

### 6. Primeiro deploy

```bash
git push origin main
```

A Vercel builda e publica sozinha. Copie a URL que ela deu ao projeto (ex:
`dash-motors-cliente.vercel.app`), volte nas env vars e preencha
`NEXT_PUBLIC_SITE_URL` com essa URL — sem isso, o conector MCP e os links de
rascunho de foto ficam com URL errada. Depois de preencher, force um redeploy
(Vercel → Deployments → ⋯ → Redeploy) pra pegar a env var nova.

Se o cliente já tem domínio próprio, aponte um subdomínio (ex:
`admin.dominiocliente.com`) ou um rewrite `/admin` a partir do site
institucional pra esse projeto — mesmo padrão usado no painel da Splendore
(ver `vercel.json` do site institucional dela como referência).

### 7. Conector MCP (opcional, mas é o grande diferencial do produto)

Ver `docs/mcp-server.md` completo. Resumo:

1. Gerar `client_id`/`client_secret` (seção 6 do doc) — roda um script node
   direto contra o Supabase do cliente.
2. Cliente entra em claude.ai → Settings → Connectors → Add custom connector
   → cola a URL (`https://<dominio>/admin/api/mcp`) + client_id/secret.
3. Autoriza (precisa de login com role `SUPER_ADMIN` ou
   `INVENTORY_MANAGER`).
4. Pronto — comandos em português direto no Claude normal (exemplos no fim
   do doc).

### 8. Instagram/Meta (opcional)

Sem configurar nada, a Central de Mídias já gera as artes normalmente — só o
botão "Publicar no Instagram" fica desabilitado. Pra habilitar: criar app em
[developers.facebook.com](https://developers.facebook.com), conectar a
página do Facebook vinculada ao Instagram Business do cliente, gerar
`META_PAGE_ACCESS_TOKEN` de longa duração + pegar `META_IG_USER_ID`.

### 9. Ativar no site institucional do cliente

O site institucional (fora desse repo) deve buscar os veículos direto da
`view` pública do Supabase (`public_vehicles`) usando a `Project URL` + chave
`anon public` do passo 2.4 — a chave anon é pública por design, pode ficar
no código do site sem problema. Qualquer veículo cadastrado/editado no
painel aparece no site automaticamente.

---

## Rodar localmente

```bash
npm install
cp .env.local.example .env.local
# preencha .env.local com os valores dos passos 2-3
npm run dev
```

Abre em `http://localhost:3000/admin` (o `basePath` já inclui `/admin`).

## Estrutura

```
app/
  login/              tela de login (Supabase Auth)
  estoque/            lista, novo, editar (com fotos)
  midias/             Central de Mídias — lista + wizard de criação
  oauth/, api/[transport]/, .well-known/   conector MCP (OAuth + servidor)
lib/
  constants.ts        identidade do lojista — ÚNICO lugar que muda por cliente
  theme.ts            paleta de cores centralizada
  supabase/           clientes browser/SSR/service-role
  uploads/r2.ts       upload de fotos: full+thumb em WebP, smart crop
                       automático (foco no veículo, não no letreiro da loja),
                       decodifica HEIC de foto de iPhone antes de processar
  actions/            server actions (veiculos.ts, media.ts, instagram.ts)
  mcp/                lógica do conector (tools, auth, oauth)
  midias/             geração de legenda/hashtags, colagem de story
  types.ts            tipos — espelham as colunas do schema
components/
  layout/Shell.tsx    header fixo com nav + logout
  estoque/            card grid do estoque
  vehicles/           formulário de veículo + gerenciador de fotos
  midias/             wizard de mídia + templates de preview (html-to-image)
supabase-schema.sql   schema completo (colar no SQL Editor do Supabase)
docs/mcp-server.md    documentação completa do conector MCP
```
