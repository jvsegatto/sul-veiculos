import { NextResponse } from "next/server"
import { consumeAuthorizationCode, issueTokens, rotateRefreshToken, verifyClientSecret, verifyPkce } from "@/lib/mcp/oauthStore"

// Claude sempre manda o token request como application/x-www-form-urlencoded
// (RFC 6749) — nunca JSON. Erros seguem o formato RFC 6749 (campo "error").
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? ""
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.json({ error: "invalid_request", error_description: "Content-Type deve ser application/x-www-form-urlencoded" }, { status: 400 })
  }

  const body = new URLSearchParams(await req.text())
  const grantType = body.get("grant_type")

  if (grantType === "authorization_code") {
    const code         = body.get("code")
    const redirectUri  = body.get("redirect_uri")
    const codeVerifier = body.get("code_verifier")
    const clientId     = body.get("client_id")
    const clientSecret = body.get("client_secret")

    if (!code || !redirectUri || !codeVerifier || !clientId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    }
    if (clientSecret && !(await verifyClientSecret(clientId, clientSecret))) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401 })
    }

    const grant = await consumeAuthorizationCode(code)
    if (!grant || grant.clientId !== clientId || grant.redirectUri !== redirectUri) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
    }
    if (!verifyPkce(codeVerifier, grant.codeChallenge)) {
      return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400 })
    }

    const tokens = await issueTokens({ clientId, userId: grant.userId, scope: grant.scope ?? undefined })
    return NextResponse.json({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    })
  }

  if (grantType === "refresh_token") {
    const refreshToken = body.get("refresh_token")
    const clientId     = body.get("client_id")
    const clientSecret = body.get("client_secret")

    if (!refreshToken) return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    if (clientId && clientSecret && !(await verifyClientSecret(clientId, clientSecret))) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401 })
    }

    const tokens = await rotateRefreshToken(refreshToken)
    if (!tokens) return NextResponse.json({ error: "invalid_grant" }, { status: 400 })

    return NextResponse.json({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    })
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 })
}
