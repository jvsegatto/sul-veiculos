"use client"

import type { ReactNode } from "react"
import { formatKm } from "@/lib/format"
import { formatPrecoSemCentavos } from "@/lib/midias/legenda"
import { STORE_NAME, STORE_LOGO_PATH } from "@/lib/constants"
import { FramableImage, type PhotoPosition } from "@/components/midias/preview/FramableImage"
import type { Vehicle } from "@/lib/types"

export type { PhotoPosition } from "@/components/midias/preview/FramableImage"
export { MIN_ZOOM, MAX_ZOOM } from "@/components/midias/preview/FramableImage"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

// Paleta mesclada de propósito (não um só tom): vermelho no selo "Novo" e no
// preço (destaque/CTA, ver identidade/design-guide.md), azul no nome
// completo/divisores — mesma mistura vermelho+azul do site, evita a peça
// ficar monocromática num dos dois.
import { ACCENT, BLUE } from "@/lib/theme"

export const DEFAULT_COLLAGE_POSITIONS: PhotoPosition[] = [
  { x: 50, y: 50, zoom: 1 },
  { x: 50, y: 50, zoom: 1 },
  { x: 50, y: 50, zoom: 1 },
]

// Seções do quadro 9:16, de cima pra baixo — 3 fotos, sem tarja/rodapé
// separados: specs vira uma sobreposição translúcida no rodapé da banda 2
// (mostra um pouco da foto atrás) e o rodapé é um fade dentro da banda 3.
// Somam 100%.
const BAND1_H = 32   // externa · nome do carro
const BAND2_H = 36   // interior · sempre no meio, com specs sobrepostos embaixo
const BAND3_H = 32   // externa · limpa, com fade + logo no rodapé

const BAND1_TOP = 0
const BAND2_TOP = BAND1_H
const BAND3_TOP = BAND1_H + BAND2_H

type Props = {
  vehicle: Vehicle
  /** Enquadramento (foco 0-100% + zoom) das 3 fotos, na ordem [externa1, interior, externa2]. */
  positions?: PhotoPosition[]
  /** Quando informado, cada banda vira editável: arrastar (pan), scroll/pinça (zoom). */
  onPositionChange?: (index: number, position: PhotoPosition) => void
}

// Posicionamento absoluto em vez de flex-1: html2canvas não resolve height:100%
// em filhos de flex-1 corretamente no iOS, causando fotos pretas no download.
// Com position:absolute + top/height percentuais o html2canvas resolve tudo via
// getBoundingClientRect do .media-preview (que tem height explícita via aspect-ratio).
function Band({ src, alt, top, height, borderColor, children, position, onPositionChange }: {
  src: string
  alt: string
  top: string | number
  height: string | number
  /** Cor do divisor — cada banda usa uma (vermelho/azul mesclados), ver render abaixo. */
  borderColor?: string
  children?: ReactNode
  position?: PhotoPosition
  onPositionChange?: (position: PhotoPosition) => void
}) {
  return (
    <FramableImage
      src={src}
      alt={alt}
      position={position}
      onPositionChange={onPositionChange}
      className="absolute"
      style={{
        top: typeof top === "number" ? `${top}%` : top,
        left: 0, right: 0,
        height: typeof height === "number" ? `${height}%` : height,
        ...(borderColor ? { borderBottom: `2px solid ${borderColor}` } : {}),
      }}
    >
      {children}
    </FramableImage>
  )
}

