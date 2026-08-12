"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { SURF2, BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

type Props = {
  currentPage: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null

  // Mostra no máximo 7 botões de página, com "..." pra não lotar o rodapé em listas longas.
  const pages: (number | "...")[] = []
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...")
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
      <button
        type="button"
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Página anterior"
        className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
        style={{ width: "34px", height: "34px", backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="text-[13px] px-1" style={{ color: MUTED }}>···</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Página ${p}`}
            aria-current={p === currentPage}
            className="rounded-lg text-[13px] font-bold transition-colors"
            style={{
              minWidth: "34px", height: "34px",
              backgroundColor: p === currentPage ? ACCENT : SURF2,
              border: `1px solid ${p === currentPage ? ACCENT : BORDER}`,
              color: p === currentPage ? "#fff" : MUTED,
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Próxima página"
        className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
        style={{ width: "34px", height: "34px", backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
