"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Car, Plus, Search, X } from 'lucide-react'
import { VehicleCard } from '@/components/vehicles/VehicleCard'
import { Pagination } from '@/components/ui/Pagination'
import { CATEGORIES } from '@/lib/constants'
import { maskCurrencyInput, parseCurrencyInput } from '@/lib/format'
import type { Vehicle } from '@/lib/types'
import type { UserInfo } from '@/lib/actions/vehicles'

const PAGE_SIZE = 12

import { SURFACE, SURF2, BORDER, ACCENT, TEXT, MUTED } from '@/lib/theme'

type FilterTab = "disponivel" | "vendido" | "destaque"

type Props = {
  vehicles: Vehicle[]
  userInfo: UserInfo | null
}

export function EstoqueClient({ vehicles: initialVehicles }: Props) {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [search,   setSearch]   = useState("")
  const [filter,   setFilter]   = useState<FilterTab>("disponivel")
  const [category, setCategory] = useState("")
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [page,     setPage]     = useState(1)

  function handleSold(id: string) {
    setVehicles((vs) => vs.map((v) =>
      v.id === id ? { ...v, status: "vendido", soldAt: new Date().toISOString() } : v
    ))
    setFilter("vendido")
  }

  function handleRestore(id: string) {
    setVehicles((vs) => vs.map((v) =>
      v.id === id ? { ...v, status: "disponivel", soldAt: undefined } : v
    ))
    setFilter("disponivel")
  }

  function handleFeatureToggle(id: string, isPremium: boolean) {
    setVehicles((vs) => vs.map((v) => (v.id === id ? { ...v, isPremium } : v)))
  }

  const counts = useMemo(() => ({
    disponivel: vehicles.filter((v) => v.status === "disponivel").length,
    vendido:    vehicles.filter((v) => v.status === "vendido").length,
    destaque:   vehicles.filter((v) => v.isPremium).length,
  }), [vehicles])

  const FILTER_TABS: { value: FilterTab; label: string }[] = [
    { value: "disponivel", label: "Disponíveis" },
    { value: "vendido",    label: "Vendidos" },
    { value: "destaque",   label: "Em destaque" },
  ]

  const hasExtraFilters = category !== "" || priceMin !== "" || priceMax !== ""

  function clearExtraFilters() {
    setCategory("")
    setPriceMin("")
    setPriceMax("")
  }

  const filtered = useMemo(() => {
    const q   = search.toLowerCase().trim()
    const min = priceMin ? parseCurrencyInput(priceMin) : null
    const max = priceMax ? parseCurrencyInput(priceMax) : null

    return vehicles.filter((v) => {
      const okStatus   = filter === "destaque" ? v.isPremium : v.status === filter
      const okCategory = !category || v.category === category
      const okPrice     = (min === null || v.price >= min) && (max === null || v.price <= max)

      const okSearch =
        !q ||
        v.name.toLowerCase().includes(q)  ||
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.color?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q)

      return okStatus && okSearch && okCategory && okPrice
    })
  }, [vehicles, search, filter, category, priceMin, priceMax])

  useEffect(() => {
    setPage(1)
  }, [search, filter, category, priceMin, priceMax])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handlePageChange(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="p-5 space-y-6 max-w-400 mx-auto">

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-black" style={{ color: TEXT }}>Estoque</h1>
          <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
            {vehicles.length} veículos · {counts.disponivel} disponíveis
          </p>
        </div>
        <Link
          href="/estoque/novo"
          className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 rounded-xl shrink-0 transition-opacity hover:opacity-90"
          style={{ height: "36px", background: "linear-gradient(135deg, #E2231A 0%, #9c7a24 100%)", color: "#1a1508", boxShadow: "0 2px 12px rgba(212,175,55,0.35)" }}
        >
          <Plus className="w-4 h-4" />
          Novo carro
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div
          className="relative flex-1 sm:max-w-sm flex items-center gap-2.5 px-3.5 rounded-xl"
          style={{ height: "40px", backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: MUTED }} />
          <input
            type="text"
            placeholder="Buscar por nome, marca, modelo, cor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-[13px] outline-none w-full"
            style={{ color: TEXT, caretColor: ACCENT }}
          />
        </div>

        <div
          className="flex items-center gap-0.5 rounded-xl p-1 self-start sm:self-auto flex-wrap"
          style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
        >
          {FILTER_TABS.map((tab) => {
            const count  = counts[tab.value]
            const active = filter === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap"
                style={{ color: active ? "#fff" : MUTED }}
              >
                {active && (
                  <motion.span
                    layoutId="estoqueFilterPill"
                    className="absolute inset-0 rounded-lg -z-10"
                    style={{ backgroundColor: ACCENT }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                {tab.label}
                <span
                  className="text-[11px] font-black tabular-nums"
                  style={{ color: active ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)" }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtros: tipo e preço */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3.5 rounded-xl text-[13px] outline-none border"
          style={{ backgroundColor: SURF2, borderColor: BORDER, color: category ? TEXT : MUTED }}
        >
          <option value="">Todos os tipos</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Preço mín."
            value={priceMin}
            onChange={(e) => setPriceMin(maskCurrencyInput(e.target.value))}
            className="h-10 w-32 px-3.5 rounded-xl text-[13px] outline-none border"
            style={{ backgroundColor: SURF2, borderColor: BORDER, color: TEXT, caretColor: ACCENT }}
          />
          <span style={{ color: MUTED }}>—</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Preço máx."
            value={priceMax}
            onChange={(e) => setPriceMax(maskCurrencyInput(e.target.value))}
            className="h-10 w-32 px-3.5 rounded-xl text-[13px] outline-none border"
            style={{ backgroundColor: SURF2, borderColor: BORDER, color: TEXT, caretColor: ACCENT }}
          />
        </div>

        {hasExtraFilters && (
          <button
            type="button"
            onClick={clearExtraFilters}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5 self-start sm:self-auto"
            style={{ color: MUTED }}
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grid or empty */}
      {filtered.length === 0 ? (
        <EmptyState search={search} filter={filter} hasExtraFilters={hasExtraFilters} />
      ) : (
        <>
          <motion.div
            key={`${filter}-${currentPage}`}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
          >
            {paginated.map((v) => (
              <motion.div
                key={v.id}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <VehicleCard vehicle={v} onSold={handleSold} onRestore={handleRestore} onFeatureToggle={handleFeatureToggle} />
              </motion.div>
            ))}
          </motion.div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onChange={handlePageChange} />
        </>
      )}
    </div>
  )
}

function EmptyState({ search, filter, hasExtraFilters }: { search: string; filter: FilterTab; hasExtraFilters: boolean }) {
  const label: Record<FilterTab, string> = {
    disponivel: "disponíveis",
    vendido:    "vendidos",
    destaque:   "em destaque",
  }

  return (
    <div
      className="rounded-2xl py-20 flex flex-col items-center gap-5 text-center"
      style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: SURF2 }}>
        <Car className="w-7 h-7" style={{ color: MUTED }} />
      </div>
      <div>
        <p className="text-[15px] font-bold" style={{ color: TEXT }}>Nenhum veículo encontrado</p>
        <p className="text-[13px] mt-1" style={{ color: MUTED }}>
          {search
            ? `Sem resultados para "${search}"`
            : hasExtraFilters
            ? "Nenhum veículo bate com os filtros de tipo/preço"
            : `Sem veículos ${label[filter]}`}
        </p>
      </div>
      <Link
        href="/estoque/novo"
        className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 rounded-xl transition-opacity hover:opacity-90"
        style={{ height: "36px", background: "linear-gradient(135deg, #E2231A 0%, #9c7a24 100%)", color: "#1a1508" }}
      >
        <Plus className="w-3.5 h-3.5" />
        Cadastrar veículo
      </Link>
    </div>
  )
}
