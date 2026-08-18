"use client"

import { BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

const SLOTS = [
  { label: "Foto 1 — Externa", hint: "Aparece no topo do Story, com o nome do carro" },
  { label: "Foto 2 — Interior / painel", hint: "Aparece no meio, com os dados e o preço" },
  { label: "Foto 3 — Externa", hint: "Aparece no final, com a chamada pro WhatsApp" },
] as const

type Props = {
  images: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function SelecionarFotosCollage({ images, selected, onChange }: Props) {
  function setSlot(index: number, url: string) {
    const next = [...selected]
    next[index] = url
    onChange(next)
  }

  if (!images.length) {
    return (
      <p className="text-[13px]" style={{ color: MUTED }}>
        Esse veículo não tem fotos cadastradas.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-[14px] font-bold" style={{ color: TEXT }}>Escolha as 3 fotos do Story</p>

      {SLOTS.map((slot, i) => (
        <div key={slot.label} className="space-y-2">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: TEXT }}>{slot.label}</p>
            <p className="text-[11px]" style={{ color: MUTED }}>{slot.hint}</p>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {images.map((url, j) => {
              const isSelected = selected[i] === url
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSlot(i, url)}
                  className="relative rounded-lg overflow-hidden"
                  style={{ aspectRatio: "1 / 1", border: `2px solid ${isSelected ? ACCENT : BORDER}` }}
                >
                  <img src={url} alt={`Foto ${j + 1}`} className="w-full h-full object-cover" />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(29,63,214,0.25)" }}>
                      <span className="text-white text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ backgroundColor: ACCENT }}>
                        {i + 1}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
