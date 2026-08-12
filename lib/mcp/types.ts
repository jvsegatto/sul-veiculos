export type PendingActionKind = "criar" | "editar" | "remover" | "publicar"
export type PendingActionStatus = "pending" | "confirmed" | "cancelled" | "expired"

export type MCPPendingAction = {
  id: string
  kind: PendingActionKind
  vehicleId: string | null
  payload: Record<string, unknown>
  summary: string
  createdBy: string | null
  status: PendingActionStatus
  createdAt: string
  expiresAt: string
}
