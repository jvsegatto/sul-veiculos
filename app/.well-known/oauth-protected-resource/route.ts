import { protectedResourceHandler } from "mcp-handler"
import { ISSUER_URL, MCP_RESOURCE_URL } from "@/lib/mcp/oauthConfig"

export const GET = protectedResourceHandler({
  authServerUrls: [ISSUER_URL],
  resourceUrl: MCP_RESOURCE_URL,
})
