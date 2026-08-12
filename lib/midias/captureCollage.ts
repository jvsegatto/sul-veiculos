import { formatKm } from "@/lib/format"
import { formatPrecoSemCentavos } from "@/lib/midias/legenda"
import type { PhotoPosition } from "@/components/midias/preview/StoryCollagePreview"
import type { Vehicle } from "@/lib/types"

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

import { GOLD } from "@/lib/theme"
import { STORE_LOGO_PATH } from "@/lib/constants"

const DEFAULT_FRAMING: PhotoPosition = { x: 50, y: 50, zoom: 1 }

/**
 * Renderiza o story-collage de 3 fotos direto no Canvas 2D — sem html2canvas.
 * Carrega 1 foto por vez via proxy server-side, revoga os blob URLs apenas após
 * canvas.toBlob() para evitar que o Safari/iOS invalide a imagem antes do drawImage.
 *
 * Layout espelha StoryCollagePreview.tsx (fonte da verdade visual): banda 1
 * (externa · nome), banda 2 (interior, sempre no meio, com specs translúcidos
 * sobrepostos embaixo — preço em destaque), banda 3 (externa, com fade + logo
 * no rodapé). Sem tarja/rodapé sólidos separados.
 *
 * `positions` reflete o enquadramento (foco + zoom) ajustado à mão pelo
 * administrador na prévia — omitido, cada banda usa o centro da foto sem zoom.
 */
