import type { UserInfo } from '@/lib/actions/vehicles'

type ExtraWithAuth = { authInfo?: { extra?: Record<string, unknown> } }

// Lê a identidade resolvida por withMcpAuth (a partir do token Bearer
// verificado contra mcp_tokens, ver app/api/[transport]/route.ts). Se chegar
// aqui sem authInfo.extra preenchido corretamente, é bug de configuração do
// auth — withMcpAuth com required:true já bloqueia qualquer chamada sem
// token válido antes de chegar na tool.
export function resolveMcpUser(extra: ExtraWithAuth): UserInfo {
  const info = extra.authInfo?.extra
  if (!info || typeof info.userId !== 'string' || typeof info.role !== 'string') {
    throw new Error('Identidade do conector não resolvida — token inválido ou auth mal configurada')
  }
  return { userId: info.userId, role: info.role as UserInfo['role'], name: (info.name as string) || 'Usuário' }
}
