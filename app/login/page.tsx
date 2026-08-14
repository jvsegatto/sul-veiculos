"use client"

import { useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { STORE_NAME, STORE_LOGO_PATH } from '@/lib/constants'

import { BG, SURFACE, SURF2, BORDER, ACCENT, TEXT, MUTED, DANGER } from '@/lib/theme'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Navegação completa (em vez de router.push) — evita falha do fetch
    // RSC do Next.js ao atravessar o rewrite /admin do site principal pra
    // esse projeto, que só acontecia no primeiro login de um navegador novo.
    // `next` é usado pelo fluxo de autorização do conector MCP, pra voltar
    // direto pra tela de consentimento depois do login (só aceita caminho
    // relativo começando com "/", nunca uma URL externa).
    const next = searchParams.get('next')
    window.location.href = next && next.startsWith('/') ? next : '/admin/estoque'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: BG }}
    >
      <motion.div
        className="w-full max-w-sm space-y-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        >
          <Image src={STORE_LOGO_PATH} alt={STORE_NAME} width={56} height={56} className="w-14 h-14 rounded-2xl" priority />
          <div className="text-center">
            <p className="text-[22px] font-black text-white tracking-wider">SPLENDORE</p>
            <p className="text-[12px] font-semibold tracking-[0.2em] uppercase" style={{ color: ACCENT }}>
              Estoque
            </p>
          </div>
        </motion.div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 space-y-5"
          style={{
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          <div>
            <h1 className="text-[18px] font-black" style={{ color: TEXT }}>Entrar</h1>
            <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>Acesso restrito a colaboradores</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: MUTED }}>
                E-mail
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: MUTED }} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-[10px] text-[13px] outline-none border transition-colors"
                  style={{ backgroundColor: SURF2, borderColor: BORDER, color: TEXT, caretColor: ACCENT }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = BORDER)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: MUTED }}>
                Senha
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: MUTED }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-10 rounded-[10px] text-[13px] outline-none border transition-colors"
                  style={{ backgroundColor: SURF2, borderColor: BORDER, color: TEXT, caretColor: ACCENT }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = ACCENT)}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = BORDER)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3"
                  style={{ color: MUTED }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[12px] font-medium" style={{ color: DANGER }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #E2231A 0%, #9c7a24 100%)',
                boxShadow: '0 2px 12px rgba(212,175,55,0.35)',
                color: '#1a1508',
              }}
            >
              {loading && (
                <motion.span
                  className="w-3.5 h-3.5 rounded-full border-2 border-white/30"
                  style={{ borderTopColor: "#fff" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                />
              )}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px]" style={{ color: MUTED }}>
          Somente usuários cadastrados podem acessar
        </p>
      </motion.div>
    </div>
  )
}
