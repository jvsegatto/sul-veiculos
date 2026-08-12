// Prepara um nó do preview pra ser fotografado pelo html2canvas (usado nos
// downloads/posts de Story de 1 foto, Post e Carrossel — o Story de 3 fotos
// usa um Canvas 2D manual à parte e não passa por aqui).
//
// Problemas do html2canvas que isso contorna:
//
// 1) CORS/canvas-taint: troca o src de cada <img> por um Blob URL same-origin
//    (via proxy server-side), pra não precisar de useCORS/allowTaint.
//
// 2) object-fit ignorado + qualidade ruim em background-image: html2canvas
//    não implementa object-fit corretamente quando combinado com transform
//    (usado pelo zoom/enquadramento do FramableImage) — estica a imagem crua
//    pro tamanho do elemento, distorcendo a foto. Trocar o <img> por uma div
//    com background-image (tentativa anterior) resolve a distorção mas sai
//    visivelmente mais borrado — o pipeline de background do html2canvas não
//    amostra a imagem na resolução nativa. A saída: esconde essas <img> (fotos
//    de fundo, não os logos/ícones pequenos) e devolve os parâmetros de recorte
//    ("cover"/"contain" calculado à mão) — quem desenha a foto de verdade é um
//    Canvas 2D nativo em captureNode, com drawImage direto na resolução da
//    imagem original. O html2canvas roda só por cima, com fundo transparente,
//    pra desenhar o resto (texto, degradês, selo) — sem tocar na foto.
//
// 3) border-radius mal recortado: o `.media-preview` tem cantos arredondados
//    (só um estilo de card do painel) e o html2canvas recorta esse
//    border-radius com imprecisão — sobra um triângulo preto sólido em cada
//    canto. A arte final não precisa de cantos arredondados (é uma imagem
//    retangular pro Instagram), então zera o border-radius do nó raiz.

export type CoverPhoto = {
  img: HTMLImageElement
  /** Retângulo de origem (px naturais da imagem) a amostrar. */
  sx: number; sy: number; sw: number; sh: number
  /** Retângulo de destino (px CSS, relativo ao nó capturado) onde desenhar. */
  dx: number; dy: number; dw: number; dh: number
}

export async function prepareNodeForCapture(node: HTMLElement): Promise<{ restore: () => void; photos: CoverPhoto[] }> {
  const prevRadius = node.style.borderRadius
  node.style.borderRadius = "0"
  // `.media-preview` tem background-color própria no CSS (globals.css) — o
  // html2canvas desenha isso normalmente mesmo com a opção `backgroundColor:
  // null` (que só cobre área sem cor de fundo declarada), e esse preto sólido
  // tampa a foto desenhada por baixo no captureNode. Zera durante a captura.
  const prevBg = node.style.backgroundColor
  node.style.backgroundColor = "transparent"

  const nodeRect = node.getBoundingClientRect()
  const imgs = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
  const restores: Array<() => void> = [
    () => { node.style.borderRadius = prevRadius },
    () => { node.style.backgroundColor = prevBg },
  ]
  const blobUrls: string[] = []
  const photos: CoverPhoto[] = []

  await Promise.all(imgs.map(async (img) => {
    const originalSrc = img.getAttribute("src") ?? ""

    if (originalSrc && !originalSrc.startsWith("data:") && !originalSrc.startsWith("blob:")) {
      try {
        const fetchUrl = originalSrc.startsWith("/")
          ? originalSrc
          : `/admin/api/image-proxy?url=${encodeURIComponent(originalSrc)}`
        const res = await fetch(fetchUrl)
        if (res.ok) {
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          blobUrls.push(blobUrl)
          img.src = blobUrl
          restores.push(() => { img.src = originalSrc })
        }
      } catch { /* mantém src original */ }
    }

    if (!img.complete || img.naturalWidth === 0) {
      await new Promise<void>(resolve => {
        img.addEventListener("load",  () => resolve(), { once: true })
        img.addEventListener("error", () => resolve(), { once: true })
      })
    }

    const cs = getComputedStyle(img)
    const fit = cs.objectFit
    const hasRadius = cs.borderRadius !== "0px"
    // Cantos arredondados só aparecem em logos/ícones pequenos, quase quadrados
    // — deixa o html2canvas desenhar esses normalmente (baixo risco de
    // distorção, e preserva o recorte redondo sem reimplementar aqui).
    if ((fit !== "cover" && fit !== "contain") || hasRadius || img.naturalWidth === 0 || img.naturalHeight === 0) {
      return
    }

    const rect = img.getBoundingClientRect()
    const boxW = rect.width
    const boxH = rect.height
    const natW = img.naturalWidth
    const natH = img.naturalHeight

    const [posXStr, posYStr] = cs.objectPosition.split(" ")
    const posX = parseFloat(posXStr) || 50
    const posY = parseFloat(posYStr) || 50
    // transform: scale(z) → matrix(z, 0, 0, z, 0, 0); "none" quando não há zoom.
    const matrix = cs.transform.match(/^matrix\(([^,]+),/)
    const zoomRaw = matrix ? parseFloat(matrix[1]) : 1
    const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 1

    // Em vez de escalar a imagem pro tamanho do quadro (perde nitidez ao
    // ampliar), calcula o recorte inverso: qual pedaço da imagem NATIVA
    // corresponde ao quadro, e deixa o drawImage escalar isso de uma vez só
    // (mesma matemática do drawCover em captureCollage.ts).
    const coverScale = fit === "cover" ? Math.max(boxW / natW, boxH / natH) : Math.min(boxW / natW, boxH / natH)
    const sw = Math.min(natW, (boxW / coverScale) / zoom)
    const sh = Math.min(natH, (boxH / coverScale) / zoom)
    const sx = Math.max(0, Math.min(natW - sw, (natW - sw) * (posX / 100)))
    const sy = Math.max(0, Math.min(natH - sh, (natH - sh) * (posY / 100)))

    photos.push({
      img,
      sx, sy, sw, sh,
      dx: rect.left - nodeRect.left,
      dy: rect.top  - nodeRect.top,
      dw: boxW,
      dh: boxH,
    })

    const prevVisibility = img.style.visibility
    img.style.visibility = "hidden"
    restores.push(() => { img.style.visibility = prevVisibility })
  }))

  return {
    photos,
    restore: () => {
      restores.forEach(fn => fn())
      blobUrls.forEach(u => URL.revokeObjectURL(u))
    },
  }
}
