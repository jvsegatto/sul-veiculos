import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerMcpTools } from "@/lib/mcp/tools"
import { verifyAccessToken } from "@/lib/mcp/oauthStore"
import { ISSUER_URL } from "@/lib/mcp/oauthConfig"
import { createAdminClient } from "@/lib/supabase/admin"

const baseHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server)
  },
  {
    serverInfo: { name: "estoque-mcp", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
    disableSse: true,
  }
)

const handler = withMcpAuth(
  baseHandler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined
    const verified = await verifyAccessToken(bearerToken)
    if (!verified) return undefined

    const supabase = createAdminClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, name, active")
      .eq("id", verified.userId)
      .single()

    if (!profile || !profile.active || profile.role === "VENDEDOR") return undefined

    return {
      token: bearerToken,
      clientId: verified.clientId,
      scopes: verified.scope ? verified.scope.split(" ") : ["estoque"],
      extra: { userId: verified.userId, role: profile.role, name: profile.name },
    }
  },
  {
    required: true,
    // Sem isso, a lib deriva a origem só dos headers de proxy (sem o
    // basePath "/admin"), e o header WWW-Authenticate aponta pro
    // .well-known errado (faltando /admin no caminho).
    resourceUrl: ISSUER_URL,
  }
)

export { handler as GET, handler as POST, handler as DELETE }
