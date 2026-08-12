import { notFound } from "next/navigation"
import { getPendingAction } from "@/lib/actions/pendingActions"
import { RascunhoClient } from "@/components/vehicles/RascunhoClient"

type Props = {
  params: Promise<{ id: string }>
}

// Sem login exigido de propósito — o ID do rascunho na URL já funciona como
// capability link (só quem recebeu o link exato do Claude acessa). Ver
// lib/actions/pendingActions.ts.
export default async function RascunhoPage({ params }: Props) {
  const { id } = await params
  const { pendingAction } = await getPendingAction(id)

  if (!pendingAction) notFound()

  return <RascunhoClient pendingAction={pendingAction} />
}
