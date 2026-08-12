"use client"

import { Check } from "lucide-react"

import { BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

export const MAX_FOTOS_CARROSSEL = 10

type Props = {
  images: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function SelecionarFotos({ images, selected, onChange }: Props) {
  function toggle(url: string) {
    if (selected.includes(url)) {
      onChange(selected.filter((u) => u !== url))
      return
    }
    if (selected.length >= MAX_FOTOS_CARROSSEL) return
    onChange([...selected, url])
  }

  if (!images.length) {
    return (
      <p className="text-[13px]" style={{ color: MUTED }}>
        Esse veículo não tem fotos cadastradas.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[14px] font-bold" style={{ color: TEXT }}>Quais fotos entram no carrossel?</p>
        <p className="text-[12px] font-bold" style={{ color: selected.length >= MAX_FOTOS_CARROSSEL ? ACCENT : MUTED }}>
          {selected.length} / {MAX_FOTOS_CARROSSEL} selecionadas
        </p>
      </div>
      <p className="text-[12px]" style={{ color: MUTED }}>
        O Instagram aceita no máximo {MAX_FOTOS_CARROSSEL} fotos por carrossel. A ordem segue a ordem do cadastro do veículo.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {images.map((url, i) => {
          const isSelected = selected.includes(url)
          const disabled = !isSelected && selected.length >= MAX_FOTOS_CARROSSEL
          return (
            <button
              key={url}
              type="button"
              onClick={() => toggle(url)}
              disabled={disabled}
              className="relative rounded-xl overflow-hidden transition-opacity"
              style={{ aspectRatio: "1 / 1", opacity: disabled ? 0.35 : 1, border: `2px solid ${isSelected ? ACCENT : BORDER}` }}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <div
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isSelected ? ACCENT : "rgba(0,0,0,0.55)",
                  border: isSelected ? "none" : "1px solid rgba(255,255,255,0.5)",
                }}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
