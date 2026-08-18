"use client"

import { Crop, Minus, MoveDiagonal2, Plus, RotateCcw } from "lucide-react"
import { MIN_ZOOM, MAX_ZOOM, type PhotoPosition } from "@/components/midias/preview/FramableImage"

import { SURF2, SURF3, BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

export const COLLAGE_SLOTS = [
  { label: "Foto 1", hint: "Externa" },
  { label: "Foto 2", hint: "Interior" },
  { label: "Foto 3", hint: "Externa" },
] as const

export const SINGLE_SLOT = [{ label: "Foto de capa", hint: "" }] as const

type Slot = { label: string; hint: string }

type Props = {
  positions: PhotoPosition[]
  slots?: readonly Slot[]
  onZoomStep: (index: number, delta: number) => void
  onResetOne: (index: number) => void
  onResetAll: () => void
}

export function FramingPanel({ positions, slots = COLLAGE_SLOTS, onZoomStep, onResetOne, onResetAll }: Props) {
  const multi = slots.length > 1
  return (
    <div
      className="w-full sm:w-[210px] shrink-0 rounded-2xl p-3.5 space-y-3.5"
      style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(29,63,214,0.12)" }}>
          <Crop className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold" style={{ color: TEXT }}>Enquadramento</p>
          <p className="text-[10px] truncate" style={{ color: MUTED }}>Arraste · scroll · pinça</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {slots.map((slot, i) => {
          const zoom      = positions[i]?.zoom ?? 1
          const isDefault = zoom <= MIN_ZOOM && (positions[i]?.x ?? 50) === 50 && (positions[i]?.y ?? 50) === 50

          return (
            <div key={slot.label} className="rounded-xl p-2.5 space-y-2" style={{ backgroundColor: SURF3, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {multi && (
                    <span
                      className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black shrink-0"
                      style={{ backgroundColor: isDefault ? "rgba(255,255,255,0.08)" : ACCENT, color: isDefault ? MUTED : "#000" }}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold truncate" style={{ color: TEXT }}>{slot.label}</span>
                  {slot.hint && <span className="text-[10px] truncate" style={{ color: MUTED }}>· {slot.hint}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => onResetOne(i)}
                  disabled={isDefault}
                  className="flex items-center justify-center w-5 h-5 rounded-md shrink-0 transition-colors disabled:opacity-25 hover:text-white"
                  style={{ color: MUTED }}
                  aria-label={`Redefinir enquadramento — ${slot.label}`}
                  title="Redefinir"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onZoomStep(i, -0.1)}
                  disabled={zoom <= MIN_ZOOM}
                  className="flex items-center justify-center rounded-md w-6 h-6 shrink-0 transition-colors disabled:opacity-25"
                  style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT }}
                  aria-label={`Diminuir zoom — ${slot.label}`}
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="range"
                  min={MIN_ZOOM * 100}
                  max={MAX_ZOOM * 100}
                  step={5}
                  value={Math.round(zoom * 100)}
                  onChange={(e) => onZoomStep(i, Number(e.target.value) / 100 - zoom)}
                  className="flex-1 min-w-0"
                  style={{ accentColor: ACCENT }}
                  aria-label={`Zoom — ${slot.label}`}
                />

                <button
                  type="button"
                  onClick={() => onZoomStep(i, 0.1)}
                  disabled={zoom >= MAX_ZOOM}
                  className="flex items-center justify-center rounded-md w-6 h-6 shrink-0 transition-colors disabled:opacity-25"
                  style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT }}
                  aria-label={`Aumentar zoom — ${slot.label}`}
                >
                  <Plus className="w-3 h-3" />
                </button>

                <span className="text-[10px] font-bold w-8 text-right tabular-nums shrink-0" style={{ color: TEXT }}>
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {multi && (
        <button
          type="button"
          onClick={onResetAll}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:text-white"
          style={{ color: MUTED, border: `1px solid ${BORDER}` }}
        >
          <MoveDiagonal2 className="w-3 h-3" />
          Centralizar tudo
        </button>
      )}
    </div>
  )
}
