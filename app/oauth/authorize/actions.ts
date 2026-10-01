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

  // Mesma regra da página de consentimento: action é endpoint POST próprio,
  // então revalida aqui em vez de confiar que só a página chama.
  const { data: profile } = await supabase.from('profiles').select('role, active').eq('id', user.id).single()
  if (!profile || !profile.active || profile.role === 'VENDEDOR') {
    throw new Error('Sua conta não tem permissão pra autorizar esse conector')
  }

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
  const clientId    = str(formData, 'client_id')
  const redirectUri = str(formData, 'redirect_uri')
  const state         = formData.get('state')

  // Sem isso, qualquer redirect_uri virava redirecionamento aberto a partir
  // do domínio do painel (usável em phishing).
  const client = await getOAuthClient(clientId)
  if (!client || !client.redirectUris.includes(redirectUri)) redirect('/estoque')

  const url = new URL(redirectUri)
  url.searchParams.set('error', 'access_denied')
  if (typeof state === 'string' && state) url.searchParams.set('state', state)
  redirect(url.toString())
}
