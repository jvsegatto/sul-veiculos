// Paleta do painel — antes duplicada como consts locais em ~30 arquivos
// (mesmos nomes/valores repetidos). Centralizada aqui pra trocar de tema
// (ex: rebranding pra outro lojista) num lugar só.
//
// Alguns nomes têm mais de um alias porque o código já usava nomes
// diferentes pro mesmo valor (MUTED/TEXT2) — mantidos os dois pra não
// precisar tocar em cada ponto de uso, só no import.

export const BG      = "#0d0d0d"
export const SURFACE = "#1a1a1a"
export const CARD    = SURFACE
export const SURF2   = "#111111"
export const SURF3   = "#161616"
export const BORDER  = "rgba(255,255,255,0.08)"

export const TEXT  = "#f2f2f2"
export const TEXT2 = "#777777"
export const MUTED = TEXT2
export const TEXT3 = "#5c5c5c"

export const ACCENT    = "#E2231A"
export const ACCENT_D  = "#a8180f"
export const BLUE      = "#1d3fd6"
export const BLUE_DARK = "#142c9c"
export const YELLOW  = "#ffae1f"

export const DANGER       = "#a80e0e"
export const DANGER_LIGHT = "#ff6b6b"
export const SUCCESS      = "#25d366"
