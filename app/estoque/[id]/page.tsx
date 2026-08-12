import { notFound } from 'next/navigation'
import { getVehicleById } from '@/lib/actions/vehicles'
import { VehicleDetailClient } from './VehicleDetailClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function VeiculoDetalhePage({ params }: Props) {
  const { id } = await params
  const { vehicle, canSeeSensitive, userInfo } = await getVehicleById(id)

  if (!vehicle) notFound()

  return (
    <VehicleDetailClient
      vehicle={vehicle}
      canSeeSensitive={canSeeSensitive}
      userInfo={userInfo}
    />
  )
}
