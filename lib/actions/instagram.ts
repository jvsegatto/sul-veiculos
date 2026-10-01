'use server'

import { requireManagerOrError } from '@/lib/actions/vehicles'
import { publishToInstagram, type PostToInstagramInput as CoreInput } from '@/lib/server/instagram-core'

export type PostToInstagramInput = CoreInput

// Só imagens hospedadas pela própria loja: fotos de veículo no R2 e artes
// geradas no bucket vehicle-images do Supabase (PreviewFinal/PastaVeiculoClient).
function allowedImagePrefixes(): string[] {
  const prefixes: string[] = []
  const r2 = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '')
  if (r2) prefixes.push(`${r2}/`)
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (supabase) prefixes.push(`${supabase}/storage/v1/object/public/vehicle-images/`)
  return prefixes
}

// Endpoint chamável do navegador — exige sessão de manager ativo. O servidor
// MCP publica pelo núcleo (lib/server/instagram-core.ts) depois de validar o
// próprio token.
export async function postToInstagram(
  input: PostToInstagramInput
): Promise<{ postId: string | null; permalink: string | null; error: string | null }> {
  const { error: authError } = await requireManagerOrError()
  if (authError) return { postId: null, permalink: null, error: authError }

  const images = Array.isArray(input?.images) ? input.images : []
  const prefixes = allowedImagePrefixes()
  if (
    images.length === 0 ||
    !images.every((url) => typeof url === 'string' && prefixes.some((p) => url.startsWith(p)))
  ) {
    return { postId: null, permalink: null, error: 'Imagem não permitida pra publicação' }
  }
  if (input.mediaType !== 'story' && input.mediaType !== 'carousel') {
    return { postId: null, permalink: null, error: 'Tipo de publicação inválido' }
  }

  return publishToInstagram({
    images,
    caption: typeof input.caption === 'string' ? input.caption.slice(0, 2200) : '',
    mediaType: input.mediaType,
  })
}
