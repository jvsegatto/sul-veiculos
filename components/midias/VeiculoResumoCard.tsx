"use client"

import { ArrowRight } from "lucide-react"
import { Button } from "@heroui/react"
import { formatCurrency, formatKm } from "@/lib/format"
import type { Vehicle } from "@/lib/types"

import { SURFACE, SURF2, BORDER, TEXT, MUTED, ACCENT } from "@/lib/theme"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

type Props = {
  vehicle: Vehicle
  onAdvance?: () => void
}

export function VeiculoResumoCard({ vehicle, onAdvance }: Props) {
  const cover = vehicle.thumbnails?.[0] || vehicle.images?.[0] || vehicle.imageUrl || PLACEHOLDER_IMAGE
  const fotosCount = vehicle.images?.length ?? (vehicle.imageUrl ? 1 : 0)

  const linhas: { label: string; value: string }[] = [
    { label: "Marca",         value: vehicle.brand },
    { label: "Modelo",        value: vehicle.model },
    { label: "Versão/Nome",   value: vehicle.name },
    { label: "Ano",           value: vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : `${vehicle.year}` },
    { label: "Motorização",   value: vehicle.motor },
    { label: "Câmbio",        value: vehicle.transmission },
    { label: "Quilometragem", value: vehicle.km ? formatKm(vehicle.km) : "" },
    { label: "Combustível",   value: vehicle.fuel },
    { label: "Cor",           value: vehicle.color },
    { label: "Preço",         value: vehicle.price ? formatCurrency(vehicle.price) : "" },
  ].filter((l) => l.value)

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col sm:flex-row" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="sm:w-[200px] shrink-0 flex flex-col gap-2 p-2">
        <div className="rounded-xl overflow-hidden" style={{ height: "160px" }}>
          <img
            src={cover}
            alt={vehicle.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE }}
          />
        </div>
        {onAdvance && (
          <Button variant="primary" size="sm" className="w-full font-semibold" onPress={onAdvance}>
            Avançar
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="p-5 flex-1 space-y-3">
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{vehicle.brand}</p>
          <h3 className="text-[18px] font-bold" style={{ color: TEXT }}>{vehicle.name}</h3>
          <p className="text-[12px] mt-0.5" style={{ color: ACCENT }}>{fotosCount} foto{fotosCount === 1 ? "" : "s"} disponível{fotosCount === 1 ? "" : "is"}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" style={{ backgroundColor: SURF2, borderRadius: "12px", padding: "12px" }}>
          {linhas.map((l) => (
            <div key={l.label}>
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>{l.label}</p>
              <p className="text-[12px] font-semibold mt-0.5" style={{ color: TEXT }}>{l.value}</p>
            </div>
          ))}
        </div>
        {(vehicle.optionals?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {vehicle.optionals.slice(0, 8).map((opt) => (
              <span
                key={opt}
                className="text-[10px] font-medium px-2 py-1 rounded-full"
                style={{ backgroundColor: "rgba(212,175,55,0.1)", color: ACCENT, border: "1px solid rgba(212,175,55,0.2)" }}
              >
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
