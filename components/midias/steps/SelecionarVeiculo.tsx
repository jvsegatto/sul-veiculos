"use client"

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Search } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { Vehicle } from "@/lib/types"

import { SURF2, BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

type Props = {
  vehicles: Vehicle[]
  // Modo single (existente)
  selectedId?: string | null
  onSelect?: (vehicle: Vehicle) => void
  onDeselect?: () => void
  renderDetail?: (vehicle: Vehicle) => ReactNode
  // Modo multi (lote)
  selectedIds?: string[]
  onToggle?: (vehicle: Vehicle) => void
}

export function SelecionarVeiculo({
  vehicles, selectedId, onSelect, onDeselect, renderDetail,
  selectedIds, onToggle,
}: Props) {
  const [search, setSearch] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const multiMode = selectedIds !== undefined && onToggle !== undefined

  useEffect(() => {
    if (multiMode || !selectedId || !onDeselect) return
    const deselect = onDeselect
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) deselect()
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [multiMode, selectedId, onDeselect])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return vehicles
    return vehicles.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.brand.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q)
    )
  }, [vehicles, search])

  return (
    <div className="space-y-4" ref={rootRef}>
      <div
        className="flex items-center gap-2.5 px-3.5 rounded-xl max-w-sm"
        style={{ height: "40px", backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: MUTED }} />
        <input
          type="text"
          placeholder="Buscar por nome, marca ou modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-[13px] outline-none w-full"
          style={{ color: TEXT, caretColor: ACCENT }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] py-8 text-center" style={{ color: MUTED }}>Nenhum veículo encontrado</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v) => {
            const active = multiMode ? selectedIds.includes(v.id) : v.id === selectedId
            const cover  = v.thumbnails?.[0] || v.images?.[0] || v.imageUrl || PLACEHOLDER_IMAGE
            return (
              <Fragment key={v.id}>
                <button
                  type="button"
                  onClick={() => multiMode ? onToggle(v) : onSelect?.(v)}
                  className="rounded-xl overflow-hidden text-left transition-all relative"
                  style={{
                    border: `2px solid ${active ? ACCENT : BORDER}`,
                    backgroundColor: SURF2,
                    boxShadow: active ? "0 0 0 3px rgba(29,63,214,0.2)" : "none",
                  }}
                >
                  {/* Checkmark do modo multi */}
                  {multiMode && (
                    <div
                      className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: active ? ACCENT : "rgba(0,0,0,0.5)",
                        border: `2px solid ${active ? ACCENT : "rgba(255,255,255,0.3)"}`,
                      }}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  <div style={{ height: "120px" }}>
                    <img
                      src={cover}
                      alt={v.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE }}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{v.brand}</p>
                    <p className="text-[13px] font-bold line-clamp-1" style={{ color: TEXT }}>{v.name}</p>
                    <p className="text-[12px] font-semibold mt-1" style={{ color: ACCENT }}>
                      {v.price ? formatCurrency(v.price) : "Sem preço"}
                    </p>
                  </div>
                </button>

                {/* Detail panel — só no modo single */}
                {!multiMode && (
                  <AnimatePresence>
                    {active && renderDetail && (
                      <motion.div
                        className="col-span-full overflow-hidden"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                      >
                        {renderDetail(v)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
