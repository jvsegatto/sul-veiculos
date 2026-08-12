import { listAllMedia } from '@/lib/actions/media'
import { MidiasClient } from '@/components/midias/MidiasClient'

export default async function MidiasPage() {
  const media = await listAllMedia()
  return <MidiasClient media={media} />
}
