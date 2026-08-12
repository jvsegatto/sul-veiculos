const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// Issuer/raiz de descoberta OAuth (RFC 8414 / RFC 9728) — fica na raiz do
// domínio, SEM o basePath "/admin". Um issuer com path component obriga o
// cliente a adivinhar uma convenção de onde inserir "/.well-known/X" (antes
// ou depois do path), e o Claude.ai não acertou isso na prática — por isso
// a raiz, que elimina a ambiguidade. A rota física desses dois endpoints
// continua em app/.well-known/* (sob o basePath), exposta na raiz via
// rewrite com basePath:false em next.config.ts.
export const ISSUER_URL = SITE_URL

// Os endpoints reais de OAuth e o recurso MCP continuam sob /admin — são
// usados como URL absoluta dentro do JSON de metadata, então o cliente nunca
// precisa reconstruir esse caminho a partir do issuer.
export const AUTHORIZATION_ENDPOINT = `${SITE_URL}/admin/oauth/authorize`
export const TOKEN_ENDPOINT = `${SITE_URL}/admin/oauth/token`
export const MCP_RESOURCE_URL = `${SITE_URL}/admin/api/mcp`