export async function captureCollage(vehicle: Vehicle, positions?: PhotoPosition[]): Promise<Blob> {
  const framing = [
    positions?.[0] ?? DEFAULT_FRAMING,
    positions?.[1] ?? DEFAULT_FRAMING,
    positions?.[2] ?? DEFAULT_FRAMING,
  ]
  await document.fonts.ready

  const SC = 4
  const W  = 360 * SC   // 1440
  const H  = 640 * SC   // 2560
  const LINE = SC * 2               // linha separadora (2px CSS)

  // Mesmas proporções de StoryCollagePreview.tsx (somam 100%) — banda 2 absorve
  // o espaço da antiga tarja de specs (agora sobreposta nela), banda 3 absorve
  // o do rodapé (agora um fade dentro dela).
  const BAND1_H = Math.round(H * 0.32)
  const BAND2_H = Math.round(H * 0.36)

  const BAND1_TOP = 0
  const BAND2_TOP = BAND1_H
  const BAND3_TOP = BAND1_H + BAND2_H
  const BAND3_H   = H - BAND3_TOP

  // Acumula todos os blob URLs pra revogar SOMENTE depois de canvas.toBlob().
  // Revogar dentro do onload pode invalidar a imagem antes do ctx.drawImage no iOS.
  const blobUrls: string[] = []

  async function loadImg(src: string): Promise<HTMLImageElement> {
    let url = src
    try {
      if (!src.startsWith("blob:") && !src.startsWith("data:")) {
        const fetchUrl = src.startsWith("/")
          ? src
          : `/admin/api/image-proxy?url=${encodeURIComponent(src)}`
        const ctrl  = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 20_000)
        try {
          const res = await fetch(fetchUrl, { signal: ctrl.signal })
          if (res.ok) {
            const blobUrl = URL.createObjectURL(await res.blob())
            blobUrls.push(blobUrl)   // revogar depois do toBlob
            url = blobUrl
          }
        } finally {
          clearTimeout(timer)
        }
      }
    } catch { /* usa src original */ }

    return new Promise<HTMLImageElement>((resolve) => {
      const img = new Image()
      // crossOrigin só quando for URL original (cross-origin) — evita canvas taint
      if (!url.startsWith("blob:") && !url.startsWith("data:")) {
        img.crossOrigin = "anonymous"
      }
      img.onload  = () => resolve(img)
      img.onerror = () => resolve(img)
      img.src = url
    })
  }

  // Desenha imagem com object-cover na área (x, y, w, h), com foco (focusX/focusY,
  // 0-100%) e zoom (>=1) equivalentes ao object-position + transform:scale usados
  // na prévia ao vivo — mesma matemática, pra o resultado final bater com o que o
  // administrador ajustou arrastando/dando zoom.
  function drawCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number, y: number, w: number, h: number,
    focusX = 50, focusY = 50, zoom = 1
  ) {
    if (!img.naturalWidth || !img.naturalHeight) return
    const s  = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const sw = (w / s) / zoom
    const sh = (h / s) / zoom
    const sx = Math.max(0, Math.min(img.naturalWidth  - sw, (img.naturalWidth  - sw) * (focusX / 100)))
    const sy = Math.max(0, Math.min(img.naturalHeight - sh, (img.naturalHeight - sh) * (focusY / 100)))
    ctx.save()
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
    ctx.restore()
  }

  // Degradê escuro — só embaixo, curto (o bastante pra legibilidade do texto).
  function drawGrad(ctx: CanvasRenderingContext2D, y: number, h: number, w: number) {
    const g = ctx.createLinearGradient(0, y + h, 0, y)
    g.addColorStop(0,    "rgba(10,10,10,0.92)")
    g.addColorStop(0.55, "rgba(10,10,10,0.55)")
    g.addColorStop(1,    "rgba(10,10,10,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, y, w, h)
  }

  // Desenha uma linha centralizada com pedaços de cor/fonte diferentes.
  function drawMixedLine(
    ctx: CanvasRenderingContext2D,
    parts: { text: string; font: string; color: string }[],
    centerX: number, y: number
  ) {
    const widths = parts.map((p) => { ctx.font = p.font; return ctx.measureText(p.text).width })
    const total  = widths.reduce((a, b) => a + b, 0)
    let x = centerX - total / 2
    for (let i = 0; i < parts.length; i++) {
      ctx.font = parts[i].font
      ctx.fillStyle = parts[i].color
      ctx.fillText(parts[i].text, x, y)
      x += widths[i]
    }
  }

  // ── Setup canvas ────────────────────────────────────────────────────────────
  const canvas  = document.createElement("canvas")
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, W, H)

  // Foto 1 = externa (banda 1), Foto 2 = interior (banda 2, sempre no meio),
  // Foto 3 = externa (banda 3).
  const photos = vehicle.images?.length ? vehicle.images : []
  const urlExterna1 = photos[0] ?? PLACEHOLDER
  const urlInterior = photos[1] ?? urlExterna1
  const urlExterna2 = photos[2] ?? urlExterna1

  const anoLinha = vehicle.yearModel
    ? `${vehicle.year}/${vehicle.yearModel}`
    : vehicle.year ? `${vehicle.year}` : ""

  const outrosSpecs = [anoLinha, vehicle.km ? formatKm(vehicle.km) : null, vehicle.fuel || null, vehicle.transmission || null]
    .filter(Boolean) as string[]
  const precoStr = vehicle.price > 0 ? formatPrecoSemCentavos(vehicle.price) : ""

  const name = vehicle.name || `${vehicle.brand} ${vehicle.model}`.trim()
  const modelPrefixMatches = vehicle.model && name.toLowerCase().startsWith(vehicle.model.toLowerCase())
  const namePart1 = modelPrefixMatches ? name.slice(0, vehicle.model.length) : name
  const namePart2 = modelPrefixMatches ? name.slice(vehicle.model.length).trim() : ""

  const F_TITLE  = `bold ${SC * 15}px 'Cinzel', 'Times New Roman', serif`
  const F_BRAND  = `400 ${SC * 10}px 'Inter', sans-serif`
  const F_BADGE  = `700 ${SC * 9}px 'Cinzel', 'Times New Roman', serif`
  const F_SPECS  = `600 ${SC * 8}px 'Inter', sans-serif`
  const F_PRICE  = `bold ${SC * 16}px 'Cinzel', 'Times New Roman', serif`

  ctx.textBaseline = "bottom"

  // ── Banda 1: foto externa · marca + nome ────────────────────────────────────
  const img1 = await loadImg(urlExterna1)
  drawCover(ctx, img1, 0, BAND1_TOP, W, BAND1_H, framing[0].x, framing[0].y, framing[0].zoom)
  const gradH1 = Math.round(BAND1_H * 0.34)
  drawGrad(ctx, BAND1_TOP + BAND1_H - gradH1, gradH1, W)
  ctx.fillStyle = GOLD
  ctx.fillRect(0, BAND1_TOP + BAND1_H - LINE, W, LINE)

  const titleY = BAND1_TOP + BAND1_H - Math.round(W * 0.02) - SC * 4
  ctx.font = F_TITLE
  const titleParts: { text: string; font: string; color: string }[] = [
    { text: namePart1, font: F_TITLE, color: "#ffffff" },
  ]
  if (namePart2) titleParts.push({ text: " " + namePart2, font: F_TITLE, color: GOLD })
  drawMixedLine(ctx, titleParts, W / 2, titleY)

  ctx.textAlign = "center"
  ctx.font = F_BRAND
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.fillText(vehicle.brand, W / 2, titleY - SC * 19)
  ctx.textAlign = "left"

  // Selo "Novo" — encostado na margem esquerda, cantos arredondados só à direita
  if (vehicle.isNew) {
    const label = "NOVO"
    ctx.font = F_BADGE
    const tw = ctx.measureText(label).width
    const bw = tw + SC * 24
    const bh = SC * 22
    const bx = 0
    const by = Math.round(H * 0.04)
    ctx.fillStyle = GOLD
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, [0, SC * 3, SC * 3, 0])
    else ctx.rect(bx, by, bw, bh)
    ctx.fill()
    ctx.fillStyle = "#1a1206"
    ctx.textAlign = "center"
    ctx.fillText(label, bx + bw / 2, by + bh - SC * 6)
    ctx.textAlign = "left"
  }

  // ── Banda 2: foto interior (sempre no meio) — specs translúcidos embaixo ────
  const img2 = await loadImg(urlInterior)
  drawCover(ctx, img2, 0, BAND2_TOP, W, BAND2_H, framing[1].x, framing[1].y, framing[1].zoom)
  ctx.fillStyle = GOLD
  ctx.fillRect(0, BAND2_TOP + BAND2_H - LINE, W, LINE)

  if (outrosSpecs.length > 0 || precoStr) {
    // Degradê — mostra a foto atrás, igual às bandas 1 e 3 (sem tarja opaca nem linha).
    // Só a faixa de baixo (não a banda inteira), senão escurece demais a foto do interior.
    const gradH2 = Math.round(BAND2_H * 0.30)
    drawGrad(ctx, BAND2_TOP + BAND2_H - gradH2, gradH2, W)

    ctx.textAlign = "center"
    ctx.textBaseline = "bottom"

    const specsY = BAND2_TOP + BAND2_H - Math.round(W * 0.02) - SC * 3
    const priceY = specsY - SC * 16

    if (precoStr) {
      ctx.font = F_PRICE
      ctx.fillStyle = GOLD
      ctx.fillText(precoStr, W / 2, priceY)
    }

    if (outrosSpecs.length > 0) {
      const parts: { text: string; font: string; color: string }[] = []
      outrosSpecs.forEach((s, i) => {
        if (i > 0) parts.push({ text: "   |   ", font: F_SPECS, color: GOLD })
        parts.push({ text: s, font: F_SPECS, color: "#ffffff" })
      })
      // drawMixedLine posiciona cada pedaço manualmente a partir da borda esquerda —
      // precisa de textAlign "left", senão cada trecho centraliza em cima do outro.
      ctx.textAlign = "left"
      drawMixedLine(ctx, parts, W / 2, specsY)
    }

    ctx.textAlign = "left"
  }

  // ── Banda 3: foto externa (traseira), com fade + logo no rodapé ─────────────
  const img3 = await loadImg(urlExterna2)
  drawCover(ctx, img3, 0, BAND3_TOP, W, BAND3_H, framing[2].x, framing[2].y, framing[2].zoom)

  // Fade só na parte de baixo da banda 3 (igual ao Story de 1 foto) — sem tarja
  // sólida separada, a foto continua visível através do degradê.
  const fadeH = Math.round(BAND3_H * 0.3)
  const fadeTop = BAND3_TOP + BAND3_H - fadeH
  const fadeGrad = ctx.createLinearGradient(0, BAND3_TOP + BAND3_H, 0, fadeTop)
  fadeGrad.addColorStop(0, "rgba(0,0,0,0.7)")
  fadeGrad.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = fadeGrad
  ctx.fillRect(0, fadeTop, W, fadeH)

  // Logo — só ela no rodapé, sem nome da loja.
  try {
    const logo = await new Promise<HTMLImageElement>((resolve) => {
      const img = new Image()
      img.onload  = () => resolve(img)
      img.onerror = () => resolve(img)
      img.src = STORE_LOGO_PATH
    })
    if (logo.naturalWidth) {
      const LS = SC * 36
      const lx = W / 2 - LS / 2
      const ly = BAND3_TOP + BAND3_H - Math.round(BAND3_H * 0.05) - LS
      ctx.save()
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(lx, ly, LS, LS, SC * 3)
      else ctx.rect(lx, ly, LS, LS)
      ctx.clip()
      ctx.drawImage(logo, lx, ly, LS, LS)
      ctx.restore()
    }
  } catch { /* sem logo */ }

  // Revoga os blob URLs SOMENTE após toBlob() — revogar antes pode invalidar as
  // imagens no Safari/iOS antes de o drawImage terminar de compor o frame final.
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => {
        blobUrls.forEach(u => URL.revokeObjectURL(u))
        b ? resolve(b) : reject(new Error("Captura retornou vazia"))
      },
      "image/png"
    )
  )
}
