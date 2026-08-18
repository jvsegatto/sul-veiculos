"use client"

import { type ReactNode, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { LogOut, Menu, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { STORE_NAME, STORE_LOGO_PATH } from "@/lib/constants"

const NAV = [
  { href: "/estoque",      label: "Estoque" },
  { href: "/estoque/novo", label: "Novo carro" },
  { href: "/midias",       label: "Central de Mídias" },
]

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Render plain children no login, nas telas de OAuth do conector MCP (tela
  // de consentimento é pra um cliente externo) e no link de upload de fotos
  // de rascunho (acessível sem login — não faz sentido mostrar a nav normal
  // do painel pra quem pode estar ali sem sessão nenhuma).
  if (
    pathname === '/login' ||
    pathname.startsWith('/oauth/') ||
    pathname.startsWith('/estoque/rascunhos/')
  ) {
    return <>{children}</>
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setUserName(data?.name ?? user.email?.split('@')[0] ?? 'BV')
        })
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'BV'

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
      <motion.header
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-6"
        style={{ height: "64px", backgroundColor: "#181818", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Logo */}
        <Link href="/estoque" className="flex items-center gap-3 shrink-0">
          <Image src={STORE_LOGO_PATH} alt={STORE_NAME} width={36} height={36} className="w-9 h-9" priority />
          <div className="leading-none">
            <p className="text-[15px] font-black text-white tracking-wider">SUL VEÍCULOS</p>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: "#E2231A", marginTop: "3px" }}>
              Estoque
            </p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1 ml-6">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/estoque"
                ? pathname === href || (pathname.startsWith("/estoque/") && pathname !== "/estoque/novo")
                : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className="relative px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors"
                style={{ color: active ? "#fff" : "#777777" }}
              >
                {active && (
                  <motion.span
                    layoutId="navActivePill"
                    className="absolute inset-0 rounded-lg -z-10"
                    style={{ backgroundColor: "#E2231A" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors"
          style={{ backgroundColor: mobileMenuOpen ? "rgba(29,63,214,0.15)" : "rgba(255,255,255,0.06)", color: mobileMenuOpen ? "#E2231A" : "#fff" }}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/5"
          style={{ color: "#777777", border: "1px solid rgba(255,255,255,0.08)" }}
          title="Sair"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </button>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{
            background:  "#1d3fd6",
            boxShadow:   "0 0 0 2px rgba(29,63,214,0.25)",
          }}
          title={userName ?? undefined}
        >
          <span className="text-[11px] font-black text-white select-none">{initials}</span>
        </div>
      </motion.header>

      {/* Menu mobile — fora do <main> de propósito, senão a transição de página
          (motion.div com transform) cria um containing block novo e o painel
          "fixed" deixa de cobrir corretamente a tela. */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="sm:hidden fixed left-0 right-0 z-40 px-4 py-3 space-y-1"
            style={{ top: "64px", backgroundColor: "#181818", borderBottom: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 12px 24px rgba(0,0,0,0.4)" }}
          >
            {NAV.map(({ href, label }) => {
              const active =
                href === "/estoque"
                  ? pathname === href || (pathname.startsWith("/estoque/") && pathname !== "/estoque/novo")
                  : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className="block px-3.5 py-2.5 rounded-lg text-[14px] font-semibold transition-colors"
                  style={{ backgroundColor: active ? "#E2231A" : "transparent", color: active ? "#fff" : "#cccccc" }}
                >
                  {label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[14px] font-semibold text-left transition-colors"
              style={{ color: "#777777" }}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main style={{ paddingTop: "64px" }}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
