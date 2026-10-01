import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Vehicle, VehicleStatus } from '@/lib/types'
import type { UserRole } from '@/lib/constants'

// Núcleo das operações de veículo, SEM checagem de permissão. De propósito
// fora de um arquivo 'use server': toda função exportada de 'use server' vira
// endpoint POST chamável do navegador com argumentos livres. Quem chama daqui
// (lib/actions/vehicles.ts e o servidor MCP) é responsável por validar a
// identidade antes — as actions via getUserInfo() (sessão de cookie), o MCP
// via token Bearer (resolveMcpUser).

export type UserInfo = { userId: string; role: UserRole; name: string }

export type VehicleFormInput = Omit<Vehicle, 'id' | 'createdAt' | 'archivedAt'>

export function isManager(userInfo: UserInfo | null): userInfo is UserInfo {
  return !!userInfo && userInfo.role !== 'VENDEDOR'
}

// ── DB row → Vehicle ──────────────────────────────────────────────────────────

export function rowToVehicle(row: Record<string, unknown>): Vehicle {
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

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listVehicles(supabase: SupabaseClient): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map((row) => rowToVehicle(row as Record<string, unknown>))
}

export async function findVehicleById(supabase: SupabaseClient, id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .is('archived_at', null)
    .single()

  if (error || !data) return null
  return rowToVehicle(data as Record<string, unknown>)
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function insertVehicle(
  supabase: SupabaseClient,
  input: VehicleFormInput
): Promise<{ vehicle: Vehicle | null; error: string | null }> {
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

export async function patchVehicle(
  supabase: SupabaseClient,
  id:       string,
  input:    Partial<VehicleFormInput>
): Promise<{ vehicle: Vehicle | null; error: string | null }> {
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

// Status/arquivamento sempre pelo service role (não existe policy de UPDATE
// pra esses campos isolados) — por isso só chamar depois de checar permissão.
async function setVehicleStatus(id: string, update: Record<string, unknown>): Promise<{ error: string | null }> {
  const { data, error } = await createAdminClient()
    .from('vehicles')
    .update(update)
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Não foi possível atualizar o veículo (registro não encontrado)' }
  revalidatePath('/estoque')
  revalidatePath(`/estoque/${id}`)
  return { error: null }
}

export function setVehicleSold(id: string) {
  return setVehicleStatus(id, { status: 'vendido', sold_at: new Date().toISOString() })
}

export function setVehicleAvailable(id: string) {
  return setVehicleStatus(id, { status: 'disponivel', sold_at: null })
}

export async function archiveVehicleRow(id: string): Promise<{ error: string | null }> {
  const { error, count } = await createAdminClient()
    .from('vehicles')
    .update({ archived_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)

  if (error) return { error: error.message }
  if (!count) return { error: 'Não foi possível apagar o veículo (registro não encontrado)' }
  revalidatePath('/estoque')
  return { error: null }
}
