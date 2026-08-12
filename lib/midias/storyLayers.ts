import { formatPrecoSemCentavos } from "@/lib/midias/legenda"
import type { Vehicle } from "@/lib/types"

export type StoryLayerId =
  | "badge" | "brandTag" | "title" | "yearLine" | "priceLabel" | "priceValue" | "footerLogo"

export type StoryTextLayer = { text: string; x: number; y: number }
export type StoryImageLayer = { x: number; y: number }

export type StoryLayers = {
  badge:      StoryTextLayer
  brandTag:   StoryTextLayer
  title:      StoryTextLayer
  yearLine:   StoryTextLayer
  priceLabel: StoryTextLayer
  priceValue: StoryTextLayer
  footerLogo: StoryImageLayer
}

/**
 * Posições padrão (% do quadro 9:16) — bloco de texto encostado logo abaixo da
 * "zona segura" que o Instagram cobre com perfil/hora no Story (~14% do topo),
 * sem entrar nela, e sem descer mais que o necessário. Preço logo abaixo do
 * nome, logo sozinha e centralizada no rodapé.
 */
export function defaultStoryLayers(vehicle: Vehicle): StoryLayers {
  const anoLinha = vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : vehicle.year ? `${vehicle.year}` : ""
  return {
    // x: 0 — encostado na margem esquerda, igual ao selo do Story de 3 fotos
    // (StoryCollagePreview.tsx), como uma fita saindo da borda do quadro.
    badge:      { text: "Novo no estoque",                                                 x: 0,     y: 10.5 },
    brandTag:   { text: [vehicle.brand, vehicle.model].filter(Boolean).join(" · "),        x: 6,     y: 18   },
    title:      { text: vehicle.name || `${vehicle.brand} ${vehicle.model}`,               x: 6,     y: 22   },
    yearLine:   { text: anoLinha,                                                          x: 6,     y: 27.5 },
    priceLabel: { text: "Valor a vista",                                                   x: 6,     y: 32.5 },
    priceValue: { text: vehicle.price > 0 ? formatPrecoSemCentavos(vehicle.price) : "",    x: 6,     y: 36.5 },
    // Centralizada horizontalmente (ícone de 32px num quadro de 360px) e com
    // respiro generoso da borda inferior.
    footerLogo: { x: 45.5, y: 88 },
  }
}
