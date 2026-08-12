"use client"

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"

export type LayerPosition = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

type Props = {
  position: LayerPosition
  /** Quando informado, o elemento vira arrastável — posição em % top-left, relativa ao `.media-preview`. */
  onPositionChange?: (position: LayerPosition) => void
  selected?: boolean
  onSelect?: () => void
  children?: ReactNode
  style?: CSSProperties
  className?: string
  /** Limites do arrasto em % — default 0-100. Elementos que sangram pra fora da moldura (ex: fundo em degradê) usam limites mais largos, incluindo negativos. */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
}

/**
 * Bloco posicionado livremente por %, arrastável com o mouse/touch. Cada
 * instância assume que é filha direta de `.media-preview` (position:relative,
 * tamanho fixo por aspect-ratio) — é contra esse retângulo que left/top em %
 * são resolvidos.
 *
 * A moldura tracejada de seleção leva `data-capture-hide`: escondida antes do
 * html2canvas gerar a arte final (ver captureNode em PreviewFinal.tsx).
 */
const DEFAULT_BOUNDS = { minX: 0, maxX: 100, minY: 0, maxY: 100 }

export function DraggableLayer({ position, onPositionChange, selected, onSelect, children, style, className, bounds = DEFAULT_BOUNDS }: Props) {
  const dragStart = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const editable = !!onPositionChange

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!editable) return
    e.stopPropagation()
    onSelect?.()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY, origX: position.x, origY: position.y }
    setDragging(true)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !onPositionChange) return
    const canvas = e.currentTarget.closest(".media-preview") as HTMLElement | null
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dxPct = ((e.clientX - dragStart.current.x) / rect.width) * 100
    const dyPct = ((e.clientY - dragStart.current.y) / rect.height) * 100
    onPositionChange({
      x: clamp(dragStart.current.origX + dxPct, bounds.minX, bounds.maxX),
      y: clamp(dragStart.current.origY + dyPct, bounds.minY, bounds.maxY),
    })
  }

  function handlePointerEnd(e: PointerEvent<HTMLDivElement>) {
    dragStart.current = null
    setDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* já liberado */ }
  }

  return (
    <div
      className={`absolute ${className ?? ""}`}
      style={{
        left: `${position.x}%`, top: `${position.y}%`,
        ...(editable ? { cursor: dragging ? "grabbing" : "grab", touchAction: "none" } : {}),
        ...style,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {children}
      {editable && selected && (
        <div
          data-capture-hide="true"
          className="absolute pointer-events-none rounded-md"
          style={{ inset: "-6px", border: "1.5px dashed #CE9E49", boxShadow: "0 0 0 3px rgba(212,175,55,0.12)" }}
        />
      )}
    </div>
  )
}
