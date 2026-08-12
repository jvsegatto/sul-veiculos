import { createHash, randomBytes } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

// Nunca guardamos secret/token em texto puro — só o hash SHA-256. Comparar
// hash com hash já é seguro contra timing attack na prática (diferença de
// alguns nanosegundos num SELECT de banco não é exploravél remotamente), e
// evita a complexidade de timingSafeEqual com strings de tamanho variável.
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

function base64UrlSha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url")
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url")
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  return base64UrlSha256(codeVerifier) === codeChallenge
}

// ── Clients ───────────────────────────────────────────────────────────────────

export type OAuthClient = {
  clientId: string
  clientSecretHash: string
  redirectUris: string[]
  clientName: string
}

export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("mcp_oauth_clients").select("*").eq("client_id", clientId).single()
  if (error || !data) return null
  return {
    clientId: data.client_id,
    clientSecretHash: data.client_secret_hash,
    redirectUris: data.redirect_uris ?? [],
    clientName: data.client_name,
  }
}

export async function verifyClientSecret(clientId: string, secret: string): Promise<boolean> {
  const client = await getOAuthClient(clientId)
  if (!client) return false
  return client.clientSecretHash === sha256Hex(secret)
}

// ── Authorization codes ────────────────────────────────────────────────────────

export async function createAuthorizationCode(args: {
  clientId: string
  userId: string
  redirectUri: string
  codeChallenge: string
  scope?: string
}): Promise<string> {
  const code = generateOpaqueToken()
  const supabase = createAdminClient()
  const { error } = await supabase.from("mcp_oauth_codes").insert({
    code,
    client_id: args.clientId,
    user_id: args.userId,
    redirect_uri: args.redirectUri,
    code_challenge: args.codeChallenge,
    scope: args.scope ?? null,
  })
  if (error) throw new Error(error.message)
  return code
}

export async function consumeAuthorizationCode(
  code: string
): Promise<{ clientId: string; userId: string; redirectUri: string; codeChallenge: string; scope: string | null } | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code", code)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .single()

  if (error || !data) return null

  await supabase.from("mcp_oauth_codes").update({ consumed_at: new Date().toISOString() }).eq("code", code)

  return {
    clientId: data.client_id,
    userId: data.user_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    scope: data.scope,
  }
}

// ── Tokens ──────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 // 1h
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 dias

export async function issueTokens(args: {
  clientId: string
  userId: string
  scope?: string | null
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string | null }> {
  const accessToken = generateOpaqueToken()
  const refreshToken = generateOpaqueToken()
  const supabase = createAdminClient()

  const { error } = await supabase.from("mcp_tokens").insert({
    client_id: args.clientId,
    user_id: args.userId,
    access_token_hash: sha256Hex(accessToken),
    refresh_token_hash: sha256Hex(refreshToken),
    scope: args.scope ?? null,
    access_expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  })
  if (error) throw new Error(error.message)

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, scope: args.scope ?? null }
}

export type VerifiedAccessToken = { userId: string; clientId: string; scope: string | null }

export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("user_id, client_id, scope, access_expires_at, revoked_at")
    .eq("access_token_hash", sha256Hex(token))
    .is("revoked_at", null)
    .single()

  if (error || !data) return null
  if (new Date(data.access_expires_at) < new Date()) return null

  return { userId: data.user_id, clientId: data.client_id, scope: data.scope }
}

// Rotação: o refresh token antigo é revogado e um par novo é emitido — evita
// que um refresh token roubado continue valendo pra sempre (OAuth 2.1).
export async function rotateRefreshToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string | null } | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, client_id, user_id, scope, refresh_expires_at, revoked_at")
    .eq("refresh_token_hash", sha256Hex(refreshToken))
    .is("revoked_at", null)
    .single()

  if (error || !data) return null
  if (!data.refresh_expires_at || new Date(data.refresh_expires_at) < new Date()) return null

  await supabase.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", data.id)

  return issueTokens({ clientId: data.client_id, userId: data.user_id, scope: data.scope })
}

export { sha256Hex }
