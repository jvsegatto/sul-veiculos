'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getVehicleById, getUserInfo, type UserInfo } from '@/lib/actions/vehicles'
import type {
  GeneratedMedia,
  GeneratedMediaWithRelations,
  MediaDimensions,
  MediaFolder,
  MediaType,
  Vehicle,
} from '@/lib/types'

// ── DB row → tipo ────────────────────────────────────────────────────────────

function rowToFolder(row: Record<string, unknown>): MediaFolder {
  return {
    id:         row.id          as string,
    vehicleId:  row.vehicle_id   as string,
    folderName: row.folder_name  as string,
    createdAt:  row.created_at   as string,
    updatedAt:  row.updated_at   as string,
  }
}

function rowToMedia(row: Record<string, unknown>): GeneratedMedia {
  return {
    id:           row.id            as string,
    vehicleId:    row.vehicle_id     as string,
    folderId:     row.folder_id      as string,
    mediaType:    row.media_type     as MediaType,
    title:        row.title          as string,
    previewData:  (row.preview_data  as Record<string, unknown>) ?? {},
    caption:      row.caption        as string,
    hashtags:     (row.hashtags      as string[]) ?? [],
    dimensions:   (row.dimensions    as MediaDimensions) ?? { width: 0, height: 0, aspectRatio: '' },
    aspectRatio:  row.aspect_ratio   as string,
    status:       row.status         as GeneratedMedia['status'],
    createdAt:    row.created_at     as string,
    updatedAt:    row.updated_at     as string,
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listAllMedia(filterType?: MediaType): Promise<GeneratedMediaWithRelations[]> {
  const supabase = await createClient()

  let query = supabase
    .from('generated_media')
    .select('*, vehicle:vehicles(name, images, thumbnails, image_url), folder:media_folders(folder_name)')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (filterType) query = query.eq('media_type', filterType)

  const { data, error } = await query
  if (error || !data) return []

  return data.map((row: Record<string, unknown>) => {
    const vehicle = row.vehicle as { name?: string; images?: string[]; thumbnails?: string[]; image_url?: string } | null
    return {
      ...rowToMedia(row),
      vehicleName:  vehicle?.name ?? '',
      folderName:   (row.folder as { folder_name?: string } | null)?.folder_name ?? '',
      // thumb pro card da Central de Mídias (listagem) — cai pra full se o
      // veículo não tiver thumbnail (cadastrado antes do R2).
      vehicleImage: vehicle?.thumbnails?.[0] || vehicle?.images?.[0] || vehicle?.image_url || '',
    }
  })
}

export async function getOrCreateFolder(
  vehicleId: string,
  vehicleModel: string
): Promise<{ folder: MediaFolder | null; error: string | null }> {
  const supabase = await createClient()

  const { data: existing, error: lookupError } = await supabase
    .from('media_folders')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .maybeSingle()

  if (lookupError) return { folder: null, error: lookupError.message }
  if (existing) return { folder: rowToFolder(existing), error: null }

  const folderName = `Mídias ${vehicleModel}`
  const { data, error } = await supabase
    .from('media_folders')
    .insert({ vehicle_id: vehicleId, folder_name: folderName })
    .select()
    .single()

  if (error || !data) return { folder: null, error: error?.message ?? 'Erro ao criar pasta de mídias' }
  return { folder: rowToFolder(data), error: null }
}

export type CreateMediaInput = {
  vehicleId: string
  vehicleModel: string
  mediaType: MediaType
  title: string
  previewData: Record<string, unknown>
  caption: string
  hashtags: string[]
  dimensions: MediaDimensions
}

export async function createGeneratedMedia(
  input: CreateMediaInput
): Promise<{ media: GeneratedMedia | null; folder: MediaFolder | null; error: string | null }> {
  const { folder, error: folderError } = await getOrCreateFolder(input.vehicleId, input.vehicleModel)
  if (!folder) return { media: null, folder: null, error: folderError ?? 'Erro ao criar pasta de mídias' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('generated_media')
    .insert({
      vehicle_id:   input.vehicleId,
      folder_id:    folder.id,
      media_type:   input.mediaType,
      title:        input.title,
      preview_data: input.previewData,
      caption:      input.caption,
      hashtags:     input.hashtags,
      dimensions:   input.dimensions,
      aspect_ratio: input.dimensions.aspectRatio,
      status:       'saved',
    })
    .select()
    .single()

  if (error || !data) return { media: null, folder, error: error?.message ?? 'Erro ao salvar mídia' }

  revalidatePath('/midias')
  return { media: rowToMedia(data), folder, error: null }
}

export async function getFolderWithMedia(folderId: string): Promise<{
  folder: MediaFolder | null
  vehicle: Vehicle | null
  media: GeneratedMedia[]
}> {
  const supabase = await createClient()

  const { data: folderRow } = await supabase.from('media_folders').select('*').eq('id', folderId).single()
  if (!folderRow) return { folder: null, vehicle: null, media: [] }

  const folder = rowToFolder(folderRow)
  const { vehicle } = await getVehicleById(folder.vehicleId)

  const { data: mediaRows } = await supabase
    .from('generated_media')
    .select('*')
    .eq('folder_id', folderId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  return { folder, vehicle, media: (mediaRows ?? []).map(rowToMedia) }
}

// Apaga a linha de verdade — nada de gerado é guardado em storage (o PNG é
// montado no navegador na hora do download), então não sobra lixo pra limpar
// além dessa linha. Usa o admin client (bypassa RLS) igual às outras mutações
// privilegiadas em vehicles.ts, já que não existe policy de DELETE.
export async function deleteGeneratedMedia(
  id: string,
  opts: { userInfo?: UserInfo } = {}
): Promise<{ error: string | null }> {
  const userInfo = opts.userInfo ?? await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') return { error: 'Sem permissão' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('generated_media').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/midias')
  return { error: null }
}
