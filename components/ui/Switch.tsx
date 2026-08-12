"use client"

const TRACK_OFF = "rgba(255,255,255,0.08)"

type Props = {
  value: boolean
  onChange: (v: boolean) => void
  activeColor: string
  disabled?: boolean
}

export function Switch({ value, onChange, activeColor, disabled = false }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      className="relative rounded-full transition-colors shrink-0 disabled:opacity-50"
      style={{ width: "44px", height: "24px", backgroundColor: value ? activeColor : TRACK_OFF }}
    >
      <span
        className="absolute rounded-full transition-all"
        style={{ width: "18px", height: "18px", backgroundColor: "#fff", left: value ? "23px" : "3px", top: "3px" }}
      />
    </button>
  )
}
