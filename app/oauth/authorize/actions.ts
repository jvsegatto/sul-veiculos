'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAuthorizationCode, getOAuthClient } from '@/lib/mcp/oauthStore'

function str(formData: FormData, key: string): string {
  const v = formData.get(key)
  return typeof v === 'string' ? v : ''
}

export async function approveAuthorization(formData: FormData) {
  const clientId      = str(formData, 'client_id')
  const redirectUri   = str(formData, 'redirect_uri')
  const codeChallenge = str(formData, 'code_challenge')
  const state          = formData.get('state')
  const scope           = formData.get('scope')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = await getOAuthClient(clientId)
  if (!client || !client.redirectUris.includes(redirectUri)) {
    throw new Error('Cliente OAuth inválido ou redirect_uri não autorizado')
  }

  const code = await createAuthorizationCode({
    clientId, userId: user.id, redirectUri, codeChallenge,
    scope: typeof scope === 'string' && scope ? scope : undefined,
  })

  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (typeof state === 'string' && state) url.searchParams.set('state', state)
  redirect(url.toString())
}

export async function denyAuthorization(formData: FormData) {
  const redirectUri = str(formData, 'redirect_uri')
  const state         = formData.get('state')

  const url = new URL(redirectUri)
  url.searchParams.set('error', 'access_denied')
  if (typeof state === 'string' && state) url.searchParams.set('state', state)
  redirect(url.toString())
}
