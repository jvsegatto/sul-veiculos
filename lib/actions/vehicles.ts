'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Vehicle, VehicleStatus } from '@/lib/types'
import type { UserRole } from '@/lib/constants'

export type UserInfo = { userId: string; role: UserRole; name: string }

// ── DB row → Vehicle ──────────────────────────────────────────────────────────

function rowToVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id:           row.id           as string,
    name:         row.name         as string,
    brand:        row.brand        as string,
    model:        row.model        as string,
    year:         row.year         as number,
    yearModel:    (row.year_model  as number) || undefined,
    km:           row.km           as number,
    color:        (row.color        as string) ?? '',
    category:     (row.category     as string) ?? '',
    transmission: (row.transmission as string) ?? '',
    fuel:         (row.fuel         as string) ?? '',
    doors:        (row.doors        as number) ?? 4,
    motor:        (row.motor        as string) ?? '',
    optionals:    (row.optionals    as string[]) ?? [],
    isPremium:    (row.is_premium   as boolean) ?? false,
    isNew:        (row.is_new       as boolean) ?? false,
    images:       (row.images       as string[]) ?? [],
    thumbnails:   (row.thumbnails   as string[]) ?? [],
    imageUrl:     (row.image_url    as string) ?? '',
    price:        Number(row.price),
    status:       row.status        as VehicleStatus,
    createdAt:    row.created_at    as string,
    acquiredAt:   (row.acquired_at  as string) ?? (row.created_at as string),
    soldAt:       (row.sold_at      as string) || undefined,
    archivedAt:   (row.archived_at  as string) || undefined,
  }
}

// ── Auth / user ───────────────────────────────────────────────────────────────

export async function getUserInfo(): Promise<UserInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return {
    userId: user.id,
    role:   data.role as UserRole,
    name:   (data.name as string) ?? user.email ?? 'Usuário',
  }
}

// Guard de página inteira — usar em Server Components de rotas restritas a
// managers (ex: app/estoque/rascunhos/[id]/page.tsx). Bloqueia VENDEDOR antes
// de qualquer render client.
export async function requireManagerOrRedirect(): Promise<UserInfo> {
  const userInfo = await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') redirect('/estoque')
  return userInfo
}

// Mesma checagem, mas pra ser usada fora de Server Components (ex: handlers
// do servidor MCP) — redirect() do Next só funciona em Server Component ou
// navegação real.
export async function requireManagerOrError(): Promise<{ userInfo: UserInfo | null; error: string | null }> {
  const userInfo = await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') return { userInfo: null, error: 'Sem permissão' }
  return { userInfo, error: null }
}

// ── Queries ───────────────────────────────────────────────────────────────────

// `opts.admin` usa o service role em vez do client de cookies — necessário
// pra chamadas vindas do servidor MCP, que não têm sessão de navegador.
export async function getVehicles(opts: { admin?: boolean } = {}): Promise<{
  vehicles:        Vehicle[]
  canSeeSensitive: boolean
  userInfo:        UserInfo | null
}> {
  const supabase  = opts.admin ? createAdminClient() : await createClient()
  const userInfo  = await getUserInfo()

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return { vehicles: [], canSeeSensitive: false, userInfo }

  const canSeeSensitive = userInfo?.role !== 'VENDEDOR'
  const vehicles = data.map((row) => rowToVehicle(row as Record<string, unknown>))

  return { vehicles, canSeeSensitive, userInfo }
}

export async function getVehicleById(id: string, opts: { admin?: boolean } = {}): Promise<{
  vehicle:         Vehicle | null
  canSeeSensitive: boolean
  userInfo:        UserInfo | null
}> {
  const supabase = opts.admin ? createAdminClient() : await createClient()
  const userInfo = await getUserInfo()

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .is('archived_at', null)
    .single()

  if (error || !data) return { vehicle: null, canSeeSensitive: false, userInfo }

  const canSeeSensitive = userInfo?.role !== 'VENDEDOR'
  const vehicle = rowToVehicle(data as Record<string, unknown>)

  return { vehicle, canSeeSensitive, userInfo }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type VehicleFormInput = Omit<Vehicle, 'id' | 'createdAt' | 'archivedAt'>

// `opts.userInfo` permite injetar uma identidade já resolvida (ex: pelo
// servidor MCP, que não tem sessão de cookies pra chamar getUserInfo()) —
// nesse caso também usa o service role pra escrever, já que o client de
// cookies não teria uma sessão autenticada pra passar a policy de INSERT.
export async function createVehicle(
  input: VehicleFormInput,
  opts: { userInfo?: UserInfo } = {}
): Promise<{ vehicle: Vehicle | null; error: string | null }> {
  const userInfo  = opts.userInfo ?? await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') {
    return { vehicle: null, error: 'Sem permissão' }
  }
  const supabase = opts.userInfo ? createAdminClient() : await createClient()

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      name:         input.name,
      brand:        input.brand,
      model:        input.model,
      year:         input.year,
      year_model:   input.yearModel ?? null,
      km:           input.km,
      color:        input.color,
      category:     input.category,
      transmission: input.transmission,
      fuel:         input.fuel,
      doors:        input.doors,
      motor:        input.motor,
      optionals:    input.optionals,
      is_premium:   input.isPremium,
      is_new:       input.isNew,
      images:       input.images,
      thumbnails:   input.thumbnails,
      image_url:    input.imageUrl,
      price:        input.price,
      status:       input.status,
      acquired_at:  input.acquiredAt,
      ...(input.soldAt ? { sold_at: input.soldAt } : {}),
    })
    .select()
    .single()

  if (error || !data) return { vehicle: null, error: error?.message ?? 'Erro ao criar veículo' }

  revalidatePath('/estoque')
  return { vehicle: rowToVehicle(data as Record<string, unknown>), error: null }
}

