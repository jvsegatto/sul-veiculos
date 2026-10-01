'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Vehicle } from '@/lib/types'
import type { UserRole } from '@/lib/constants'
import {
  isManager,
  listVehicles,
  findVehicleById,
  insertVehicle,
  patchVehicle,
  setVehicleSold,
  setVehicleAvailable,
  archiveVehicleRow,
  type UserInfo as CoreUserInfo,
  type VehicleFormInput as CoreVehicleFormInput,
} from '@/lib/server/vehicles-core'

// Toda função exportada daqui é um endpoint POST chamável do navegador, com
// argumentos controlados por quem chama. Por isso NENHUMA delas aceita
// identidade ou "modo admin" por parâmetro: a identidade vem sempre da sessão
// de cookie (getUserInfo). O servidor MCP, que não tem sessão de navegador,
// usa direto o núcleo em lib/server/vehicles-core.ts.

export type UserInfo = CoreUserInfo
export type VehicleFormInput = CoreVehicleFormInput

// ── Auth / user ───────────────────────────────────────────────────────────────

export async function getUserInfo(): Promise<UserInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role, name, active')
    .eq('id', user.id)
    .single()

  // Usuário desativado no painel perde acesso a qualquer ação na hora,
  // mesmo com a sessão de login ainda válida.
  if (!data || !data.active) return null
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
  if (!isManager(userInfo)) redirect('/estoque')
  return userInfo
}

export async function requireManagerOrError(): Promise<{ userInfo: UserInfo | null; error: string | null }> {
  const userInfo = await getUserInfo()
  if (!isManager(userInfo)) return { userInfo: null, error: 'Sem permissão' }
  return { userInfo, error: null }
}

// ── Queries ───────────────────────────────────────────────────────────────────

// Sempre pelo client de cookies — a RLS do Supabase filtra o que a sessão vê.
export async function getVehicles(): Promise<{
  vehicles:        Vehicle[]
  canSeeSensitive: boolean
  userInfo:        UserInfo | null
}> {
  const userInfo = await getUserInfo()
  if (!userInfo) return { vehicles: [], canSeeSensitive: false, userInfo: null }

  const vehicles = await listVehicles(await createClient())
  return { vehicles, canSeeSensitive: userInfo.role !== 'VENDEDOR', userInfo }
}

export async function getVehicleById(id: string): Promise<{
  vehicle:         Vehicle | null
  canSeeSensitive: boolean
  userInfo:        UserInfo | null
}> {
  const userInfo = await getUserInfo()
  if (!userInfo) return { vehicle: null, canSeeSensitive: false, userInfo: null }

  const vehicle = await findVehicleById(await createClient(), id)
  if (!vehicle) return { vehicle: null, canSeeSensitive: false, userInfo }
  return { vehicle, canSeeSensitive: userInfo.role !== 'VENDEDOR', userInfo }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createVehicle(
  input: VehicleFormInput
): Promise<{ vehicle: Vehicle | null; error: string | null }> {
  if (!isManager(await getUserInfo())) return { vehicle: null, error: 'Sem permissão' }
  return insertVehicle(await createClient(), input)
}

export async function updateVehicleAction(
  id:    string,
  input: Partial<VehicleFormInput>
): Promise<{ vehicle: Vehicle | null; error: string | null }> {
  if (!isManager(await getUserInfo())) return { vehicle: null, error: 'Sem permissão' }
  return patchVehicle(await createClient(), id, input)
}

export async function markAsSold(id: string): Promise<{ error: string | null }> {
  if (!isManager(await getUserInfo())) return { error: 'Sem permissão' }
  return setVehicleSold(id)
}

export async function markAsAvailable(id: string): Promise<{ error: string | null }> {
  if (!isManager(await getUserInfo())) return { error: 'Sem permissão' }
  return setVehicleAvailable(id)
}

export async function archiveVehicle(id: string): Promise<{ error: string | null }> {
  if (!isManager(await getUserInfo())) return { error: 'Sem permissão' }
  return archiveVehicleRow(id)
}
