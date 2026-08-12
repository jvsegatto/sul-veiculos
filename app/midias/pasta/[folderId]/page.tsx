import { notFound } from 'next/navigation'
import { getFolderWithMedia } from '@/lib/actions/media'
import { PastaVeiculoClient } from '@/components/midias/PastaVeiculoClient'

type Props = {
  params: Promise<{ folderId: string }>
}

export default async function PastaVeiculoPage({ params }: Props) {
  const { folderId } = await params
  const { folder, vehicle, media } = await getFolderWithMedia(folderId)

  if (!folder || !vehicle) notFound()

  return <PastaVeiculoClient folder={folder} vehicle={vehicle} media={media} />
}
