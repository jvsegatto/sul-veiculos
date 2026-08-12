import { notFound } from 'next/navigation'
import { getVehicleById } from '@/lib/actions/vehicles'
import { EditVehicleClient } from './EditVehicleClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditarVeiculoPage({ params }: Props) {
  const { id } = await params
  const { vehicle, canSeeSensitive } = await getVehicleById(id)

  if (!vehicle || !canSeeSensitive) notFound()

  return <EditVehicleClient vehicle={vehicle} />
}
