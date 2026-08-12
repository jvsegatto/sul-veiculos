# Conector MCP — Dash Motors (template)

Servidor MCP (Model Context Protocol) remoto que permite usar o **Claude
normal** (claude.ai, com a própria assinatura do usuário) pra gerenciar o
estoque de veículos e publicar no Instagram, sem nenhuma chamada paga à API
da Anthropic embutida no painel. O Claude só age através de um conjunto fixo
de ferramentas — nunca tem acesso a SQL livre, código-fonte ou arquivos.

## 1. Rodar localmente

```bash
npm install
npm run dev
```

O servidor MCP fica em `http://localhost:3000/admin/api/mcp` (o prefixo
`/admin` vem do `basePath` configurado em `next.config.ts` — todas as rotas
desse projeto, inclusive as do conector, ficam sob esse caminho).

Pra testar as ferramentas sem precisar configurar OAuth de verdade, use o
[MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector
```

E aponte pra `http://localhost:3000/admin/api/mcp` (Streamable HTTP). Você
vai precisar fazer o handshake OAuth completo (ver seção 6) já que o
endpoint exige autenticação.

## 2. Hospedar

O conector já está no mesmo projeto Vercel do painel admin — não é um serviço
separado.

**Deploy recomendado (Git, automático)**: linka esse repo num projeto Vercel
novo com **Root Directory em branco** (o repo já É a raiz do app — diferente
do repo original da Splendore, onde esse painel vive numa subpasta e precisa
de Root Directory = `site/estoque`). Todo `git push` na branch de produção
builda e publica sozinho.

⚠️ **Pegadinha real que já aconteceu**: se o projeto Vercel ficar com Root
Directory apontando pra uma subpasta (ex: copiou a config de outro projeto) E
você tentar rodar `vercel --prod` direto de dentro dessa subpasta, o path
duplica (`.../subpasta/subpasta`) e o deploy manual falha com "provided path
does not exist". Solução: ou usa deploy via git (não sofre com isso), ou
confirma nas Project Settings da Vercel que Root Directory está vazio antes
de rodar `vercel --prod`.

## 3. URL que o cliente deve conectar no Claude.ai

1. Entrar em [claude.ai](https://claude.ai) → **Settings → Connectors → Add
   custom connector**.
2. URL do servidor: `https://<seu-dominio-vercel>/admin/api/mcp`.
3. Em **Advanced settings**, preencher **OAuth Client ID** e **OAuth Client
   Secret** com as credenciais geradas (ver seção 6 — são entregues fora do
   código, nunca commitadas no git).
4. Salvar e clicar em **Connect** — o Claude vai abrir a tela de login do
   painel (se não estiver logado) e depois a tela de consentimento
   ("Autorizar conector"). Só usuários com role `SUPER_ADMIN` ou
   `INVENTORY_MANAGER` conseguem autorizar.

## 4. Ferramentas disponíveis

Nenhuma ferramenta executa SQL ou código livre — cada uma tem schema fixo e
mapeia pra uma função de backend específica.

| Ferramenta | O que faz | Precisa de confirmação? |
|---|---|---|
| `estoque_listar_veiculos` | Lista veículos com filtros (marca, status, categoria, faixa de preço, busca livre) | Não (só leitura) |
| `estoque_buscar_veiculo` | Busca por ID ou nome/modelo/ano | Não (só leitura) |
| `estoque_criar_rascunho_veiculo` | Propõe cadastro de veículo novo | Sim — `estoque_confirmar_criacao_veiculo` |
| `estoque_confirmar_criacao_veiculo` | Efetiva o cadastro (exige pelo menos 1 foto já enviada pelo painel) | — |
| `estoque_editar_rascunho_veiculo` | Propõe um patch de edição num veículo existente | Sim — `estoque_confirmar_edicao_veiculo` |
| `estoque_confirmar_edicao_veiculo` | Aplica a edição | — |
| `estoque_remover_rascunho_veiculo` | Propõe arquivar (soft delete) um veículo | Sim — `estoque_confirmar_remocao_veiculo` |
| `estoque_confirmar_remocao_veiculo` | Arquiva de verdade (nunca apaga permanentemente — é reversível) | — |
| `estoque_marcar_vendido` | Marca como vendido (reversível, sem ciclo de confirmação) | Não |
| `estoque_marcar_disponivel` | Marca como disponível de novo | Não |
| `estoque_definir_destaque` | Liga/desliga o selo "Carro premium" | Não |
| `instagram_gerar_preview_post` | Monta legenda + lista de fotos do veículo pra revisão | Não (não publica nada) |
| `instagram_publicar_post` | Propõe publicar um carrossel no Instagram com as fotos originais do veículo | Sim — `instagram_confirmar_publicacao` |
| `instagram_confirmar_publicacao` | Publica de verdade (chamada real à Graph API) | — |

**Limitação importante**: a publicação via conector usa as **fotos originais
do veículo + legenda**, sem o overlay de arte (faixa de preço, specs
sobrepostos) que o gerador de mídias do painel (`/midias/nova`) produz — essa
arte só é renderizada no navegador (`html-to-image`), não existe (e não foi
construído) um renderizador equivalente no servidor. Pra postar com a arte
estilizada, continue usando o wizard manual do painel.

**Fotos de veículo novo**: como o Claude não tem acesso a arquivos locais do
usuário, o fluxo de cadastro é em duas etapas — `estoque_criar_rascunho_veiculo`
cria um rascunho e devolve um link (`/estoque/rascunhos/{id}`) pra você subir
as fotos pelo painel; só depois disso `estoque_confirmar_criacao_veiculo`
funciona.

## 5. Variáveis de ambiente

Em `.env.local` (e os mesmos nomes na Vercel, via `vercel env add` ou Project
Settings → Environment Variables):

| Variável | Pra que serve |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Já existiam, reaproveitadas pelo conector |
| `NEXT_PUBLIC_SITE_URL` | URL pública do app **sem** `/admin` (ex: `https://dash-motors-cliente.vercel.app`) — usada pra montar o issuer OAuth e os links de rascunho |

Não existe nenhuma variável de API key de IA (Anthropic/Claude) — o conector
não faz nenhuma chamada à API da Anthropic, só responde chamadas que o
Claude.ai do usuário já paga via assinatura dele.

## 6. Gerar ou trocar o client_id/client_secret

O client OAuth fica numa tabela (`mcp_oauth_clients`), não em env var — só o
**hash** do secret é guardado. Pra gerar um novo client (ou trocar o secret
de um existente):

```js
// Rode com node, na raiz do repo, com as envs do .env.local carregadas
// (ver README.md — script pronto de leitura do .env.local)
const crypto = require('crypto')
const clientId = 'dashmotors-claude-' + crypto.randomBytes(6).toString('hex')
const clientSecret = crypto.randomBytes(32).toString('base64url')
const secretHash = crypto.createHash('sha256').update(clientSecret).digest('hex')

fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/mcp_oauth_clients', {
  method: 'POST',
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    client_id: clientId,
    client_secret_hash: secretHash,
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    client_name: 'Dash Motors - Painel Admin', // troque pelo nome do cliente
  }),
}).then(r => r.json()).then(console.log)

console.log('CLIENT_ID=' + clientId)
console.log('CLIENT_SECRET=' + clientSecret) // só aparece agora — guarde, não fica recuperável depois
```

O `client_secret` em texto puro só existe nesse momento — depois disso só o
hash fica salvo. Cole o `client_id`/`client_secret` nas Advanced settings do
conector no Claude.ai.

## 7. Revogar o acesso do cliente

Três níveis, do mais brando ao mais drástico:

- **Revogar um token específico**: apagar a linha correspondente em
  `mcp_tokens` (ou rodar `UPDATE mcp_tokens SET revoked_at = now() WHERE ...`).
  O Claude vai precisar reautorizar (tela de consentimento de novo) na
  próxima chamada.
- **Revogar todos os tokens de um client**: `DELETE FROM mcp_tokens WHERE
  client_id = '...'` (a constraint `ON DELETE CASCADE` em `mcp_oauth_codes`/
  `mcp_tokens` também limpa códigos pendentes).
- **Desativar o conector inteiro**: apagar a linha em `mcp_oauth_clients`
  (`DELETE FROM mcp_oauth_clients WHERE client_id = '...'`) — derruba o
  client e todos os tokens/códigos vinculados de uma vez (cascade).
- **Revogar pela conta do usuário**: desativar o profile dele
  (`profiles.active = false`) ou trocar pra role `VENDEDOR` — o conector
  passa a rejeitar qualquer chamada autenticada com o token desse usuário,
  mesmo que o token em si ainda não tenha expirado.

## 8. Exemplos de comando no Claude normal

Depois de conectado, comandos em português funcionam direto:

- "Liste todos os carros disponíveis no estoque."
- "Cadastre um Corolla XEI 2021 prata automático com 68 mil km por R$ 119.900."
  *(o Claude vai te pedir pra subir as fotos pelo painel antes de confirmar)*
- "Marque a Hilux 2023 como vendida."
- "Coloque o Civic Touring como destaque."
- "Gere uma legenda para Instagram do Corolla 2021."
- "Publique o post do Corolla no Instagram — mas me mostra antes o que vai sair."
- "Remova o Onix branco 2020 do estoque, mas me mostre a prévia antes."

Pra qualquer ação que crie, edite, remova ou publique algo, o Claude sempre
mostra um resumo e espera você confirmar explicitamente antes de executar de
verdade — isso é garantido pelo desenho das ferramentas (propor → confirmar
em duas chamadas separadas), não depende só do bom comportamento do modelo.
