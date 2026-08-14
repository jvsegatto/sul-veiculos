"use client"

import { formatKm } from "@/lib/format"
import { formatPrecoSemCentavos } from "@/lib/midias/legenda"
import { PhotoBackdrop } from "@/components/midias/preview/PhotoBackdrop"
import { STORE_NAME, STORE_LOGO_PATH } from "@/lib/constants"
import type { Vehicle } from "@/lib/types"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

type Props = {
  vehicle: Vehicle
}

export function PostPreview({ vehicle }: Props) {
  const cover = vehicle.images?.[0] ?? vehicle.imageUrl ?? PLACEHOLDER_IMAGE
  const anoLinha = vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : vehicle.year ? `${vehicle.year}` : ""

  const specs = [
    vehicle.km ? formatKm(vehicle.km) : null,
    vehicle.transmission || null,
    vehicle.fuel || null,
  ].filter(Boolean)

  return (
    <div className="media-preview post">
      <PhotoBackdrop src={cover} alt={vehicle.name} />

      <div className="absolute bottom-0 right-0 z-10" style={{ padding: "0 6% 5% 0" }}>
        <img
          src={STORE_LOGO_PATH}
          alt={STORE_NAME}
          className="w-8 h-8 rounded-lg object-cover"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))" }}
        />
      </div>

      <div
        className="safe-area flex flex-col justify-end"
        style={{ background: "linear-gradient(to top, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.8) 35%, rgba(10,10,10,0.2) 65%, transparent 85%)" }}
      >
        <p className="preview-commercial text-[#E2231A] text-[10px] font-bold uppercase tracking-[0.16em]">
          {[vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}
        </p>
        <h2 className="preview-display text-white text-[32px] leading-[0.95] mt-1">
          {vehicle.name || `${vehicle.brand} ${vehicle.model}`}
        </h2>
        {anoLinha && <p className="preview-commercial text-white/60 text-[12px] font-medium mt-0.5">{anoLinha}</p>}

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {specs.map((s) => (
              <span
                key={s}
                className="preview-commercial text-white text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {vehicle.price > 0 && (
          <div className="mt-3 pt-2.5" style={{ borderTop: "2px solid #E2231A" }}>
            <p className="preview-display text-white text-[30px] leading-none">{formatPrecoSemCentavos(vehicle.price)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
