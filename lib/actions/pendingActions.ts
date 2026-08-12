'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { processAndUploadImage } from '@/lib/uploads/r2'
import type { MCPPendingAction } from '@/lib/mcp/types'

function rowToPendingAction(row: Record<string, unknown>): MCPPendingAction {
  return {
    id:        row.id as string,
    kind:      row.kind as MCPPendingAction['kind'],
    vehicleId: (row.vehicle_id as string) || null,
    payload:   (row.payload as Record<string, unknown>) ?? {},
    summary:   row.summary as string,
    createdBy: (row.created_by as string) || null,
    status:    row.status as MCPPendingAction['status'],
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  }
}

// Usado pela página /estoque/rascunhos/[id] — de propósito SEM exigir login:
// o ID do rascunho (uuid v4, 122 bits) já funciona como capability link —
// só quem recebeu o link exato do Claude consegue acessar. Por isso usa o
// client admin direto (RLS de mcp_pending_actions não libera leitura sem
// sessão). Só expõe os campos já pensados pra serem públicos (resumo, dados
// do veículo proposto, fotos) — nada de credencial ou dado de outro veículo.
export async function getPendingAction(
  id: string
): Promise<{ pendingAction: MCPPendingAction | null; error: string | null }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('mcp_pending_actions').select('*').eq('id', id).single()
  if (error || !data) return { pendingAction: null, error: error?.message ?? 'Rascunho não encontrado' }
  return { pendingAction: rowToPendingAction(data), error: null }
}

// Substitui a lista de fotos do rascunho (payload.images/thumbnails) pela
// lista completa vinda do PhotoManager (já reordenada/com remoções
// aplicadas). Mesma lógica de capability link da função acima — sem
// checagem de sessão, só valida que o rascunho existe e ainda está
// pendente antes de gravar.
export async function setDraftImages(
  id: string,
  images: string[],
  thumbnails: string[]
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { data: existing, error: fetchError } = await supabase
    .from('mcp_pending_actions')
    .select('payload, status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return { error: fetchError?.message ?? 'Rascunho não encontrado' }
  if (existing.status !== 'pending') return { error: 'Esse rascunho não está mais pendente de confirmação' }

  const payload = (existing.payload as Record<string, unknown>) ?? {}
  const { error } = await supabase
    .from('mcp_pending_actions')
    .update({ payload: { ...payload, images, thumbnails } })
    .eq('id', id)

  return { error: error?.message ?? null }
}

// Upload de foto pra um rascunho sem sessão de navegador — a página
// /estoque/rascunhos/[id] não exige login (ver proxy.ts), então não dá pra
// exigir a sessão de manager que /api/upload pede. Faz a mesma checagem que
// setDraftImages (rascunho existe e ainda pendente) antes de processar e
// subir pro R2 com o mesmo helper que a rota autenticada usa.
export async function uploadDraftPhoto(
  pendingActionId: string,
  formData: FormData
): Promise<{ fullUrl: string | null; thumbUrl: string | null; error: string | null }> {
  try {
    const file = formData.get('file')
    if (!(file instanceof File)) return { fullUrl: null, thumbUrl: null, error: 'Nenhum arquivo enviado' }

    const supabase = createAdminClient()
    const { data: existing, error: fetchError } = await supabase
      .from('mcp_pending_actions')
      .select('status')
      .eq('id', pendingActionId)
      .single()

    if (fetchError || !existing) return { fullUrl: null, thumbUrl: null, error: 'Rascunho não encontrado' }
    if (existing.status !== 'pending') {
      return { fullUrl: null, thumbUrl: null, error: 'Esse rascunho não está mais pendente de confirmação' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const baseName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const { fullUrl, thumbUrl } = await processAndUploadImage(buffer, baseName)
    return { fullUrl, thumbUrl, error: null }
  } catch (err) {
    return { fullUrl: null, thumbUrl: null, error: err instanceof Error ? err.message : 'Erro ao enviar foto' }
  }
}
