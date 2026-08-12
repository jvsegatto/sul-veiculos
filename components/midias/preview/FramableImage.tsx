"use client"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { ZoomIn } from "lucide-react"

export type PhotoPosition = { x: number; y: number; zoom: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

export const DEFAULT_PHOTO_POSITION: PhotoPosition = { x: 50, y: 50, zoom: 1 }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

type Props = {
  src: string
  alt: string
  position?: PhotoPosition
  /** Quando informado, a imagem vira editável: arrastar (pan), scroll/pinça (zoom). */
  onPositionChange?: (position: PhotoPosition) => void
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Foto com enquadramento ajustável — arrastar pra reposicionar (pan), scroll do
 * mouse ou pinça no touch pra dar zoom, sempre ancorado no ponto sob o cursor/dedo.
 *
 * Elementos de UI (cantos de recorte, badge de zoom) levam `data-capture-hide`:
 * quando essa prévia é capturada via html2canvas pra gerar a arte final, esse
 * atributo é usado pra escondê-los antes do screenshot e evitar que apareçam na
 * imagem exportada (ver captureNode em PreviewFinal.tsx). Formatos capturados
 * via Canvas 2D à parte (ex: story-colagem) nem tocam esse DOM, então não
 * precisam do atributo — mas tê-lo não faz diferença nesses casos.
 */
export function FramableImage({ src, alt, position, onPositionChange, className, style, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pos = position ?? DEFAULT_PHOTO_POSITION
  const posRef = useRef(pos)
  posRef.current = pos
  const editable = !!onPositionChange

  const dragStart  = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null)
  const pointers   = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null)

  const [dragging, setDragging]   = useState(false)
  const [showBadge, setShowBadge] = useState(false)
  const badgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function flashBadge() {
    setShowBadge(true)
    if (badgeTimer.current) clearTimeout(badgeTimer.current)
    badgeTimer.current = setTimeout(() => setShowBadge(false), 900)
  }
  useEffect(() => () => { if (badgeTimer.current) clearTimeout(badgeTimer.current) }, [])

  // Zoom com o scroll do mouse, ancorado no ponto sob o cursor — precisa de um
  // listener nativo não-passivo: o onWheel do React vem passivo por padrão e
  // não deixa cancelar o scroll da página nesse evento.
  useEffect(() => {
    const el = rootRef.current
    if (!el || !onPositionChange) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const fx = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
      const fy = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
      const step = clamp(-e.deltaY * 0.0025, -0.35, 0.35)
      const cur = posRef.current
      const nextZoom = clamp(cur.zoom + step, MIN_ZOOM, MAX_ZOOM)
      const pull = nextZoom > cur.zoom ? 0.18 : 0 // zoom "puxa" o foco em direção ao cursor
      onPositionChange!({
        x: clamp(lerp(cur.x, fx, pull), 0, 100),
        y: clamp(lerp(cur.y, fy, pull), 0, 100),
        zoom: nextZoom,
      })
      flashBadge()
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [onPositionChange])

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!onPositionChange) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: posRef.current.zoom }
      dragStart.current = null
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, origX: posRef.current.x, origY: posRef.current.y }
    }
    setDragging(true)
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!onPositionChange || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Pinça com 2 dedos — dá zoom sem mexer no foco atual.
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values())
      const dist  = Math.hypot(a.x - b.x, a.y - b.y)
      const ratio = dist / (pinchStart.current.dist || 1)
      onPositionChange({
        x: posRef.current.x,
        y: posRef.current.y,
        zoom: clamp(pinchStart.current.zoom * ratio, MIN_ZOOM, MAX_ZOOM),
      })
      flashBadge()
      return
    }

    if (!dragStart.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dxPct = ((e.clientX - dragStart.current.x) / rect.width) * 100
    const dyPct = ((e.clientY - dragStart.current.y) / rect.height) * 100
    onPositionChange({
      x: clamp(dragStart.current.origX - dxPct, 0, 100),
      y: clamp(dragStart.current.origY - dyPct, 0, 100),
      zoom: posRef.current.zoom,
    })
  }

  function handlePointerEnd(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* já liberado */ }

    if (pointers.current.size === 1) {
      // Ainda sobrou 1 dedo na tela (fim de uma pinça) — retoma o pan sem pular.
      const [[, p]] = Array.from(pointers.current.entries())
      dragStart.current = { x: p.x, y: p.y, origX: posRef.current.x, origY: posRef.current.y }
      pinchStart.current = null
    } else if (pointers.current.size === 0) {
      dragStart.current = null
      pinchStart.current = null
      setDragging(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`overflow-hidden ${className ?? ""}`}
      style={{
        ...style,
        ...(editable ? { cursor: dragging ? "grabbing" : "grab", touchAction: "none" } : {}),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover select-none"
        style={{
          objectPosition: `${pos.x}% ${pos.y}%`,
          transform: `scale(${pos.zoom})`,
          transformOrigin: `${pos.x}% ${pos.y}%`,
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE }}
      />
      {children}

      {editable && (
        <>
          {/* Cantos estilo ferramenta de recorte — sinalizam a área editável durante o gesto */}
          <div
            data-capture-hide="true"
            className="absolute inset-1.5 pointer-events-none transition-opacity duration-150"
            style={{ opacity: dragging ? 1 : 0 }}
          >
            <span className="absolute top-0 left-0 w-2.5 h-2.5" style={{ borderTop: "2px solid #CE9E49", borderLeft: "2px solid #CE9E49" }} />
            <span className="absolute top-0 right-0 w-2.5 h-2.5" style={{ borderTop: "2px solid #CE9E49", borderRight: "2px solid #CE9E49" }} />
            <span className="absolute bottom-0 left-0 w-2.5 h-2.5" style={{ borderBottom: "2px solid #CE9E49", borderLeft: "2px solid #CE9E49" }} />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5" style={{ borderBottom: "2px solid #CE9E49", borderRight: "2px solid #CE9E49" }} />
          </div>

          {/* Badge de zoom — pisca durante o gesto (scroll/pinça/drag) e some sozinho */}
          <div
            data-capture-hide="true"
            className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 pointer-events-none transition-opacity duration-200"
            style={{ backgroundColor: "rgba(10,10,10,0.75)", backdropFilter: "blur(4px)", opacity: showBadge || dragging ? 1 : 0 }}
          >
            <ZoomIn className="w-2.5 h-2.5" style={{ color: "#CE9E49" }} />
            <span className="text-[9px] font-bold text-white tabular-nums">{Math.round(pos.zoom * 100)}%</span>
          </div>
        </>
      )}
    </div>
  )
}