export function StoryCollagePreview({ vehicle, positions = DEFAULT_COLLAGE_POSITIONS, onPositionChange }: Props) {
  // Foto 1 = externa (banda 1), Foto 2 = interior (banda 2, sempre no meio),
  // Foto 3 = externa (banda 3) — ver SelecionarFotosCollage.tsx.
  const photos = vehicle.images?.length ? vehicle.images : []
  const fotoExterna1 = photos[0] ?? PLACEHOLDER_IMAGE
  const fotoInterior = photos[1] ?? fotoExterna1
  const fotoExterna2 = photos[2] ?? fotoExterna1

  const anoLinha = vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : vehicle.year ? `${vehicle.year}` : ""
  const outrosSpecs = [anoLinha, vehicle.km ? formatKm(vehicle.km) : null, vehicle.fuel || null, vehicle.transmission || null]
    .filter(Boolean) as string[]
  const precoStr = vehicle.price > 0 ? formatPrecoSemCentavos(vehicle.price) : ""

  // Nome sempre exatamente como cadastrado no painel (campo "Nome completo"),
  // sem cortar nem reescrever — só a última palavra muda de cor (branco no
  // resto, azul na última), ex: "Gol MSI 1.6 Automático!" (branco) + "Automático!" (azul).
  const name = vehicle.name || `${vehicle.brand} ${vehicle.model}`.trim()
  const nameWords = name.split(" ").filter(Boolean)
  const namePart2 = nameWords.length > 1 ? nameWords[nameWords.length - 1] : ""
  const namePart1 = nameWords.length > 1 ? nameWords.slice(0, -1).join(" ") : name

  return (
    <div className="media-preview story">

      {/* Banda 1 — externa, marca + nome do carro */}
      <Band
        src={fotoExterna1} alt={vehicle.name} top={BAND1_TOP} height={BAND1_H} borderColor={ACCENT}
        position={positions[0]}
        onPositionChange={onPositionChange ? (p) => onPositionChange(0, p) : undefined}
      >
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center"
          style={{ padding: "6% 7% 2%", background: "linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.55) 55%, transparent 100%)" }}
        >
          <p className="preview-commercial text-white/85 text-[10px] font-normal">
            {vehicle.brand}
          </p>
          <h2 className="preview-display text-[15px] font-bold leading-[1.1] mt-0.5">
            <span className="text-white">{namePart1}</span>
            {namePart2 && <span style={{ color: BLUE }}> {namePart2}</span>}
          </h2>
        </div>
      </Band>

      {/* Selo Novo — canto superior esquerdo da Banda 1, longe do nome e do painel */}
      {vehicle.isNew && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ top: "4%", left: 0 }}
        >
          <span
            className="preview-display inline-block text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ backgroundColor: ACCENT, color: "#ffffff", borderRadius: "0 3px 3px 0", padding: "5px 12px", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
          >
            Novo
          </span>
        </div>
      )}

      {/* Banda 2 — interior, sempre no meio, com specs sobrepostos (translúcido) embaixo */}
      <Band
        src={fotoInterior} alt={`${vehicle.name} - interior`} top={BAND2_TOP} height={BAND2_H} borderColor={BLUE}
        position={positions[1]}
        onPositionChange={onPositionChange ? (p) => onPositionChange(1, p) : undefined}
      >
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center"
          style={{ padding: "2.5% 5% 2%", background: "linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.55) 55%, transparent 100%)" }}
        >
          {precoStr && (
            <p className="preview-display text-[16px] font-bold leading-tight" style={{ color: ACCENT }}>
              {precoStr}
            </p>
          )}
          {outrosSpecs.length > 0 && (
            <div className="preview-commercial flex items-center flex-wrap justify-center gap-x-1.5 gap-y-0.5 mt-1">
              {outrosSpecs.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[7px]" style={{ color: BLUE }}>|</span>}
                  <span className="text-white text-[8px] font-semibold whitespace-nowrap">{s}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </Band>

      {/* Banda 3 — externa, com fade + logo no rodapé (igual ao Story de 1 foto) */}
      <Band
        src={fotoExterna2} alt={`${vehicle.name} - traseira`} top={BAND3_TOP} height={BAND3_H}
        position={positions[2]}
        onPositionChange={onPositionChange ? (p) => onPositionChange(2, p) : undefined}
      >
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center pointer-events-none"
          style={{ height: "30%", padding: "0 6% 5%", background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
        >
          <img
            src={STORE_LOGO_PATH}
            alt={STORE_NAME}
            className="w-9 h-9 rounded-lg object-cover"
          />
        </div>
      </Band>

    </div>
  )
}
