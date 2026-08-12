'use server'

const GRAPH_BASE = 'https://graph.instagram.com/v21.0'

function getCredentials() {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  const igUserId = process.env.META_IG_USER_ID
  if (!token || !igUserId) throw new Error('Credenciais da Meta não configuradas no servidor')
  return { token, igUserId }
}

async function graphPost(path: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
  return data
}

async function graphGet(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString()
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
  return data
}

async function waitUntilFinished(containerId: string, token: string, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { status_code } = await graphGet(containerId, { fields: 'status_code' }, token)
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR') throw new Error(`Container ${containerId} entrou em estado ERROR`)
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Container ${containerId} não ficou pronto em ${timeoutMs / 1000}s`)
}

export type PostToInstagramInput = {
  images: string[]
  caption: string
  mediaType: 'story' | 'carousel'
}

export async function postToInstagram(
  input: PostToInstagramInput
): Promise<{ postId: string | null; permalink: string | null; error: string | null }> {
  try {
    const { token, igUserId } = getCredentials()

    let creationId: string
    if (input.mediaType === 'story') {
      const { id } = await graphPost(`${igUserId}/media`, { image_url: input.images[0], media_type: 'STORIES' }, token)
      await waitUntilFinished(id, token)
      creationId = id
    } else {
      if (input.images.length > 10) throw new Error('Instagram permite no máximo 10 imagens por carrossel')
      const childIds: string[] = []
      for (const imageUrl of input.images) {
        const { id } = await graphPost(`${igUserId}/media`, { image_url: imageUrl, is_carousel_item: true }, token)
        await waitUntilFinished(id, token)
        childIds.push(id)
      }
      const { id } = await graphPost(
        `${igUserId}/media`,
        { media_type: 'CAROUSEL', children: childIds.join(','), caption: input.caption },
        token
      )
      await waitUntilFinished(id, token)
      creationId = id
    }

    const { id: postId } = await graphPost(`${igUserId}/media_publish`, { creation_id: creationId }, token)
    const permalinkRes = await graphGet(postId, { fields: 'permalink' }, token).catch(() => ({ permalink: null }))
    return { postId, permalink: permalinkRes.permalink ?? null, error: null }
  } catch (err) {
    return { postId: null, permalink: null, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}
