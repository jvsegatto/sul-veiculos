import { getVehicles } from '@/lib/actions/vehicles'
import { NovaMidiaWizard } from '@/components/midias/NovaMidiaWizard'

// Publicar um carrossel no Instagram cria+espera um container por foto, sequencialmente —
// pode passar dos 10s padrão da Vercel com várias fotos.
export const maxDuration = 60

export default async function NovaMidiaPage() {
  const { vehicles } = await getVehicles()
  // Não faz sentido gerar mídia comercial pra um carro já vendido ou reservado.
  const disponiveis = vehicles.filter((v) => v.status === 'disponivel')
  return <NovaMidiaWizard vehicles={disponiveis} />
}
