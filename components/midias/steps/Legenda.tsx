"use client"

const SURF2  = "#111111"
import { BORDER, ACCENT, TEXT, MUTED } from "@/lib/theme"

type Props = {
  caption: string
  hashtags: string[]
  onChange: (caption: string) => void
}

export function Legenda({ caption, hashtags, onChange }: Props) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: MUTED }}>
          Legenda gerada automaticamente — edite se quiser
        </label>
        <textarea
          value={caption}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          style={{
            backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT,
            borderRadius: "10px", padding: "14px", fontSize: "13px", outline: "none",
            width: "100%", resize: "vertical", lineHeight: "1.6",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT }}
          onBlur={(e) => { e.currentTarget.style.borderColor = BORDER }}
        />
      </div>

      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(29,63,214,0.1)", color: ACCENT, border: "1px solid rgba(29,63,214,0.2)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
