import { createAdminClient } from '@/lib/supabase/admin'
import type { MCPPendingAction, PendingActionKind, PendingActionStatus } from '@/lib/mcp/types'

function rowToPendingAction(row: Record<string, unknown>): MCPPendingAction {
  return {
    id:        row.id as string,
    kind:      row.kind as PendingActionKind,
    vehicleId: (row.vehicle_id as string) || null,
    payload:   (row.payload as Record<string, unknown>) ?? {},
    summary:   row.summary as string,
    createdBy: (row.created_by as string) || null,
    status:    row.status as PendingActionStatus,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  }
}

// Tudo aqui usa o service role direto — o servidor MCP não tem sessão de
// cookies (não é um navegador), então a permissão já foi checada antes de
// chegar aqui (gate de role na autorização do conector / resolveMcpUser).

export async function createPendingAction(args: {
  kind: PendingActionKind
  vehicleId?: string | null
  payload: Record<string, unknown>
  summary: string
  userId?: string | null
}): Promise<MCPPendingAction> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mcp_pending_actions')
    .insert({
      kind:       args.kind,
      vehicle_id: args.vehicleId ?? null,
      payload:    args.payload,
      summary:    args.summary,
      created_by: args.userId ?? null,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar rascunho')
  return rowToPendingAction(data)
}

export async function getPendingActionAdmin(id: string): Promise<MCPPendingAction | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('mcp_pending_actions').select('*').eq('id', id).single()
  if (error || !data) return null

  const pendingAction = rowToPendingAction(data)
  if (pendingAction.status === 'pending' && new Date(pendingAction.expiresAt) < new Date()) {
    await markPendingActionStatus(id, 'expired')
    return { ...pendingAction, status: 'expired' }
  }
  return pendingAction
}

export async function markPendingActionStatus(id: string, status: PendingActionStatus): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('mcp_pending_actions').update({ status }).eq('id', id)
}

export async function logMcpAction(args: {
  userId?: string | null
  userName: string
  tool: string
  vehicleId?: string | null
  params: Record<string, unknown>
  result: 'success' | 'error' | 'cancelled'
  errorMessage?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('mcp_action_logs').insert({
    user_id:       args.userId ?? null,
    user_name:     args.userName,
    tool:          args.tool,
    vehicle_id:    args.vehicleId ?? null,
    params:        args.params,
    result:        args.result,
    error_message: args.errorMessage ?? null,
  })
}
