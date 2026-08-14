"use client"

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { FramableImage, type PhotoPosition } from "@/components/midias/preview/FramableImage"
import { DraggableLayer } from "@/components/midias/preview/DraggableLayer"
import { defaultStoryLayers, type StoryLayers, type StoryLayerId } from "@/lib/midias/storyLayers"
import { STORE_NAME, STORE_LOGO_PATH } from "@/lib/constants"
import type { Vehicle } from "@/lib/types"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

// Sombra — reforço extra de contraste em cima do véu escuro (abaixo), pra
// segurar a leitura mesmo num trecho mais claro da foto.
const TEXT_SHADOW: CSSProperties = { textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.6)" }

type Props = {
  vehicle: Vehicle
  /** Enquadramento (foco 0-100% + zoom) da foto de capa. */
  position?: PhotoPosition
  /** Quando informado, a foto vira editável: arrastar (pan), scroll/pinça (zoom). */
  onPositionChange?: (position: PhotoPosition) => void
  /** Textos e posições dos elementos sobre a foto — sem isso, usa o layout padrão (não editável). */
  layers?: StoryLayers
  /** Quando informado junto de `layers`, cada elemento vira arrastável e selecionável. */
  onLayerPositionChange?: (id: StoryLayerId, position: { x: number; y: number }) => void
  selectedLayer?: StoryLayerId | null
  onSelectLayer?: (id: StoryLayerId | null) => void
}

export function StoryPreview({
  vehicle, position, onPositionChange, layers, onLayerPositionChange, selectedLayer, onSelectLayer,
}: Props) {
  const cover = vehicle.images?.[0] ?? vehicle.imageUrl ?? PLACEHOLDER_IMAGE
  const L = layers ?? defaultStoryLayers(vehicle)
  const editable = !!onLayerPositionChange

  // Nomes longos ("Strada Freedom CD 1.3 Flex") quebravam pra 2ª linha e invadiam
  // o texto do ano logo abaixo, já que cada camada tem posição vertical fixa
  // (pensada pra 1 linha). Em vez de deixar quebrar, encolhe a fonte até caber
  // numa linha só — mede a largura natural contra a largura disponível (maxWidth
  // do wrapper) e escala proporcionalmente.
  const TITLE_FONT_PX = 22
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [titleFontPx, setTitleFontPx] = useState(TITLE_FONT_PX)
  useLayoutEffect(() => {
    const el = titleRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    el.style.fontSize = `${TITLE_FONT_PX}px`
    const available = parent.getBoundingClientRect().width * 0.96 // respiro no fim da linha
    const natural = el.scrollWidth
    const scale = natural > available ? Math.max(available / natural, 0.5) : 1
    setTitleFontPx(TITLE_FONT_PX * scale)
  }, [L.title.text])

  function layerProps(id: StoryLayerId) {
    return {
      position: L[id],
      onPositionChange: onLayerPositionChange ? (p: { x: number; y: number }) => onLayerPositionChange(id, p) : undefined,
      selected: selectedLayer === id,
      onSelect: onSelectLayer ? () => onSelectLayer(id) : undefined,
    }
  }

  return (
    <div className="media-preview story" onPointerDown={() => onSelectLayer?.(null)}>
      <FramableImage src={cover} alt={vehicle.name} className="absolute inset-0" position={position} onPositionChange={onPositionChange} />

      {/* Véu escuro no topo — dá contraste pro bloco de texto (marca, nome, ano,
          preço) sem virar uma caixa: some suavemente antes da metade da foto,
          onde o carro aparece, então não atrapalha a visualização dele. */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "58%", background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)" }}
      />

      {/* Fade preto sutil no rodapé — só reforça a leitura da logo, curto o
          bastante pra não cobrir o carro (que fica na metade de baixo da foto). */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: "16%", background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
      />

      {vehicle.isNew && L.badge.text && (
        <DraggableLayer {...layerProps("badge")}>
          <p
            className="preview-commercial font-bold uppercase tracking-[0.14em] text-[11px]"
            style={{
              backgroundColor: "#E2231A",
              color: "#1a1206",
              padding: "5px 14px",
              borderRadius: "0 3px 3px 0",
              boxShadow: "0 3px 10px rgba(0,0,0,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            {L.badge.text}
          </p>
        </DraggableLayer>
      )}

      {L.brandTag.text && (
        <DraggableLayer {...layerProps("brandTag")}>
          <p className="preview-commercial text-[#E2231A] text-[10px] font-bold uppercase tracking-[0.14em]" style={{ ...TEXT_SHADOW, whiteSpace: "nowrap" }}>
            {L.brandTag.text}
          </p>
        </DraggableLayer>
      )}

      {L.title.text && (
        <DraggableLayer {...layerProps("title")} style={{ maxWidth: "88%" }}>
          <h2
            ref={titleRef}
            className="preview-display text-white uppercase font-black leading-[1.05]"
            style={{ ...TEXT_SHADOW, fontSize: `${titleFontPx}px`, whiteSpace: "nowrap" }}
          >
            {L.title.text}
          </h2>
        </DraggableLayer>
      )}

      {L.yearLine.text && (
        <DraggableLayer {...layerProps("yearLine")}>
          <p className="preview-commercial text-[12px] font-semibold" style={{ ...TEXT_SHADOW, color: "#E4C766", whiteSpace: "nowrap" }}>
            {L.yearLine.text}
          </p>
        </DraggableLayer>
      )}

      {L.priceLabel.text && (
        <DraggableLayer {...layerProps("priceLabel")}>
          <div style={{ maxWidth: "70vw" }}>
            <div style={{ width: "36px", height: "2px", backgroundColor: "#E2231A", marginBottom: "8px" }} />
            <p className="preview-commercial text-[10px] font-bold uppercase tracking-[0.16em]" style={{ ...TEXT_SHADOW, color: "#E4C766", whiteSpace: "nowrap" }}>
              {L.priceLabel.text}
            </p>
          </div>
        </DraggableLayer>
      )}

      {L.priceValue.text && (
        <DraggableLayer {...layerProps("priceValue")}>
          <p className="preview-display text-white text-[24px] font-black leading-none" style={{ ...TEXT_SHADOW, whiteSpace: "nowrap" }}>
            {L.priceValue.text}
          </p>
        </DraggableLayer>
      )}

      <DraggableLayer
        position={L.footerLogo}
        onPositionChange={onLayerPositionChange ? (p) => onLayerPositionChange("footerLogo", p) : undefined}
        selected={selectedLayer === "footerLogo"}
        onSelect={onSelectLayer ? () => onSelectLayer("footerLogo") : undefined}
      >
        <img
          src={STORE_LOGO_PATH}
          alt={STORE_NAME}
          draggable={false}
          className="w-8 h-8 rounded-lg object-cover select-none"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.75))" }}
        />
      </DraggableLayer>

      {editable && !selectedLayer && (
        <div
          data-capture-hide="true"
          className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none"
        >
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(10,10,10,0.6)", color: "rgba(255,255,255,0.5)" }}
          >
            Toque num texto pra editar
          </span>
        </div>
      )}
    </div>
  )
}
