"use client"

import { BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

type Props = {
  images: string[]
  selected: string
  onChange: (selected: string) => void
}

export function SelecionarFotoCapa({ images, selected, onChange }: Props) {
  if (!images.length) {
    return (
      <p className="text-[13px]" style={{ color: MUTED }}>
        Esse veículo não tem fotos cadastradas.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[14px] font-bold" style={{ color: TEXT }}>Qual foto entra no Story?</p>
        <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>Essa é a única foto usada — aparece por trás de todo o texto.</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {images.map((url, i) => {
          const isSelected = selected === url
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              className="relative rounded-xl overflow-hidden"
              style={{ aspectRatio: "1 / 1", border: `2px solid ${isSelected ? ACCENT : BORDER}` }}
            >
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(29,63,214,0.25)" }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
