"use client"

import { Check, Clapperboard, GalleryHorizontal, Rows3 } from "lucide-react"
import { STORY_DIMENSIONS, CAROUSEL_DIMENSIONS } from "@/lib/midias/dimensoes"
import type { MediaType } from "@/lib/types"

import { SURF2, BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

export type FormatoKey = "story" | "story-collage" | "carousel"

export function mediaTypeFromFormato(key: FormatoKey): MediaType {
  return key === "carousel" ? "carousel" : "story"
}

const FORMATOS: { key: FormatoKey; label: string; description: string; icon: typeof Clapperboard; dims: string }[] = [
  {
    key: "story",
    label: "Story",
    description: "Formato vertical pra Stories do Instagram",
    icon: Clapperboard,
    dims: `${STORY_DIMENSIONS.width}×${STORY_DIMENSIONS.height} · ${STORY_DIMENSIONS.aspectRatio}`,
  },
  {
    key: "story-collage",
    label: "Story — 3 fotos",
    description: "Um Story só com 3 fotos do carro (externa, interior e externa) e os dados em cada bloco",
    icon: Rows3,
    dims: `${STORY_DIMENSIONS.width}×${STORY_DIMENSIONS.height} · ${STORY_DIMENSIONS.aspectRatio}`,
  },
  {
    key: "carousel",
    label: "Carrossel",
    description: "Carrossel com as fotos que você escolher",
    icon: GalleryHorizontal,
    dims: `${CAROUSEL_DIMENSIONS.width}×${CAROUSEL_DIMENSIONS.height} · ${CAROUSEL_DIMENSIONS.aspectRatio}`,
  },
]

type Props = {
  selected: FormatoKey[]
  onToggle: (key: FormatoKey) => void
}

export function EscolherFormato({ selected, onToggle }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
        Selecione um ou mais formatos
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FORMATOS.map((f) => {
          const Icon = f.icon
          const active = selected.includes(f.key)
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onToggle(f.key)}
              className="rounded-2xl p-6 text-left transition-all flex flex-col gap-3 relative"
              style={{
                backgroundColor: SURF2,
                border: `2px solid ${active ? ACCENT : BORDER}`,
                boxShadow: active ? "0 0 0 3px rgba(29,63,214,0.2)" : "none",
              }}
            >
              {active && (
                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: active ? ACCENT : "rgba(255,255,255,0.06)" }}
              >
                <Icon className="w-5 h-5" style={{ color: active ? "#fff" : MUTED }} />
              </div>
              <div>
                <p className="text-[15px] font-bold" style={{ color: TEXT }}>{f.label}</p>
                <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>{f.description}</p>
              </div>
              <p className="text-[11px] font-semibold" style={{ color: ACCENT }}>{f.dims}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
