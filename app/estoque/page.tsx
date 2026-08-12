import { getVehicles } from '@/lib/actions/vehicles'
import { EstoqueClient } from '@/components/estoque/EstoqueClient'

export default async function EstoquePage() {
  const { vehicles, userInfo } = await getVehicles()
  return (
    <EstoqueClient
      vehicles={vehicles}
      userInfo={userInfo}
    />
  )
}
