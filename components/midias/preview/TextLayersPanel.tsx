"use client"

import { Type, RotateCcw, MoveDiagonal2 } from "lucide-react"
import type { StoryLayers, StoryLayerId } from "@/lib/midias/storyLayers"

import { SURF2, SURF3, BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

const ROWS: { id: StoryLayerId; label: string; show?: (layers: StoryLayers, isNew: boolean) => boolean }[] = [
  { id: "badge",      label: "Selo \"Novo\"", show: (_l, isNew) => isNew },
  { id: "brandTag",   label: "Marca · modelo" },
  { id: "title",      label: "Nome do carro" },
  { id: "yearLine",   label: "Ano" },
  { id: "priceLabel", label: "Rótulo do preço" },
  { id: "priceValue", label: "Preço" },
]

type Props = {
  layers: StoryLayers
  isNew: boolean
  selected: StoryLayerId | null
  onSelect: (id: StoryLayerId | null) => void
  onTextChange: (id: StoryLayerId, text: string) => void
  onResetOne: (id: StoryLayerId) => void
  onResetAll: () => void
}

export function TextLayersPanel({ layers, isNew, selected, onSelect, onTextChange, onResetOne, onResetAll }: Props) {
  const rows = ROWS.filter((r) => !r.show || r.show(layers, isNew))

  return (
    <div
      className="w-full sm:w-[210px] shrink-0 rounded-2xl p-3.5 space-y-3.5"
      style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(212,175,55,0.12)" }}>
          <Type className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold" style={{ color: TEXT }}>Textos</p>
          <p className="text-[10px] truncate" style={{ color: MUTED }}>Edite e arraste na prévia</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const layer = layers[row.id] as { text: string; x: number; y: number }
          const isSelected = selected === row.id
          return (
            <div
              key={row.id}
              className="rounded-xl p-2 space-y-1.5 transition-colors"
              style={{ backgroundColor: SURF3, border: `1px solid ${isSelected ? ACCENT : BORDER}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold truncate" style={{ color: isSelected ? ACCENT : MUTED }}>{row.label}</span>
                <button
                  type="button"
                  onClick={() => onResetOne(row.id)}
                  className="flex items-center justify-center w-5 h-5 rounded-md shrink-0 transition-colors hover:text-white"
                  style={{ color: MUTED }}
                  aria-label={`Redefinir — ${row.label}`}
                  title="Redefinir"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={layer.text}
                onFocus={() => onSelect(row.id)}
                onChange={(e) => onTextChange(row.id, e.target.value)}
                className="w-full rounded-md text-[12px] px-2 py-1.5 outline-none"
                style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT }}
              />
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onResetAll}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:text-white"
        style={{ color: MUTED, border: `1px solid ${BORDER}` }}
      >
        <MoveDiagonal2 className="w-3 h-3" />
        Redefinir layout
      </button>
    </div>
  )
}
