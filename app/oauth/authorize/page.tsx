import { redirect } from "next/navigation"
import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getOAuthClient } from "@/lib/mcp/oauthStore"
import { STORE_NAME, STORE_LOGO_PATH } from "@/lib/constants"
import { approveAuthorization, denyAuthorization } from "./actions"

import { BG, SURFACE, SURF2, BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

type Props = {
  searchParams: Promise<Record<string, string | undefined>>
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: BG }}>
      <div className="w-full max-w-sm rounded-2xl p-7 space-y-3" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
        <h1 className="text-[16px] font-black" style={{ color: TEXT }}>{title}</h1>
        <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>{message}</p>
      </div>
    </div>
  )
}

export default async function AuthorizePage({ searchParams }: Props) {
  const params = await searchParams
  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    state,
    scope,
  } = params

  if (responseType !== "code" || !clientId || !redirectUri || !codeChallenge) {
    return <ErrorScreen title="Pedido de autorização inválido" message="Faltam parâmetros obrigatórios (response_type, client_id, redirect_uri, code_challenge)." />
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return <ErrorScreen title="Método de PKCE não suportado" message="Esse servidor só aceita code_challenge_method=S256." />
  }

  const client = await getOAuthClient(clientId)
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return <ErrorScreen title="Conector não reconhecido" message="Esse client_id ou redirect_uri não está autorizado nesse servidor." />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // O valor de "next" é lido cru pelo login (window.location.href = next),
    // sem passar pelo router do Next — então precisa já vir com o basePath
    // "/admin" embutido, já que aqui não tem prepend automático nenhum.
    const next = `/admin/oauth/authorize?${new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString()}`
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const { data: profile } = await supabase.from("profiles").select("role, name, active").eq("id", user.id).single()
  if (!profile || profile.role === "VENDEDOR" || !profile.active) {
    return (
      <ErrorScreen
        title="Sem permissão"
        message="Sua conta não tem permissão pra autorizar esse conector. Fale com o administrador da loja."
      />
    )
  }
  const userName = profile.name || user.email || "Usuário"

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: BG }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src={STORE_LOGO_PATH} alt={STORE_NAME} width={56} height={56} className="w-14 h-14 rounded-2xl" priority />
        </div>

        <div className="rounded-2xl p-7 space-y-5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
            <div>
              <h1 className="text-[16px] font-black" style={{ color: TEXT }}>Autorizar conector</h1>
              <p className="text-[13px] mt-1 leading-relaxed" style={{ color: MUTED }}>
                <strong style={{ color: TEXT }}>{client.clientName}</strong> quer se conectar ao painel
                administrativo da <strong style={{ color: TEXT }}>{STORE_NAME}</strong>, em nome de{" "}
                <strong style={{ color: TEXT }}>{userName}</strong>.
              </p>
            </div>
          </div>

          <div className="rounded-xl p-3 text-[12px] space-y-1.5" style={{ backgroundColor: SURF2, color: MUTED }}>
            <p>Vai poder, sempre com sua confirmação prévia pra ações que mudam algo:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Listar e buscar veículos do estoque</li>
              <li>Propor cadastro, edição e remoção de veículos</li>
              <li>Marcar veículos como vendidos/disponíveis e definir destaque</li>
              <li>Gerar e publicar posts no Instagram da loja</li>
            </ul>
          </div>

          <form className="flex gap-2">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            {state && <input type="hidden" name="state" value={state} />}
            {scope && <input type="hidden" name="scope" value={scope} />}

            <button
              type="submit"
              formAction={denyAuthorization}
              className="flex-1 h-10 rounded-xl text-[13px] font-bold transition-colors hover:bg-white/5"
              style={{ color: MUTED, border: `1px solid ${BORDER}` }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              formAction={approveAuthorization}
              className="flex-1 h-10 rounded-xl text-[13px] font-bold transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #CE9E49 0%, #9c7a24 100%)", boxShadow: "0 2px 12px rgba(212,175,55,0.35)", color: "#1a1508" }}
            >
              Autorizar
            </button>
          </form>
        </div>

        <p className="text-center text-[11px]" style={{ color: MUTED }}>
          Você pode revogar esse acesso a qualquer momento falando com o administrador.
        </p>
      </div>
    </div>
  )
}
