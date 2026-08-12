"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PhotoBackdrop } from "@/components/midias/preview/PhotoBackdrop"
import { STORE_NAME, STORE_LOGO_PATH } from "@/lib/constants"
import type { Vehicle } from "@/lib/types"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

export function PhotoSlide({ src }: { src: string }) {
  return (
    <>
      <PhotoBackdrop src={src} />
      <div className="absolute top-0 right-0 z-10" style={{ padding: "6%" }}>
        <img
          src={STORE_LOGO_PATH}
          alt={STORE_NAME}
          className="w-7 h-7 rounded-md object-cover"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))" }}
        />
      </div>
    </>
  )
}

type Props = {
  vehicle: Vehicle
}

export function CarouselPreview({ vehicle }: Props) {
  const [index, setIndex] = useState(0)

  const fotos = vehicle.images?.length ? vehicle.images : []
  const cover = fotos[0] ?? vehicle.imageUrl ?? PLACEHOLDER_IMAGE
  const slides = fotos.length ? fotos : [cover]

  function prev() {
    setIndex((i) => (i - 1 + slides.length) % slides.length)
  }
  function next() {
    setIndex((i) => (i + 1) % slides.length)
  }

  return (
    <div className="relative" style={{ maxWidth: "405px", width: "100%" }}>
      <div className="media-preview carousel-slide">
        <PhotoSlide src={slides[index]} />
      </div>

      <button
        type="button"
        onClick={prev}
        aria-label="Slide anterior"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Próximo slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 flex-wrap justify-center" style={{ maxWidth: "85%" }}>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Ir pro slide ${i + 1}`}
            className="rounded-full transition-all"
            style={{
              width: i === index ? "18px" : "6px", height: "6px",
              backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </div>
    </div>
  )
}