export async function updateVehicleAction(
  id:    string,
  input: Partial<VehicleFormInput>,
  opts: { userInfo?: UserInfo } = {}
): Promise<{ vehicle: Vehicle | null; error: string | null }> {
  const userInfo = opts.userInfo ?? await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') {
    return { vehicle: null, error: 'Sem permissão' }
  }
  const supabase = opts.userInfo ? createAdminClient() : await createClient()

  const patch: Record<string, unknown> = {}
  if (input.name         !== undefined) patch.name         = input.name
  if (input.brand        !== undefined) patch.brand        = input.brand
  if (input.model        !== undefined) patch.model        = input.model
  if (input.year         !== undefined) patch.year         = input.year
  if (input.yearModel    !== undefined) patch.year_model   = input.yearModel ?? null
  if (input.km           !== undefined) patch.km           = input.km
  if (input.color        !== undefined) patch.color        = input.color
  if (input.category     !== undefined) patch.category     = input.category
  if (input.transmission !== undefined) patch.transmission = input.transmission
  if (input.fuel         !== undefined) patch.fuel         = input.fuel
  if (input.doors        !== undefined) patch.doors        = input.doors
  if (input.motor        !== undefined) patch.motor        = input.motor
  if (input.optionals    !== undefined) patch.optionals    = input.optionals
  if (input.isPremium    !== undefined) patch.is_premium   = input.isPremium
  if (input.isNew        !== undefined) patch.is_new       = input.isNew
  if (input.images       !== undefined) patch.images       = input.images
  if (input.thumbnails   !== undefined) patch.thumbnails   = input.thumbnails
  if (input.imageUrl     !== undefined) patch.image_url    = input.imageUrl
  if (input.price        !== undefined) patch.price        = input.price
  if (input.status       !== undefined) patch.status       = input.status
  if (input.acquiredAt   !== undefined) patch.acquired_at  = input.acquiredAt
  if (input.soldAt       !== undefined) patch.sold_at      = input.soldAt

  const { data, error } = await supabase
    .from('vehicles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return { vehicle: null, error: error?.message ?? 'Erro ao atualizar' }

  revalidatePath('/estoque')
  revalidatePath(`/estoque/${id}`)
  return { vehicle: rowToVehicle(data as Record<string, unknown>), error: null }
}

export async function markAsSold(id: string, opts: { userInfo?: UserInfo } = {}): Promise<{ error: string | null }> {
  const userInfo = opts.userInfo ?? await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') return { error: 'Sem permissão' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vehicles')
    .update({ status: 'vendido', sold_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Não foi possível atualizar o veículo (registro não encontrado)' }
  revalidatePath('/estoque')
  revalidatePath(`/estoque/${id}`)
  return { error: null }
}

export async function markAsAvailable(id: string, opts: { userInfo?: UserInfo } = {}): Promise<{ error: string | null }> {
  const userInfo = opts.userInfo ?? await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') return { error: 'Sem permissão' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vehicles')
    .update({ status: 'disponivel', sold_at: null })
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Não foi possível atualizar o veículo (registro não encontrado)' }
  revalidatePath('/estoque')
  revalidatePath(`/estoque/${id}`)
  return { error: null }
}

export async function archiveVehicle(id: string, opts: { userInfo?: UserInfo } = {}): Promise<{ error: string | null }> {
  const userInfo = opts.userInfo ?? await getUserInfo()
  if (!userInfo || userInfo.role === 'VENDEDOR') return { error: 'Sem permissão' }

  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('vehicles')
    .update({ archived_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)

  if (error) return { error: error.message }
  if (!count) return { error: 'Não foi possível apagar o veículo (registro não encontrado)' }
  revalidatePath('/estoque')
  return { error: null }
}
