"use client"

import { useEffect, useRef, useState } from "react"
import html2canvas from "html2canvas"
import JSZip from "jszip"
import { Button } from "@heroui/react"
import { CheckCircle2, Download, Loader2, Send, Sparkles } from "lucide-react"
import { StoryPreview } from "@/components/midias/preview/StoryPreview"
import { StoryCollagePreview, DEFAULT_COLLAGE_POSITIONS } from "@/components/midias/preview/StoryCollagePreview"
import { DEFAULT_PHOTO_POSITION, MIN_ZOOM, MAX_ZOOM, type PhotoPosition } from "@/components/midias/preview/FramableImage"
import { FramingPanel, COLLAGE_SLOTS, SINGLE_SLOT } from "@/components/midias/preview/FramingPanel"
import { TextLayersPanel } from "@/components/midias/preview/TextLayersPanel"
import { defaultStoryLayers, type StoryLayers, type StoryLayerId } from "@/lib/midias/storyLayers"
import { PostPreview } from "@/components/midias/preview/PostPreview"
import { CarouselPreview, PhotoSlide } from "@/components/midias/preview/CarouselPreview"
import { Switch } from "@/components/ui/Switch"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { createClient } from "@/lib/supabase/client"
import { postToInstagram } from "@/lib/actions/instagram"
import { captureCollage as captureCollageManual } from "@/lib/midias/captureCollage"
import { prepareNodeForCapture } from "@/lib/midias/prepareCapture"
import type { MediaType, Vehicle } from "@/lib/types"

import { SURF2, BORDER, ACCENT, TEXT, MUTED, SUCCESS } from "@/lib/theme"
import { STORE_NAME } from "@/lib/constants"
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

// html2canvas não usa SVG foreignObject — re-implementa o CSS diretamente no
// Canvas 2D, o que resolve o bug do iOS Safari que tornava as fotos pretas.

async function waitForFonts() {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready
}

type Props = {
  vehicle: Vehicle
  mediaType: MediaType
  /** Quando mediaType é "story", define se usa o layout único (1 foto) ou a colagem de 3 fotos. */
  storyCollage?: boolean
  caption: string
  hashtags: string[]
  onChangeCaption: (caption: string) => void
  onBack: () => void
  onSave: () => void
  onDone: () => void
  onToggleNewBadge: (value: boolean) => void
  updatingNewBadge: boolean
  saving: boolean
  saved: boolean
  error: string | null
}

export function PreviewFinal({
  vehicle, mediaType, storyCollage = false, caption, hashtags, onChangeCaption, onBack, onSave, onDone,
  onToggleNewBadge, updatingNewBadge, saving, saved, error,
}: Props) {
  const previewWrapRef  = useRef<HTMLDivElement>(null)
  const hiddenSlidesRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadErr, setDownloadErr] = useState<string | null>(null)

  const [showPostConfirm, setShowPostConfirm] = useState(false)
  const [posting,         setPosting]         = useState(false)
  const [postErr,         setPostErr]         = useState<string | null>(null)
  const [postedLink,      setPostedLink]      = useState<string | null>(null)

  // Enquadramento das fotos do Story (1 foto ou colagem de 3) — o administrador
  // arrasta/dá zoom em cada uma na prévia pra ajustar o que fica visível antes
  // de salvar/postar a arte. Cada aba de formato remonta esse componente (key
  // no NovaMidiaWizard), então `storyCollage` nunca muda depois do mount.
  const defaultFraming = storyCollage ? DEFAULT_COLLAGE_POSITIONS : [DEFAULT_PHOTO_POSITION]
  const [framingPositions, setFramingPositions] = useState<PhotoPosition[]>(defaultFraming)
  const framingImagesKey = mediaType !== "story"
    ? ""
    : storyCollage
      ? (vehicle.images ?? []).join("|")
      : (vehicle.images?.[0] ?? vehicle.imageUrl ?? "")
  useEffect(() => {
    setFramingPositions(storyCollage ? DEFAULT_COLLAGE_POSITIONS : [DEFAULT_PHOTO_POSITION])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framingImagesKey])

  function handleFramingChange(index: number, position: PhotoPosition) {
    setFramingPositions((prev) => {
      const next = [...prev]
      next[index] = position
      return next
    })
  }

  function handleZoomStep(index: number, delta: number) {
    setFramingPositions((prev) => {
      const next = [...prev]
      const cur = next[index]
      next[index] = { ...cur, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((cur.zoom + delta) * 100) / 100)) }
      return next
    })
  }

  function handleResetOne(index: number) {
    setFramingPositions((prev) => {
      const next = [...prev]
      next[index] = { x: 50, y: 50, zoom: 1 }
      return next
    })
  }

  // Textos e posições dos elementos sobre a arte do Story de 1 foto (nome,
  // preço, selo, rodapé) — totalmente editáveis: o admin arrasta cada um pra
  // onde quiser e reescreve o texto pelo painel ao lado.
  const [storyLayers, setStoryLayers] = useState<StoryLayers>(() => defaultStoryLayers(vehicle))
  const [selectedLayer, setSelectedLayer] = useState<StoryLayerId | null>(null)
  useEffect(() => {
    setStoryLayers(defaultStoryLayers(vehicle))
    setSelectedLayer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id])

  function handleLayerPositionChange(id: StoryLayerId, pos: { x: number; y: number }) {
    setStoryLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...pos } }))
  }

  function handleLayerTextChange(id: StoryLayerId, text: string) {
    setStoryLayers((prev) => ({ ...prev, [id]: { ...prev[id], text } }))
  }

  function handleLayerResetOne(id: StoryLayerId) {
    const fresh = defaultStoryLayers(vehicle)
    setStoryLayers((prev) => ({ ...prev, [id]: fresh[id] }))
  }

  const canAutoPost = mediaType === "story" || mediaType === "carousel"
  const carouselSlides = vehicle.images?.length
    ? vehicle.images
    : [vehicle.imageUrl || PLACEHOLDER_IMAGE]

  // No iOS o atributo "download" é ignorado pelo Safari — usa Web Share API
  // pra abrir o menu nativo de compartilhamento/salvar. Em outros navegadores
  // usa o fluxo normal com createObjectURL.
  async function triggerDownload(blob: Blob, filename: string) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const file  = new File([blob], filename, { type: blob.type })
    if (isIOS && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
    } else {
      const url  = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.download = filename
      link.href     = url
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }
  }

  // Captura o nó em duas camadas: as fotos de fundo vão num Canvas 2D nativo
  // (drawImage direto na resolução original — sem isso, tanto o <img> quanto o
  // background-image do html2canvas saem borrados ou distorcidos, ver
  // prepareCapture.ts) e o html2canvas roda por cima só pro resto (texto,
  // degradês, selo), com fundo transparente pra não tampar a foto já desenhada.
  async function captureNode(node: HTMLElement): Promise<Blob> {
    const { restore, photos } = await prepareNodeForCapture(node)
    // Esconde a UI de edição de enquadramento (cantos de recorte, badge de zoom)
    // antes do screenshot — ela existe só pra guiar o admin, não pra ir na arte.
    const hideEls = Array.from(node.querySelectorAll<HTMLElement>('[data-capture-hide="true"]'))
    const prevDisplay = hideEls.map((el) => el.style.display)
    hideEls.forEach((el) => { el.style.display = "none" })
    try {
      const rect = node.getBoundingClientRect()
      const W = Math.round(rect.width)  || 360
      const H = Math.round(rect.height) || Math.round(360 * 16 / 9)
      // scale:3 bate exatamente com a resolução que o Instagram recomenda pro
      // Story (1080x1920 = 360x640 * 3) — ir além disso só força esticar mais
      // as fotos originais (quase sempre com bem menos pixels que 4x).
      const SCALE = 3

      const overlay = await html2canvas(node, {
        scale: SCALE,
        width: W,
        height: H,
        useCORS: false,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        imageTimeout: 30000,
      })

      const out = document.createElement("canvas")
      out.width  = W * SCALE
      out.height = H * SCALE
      const ctx = out.getContext("2d")!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.fillStyle = "#0a0a0a"
      ctx.fillRect(0, 0, out.width, out.height)
      for (const p of photos) {
        ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, p.dx * SCALE, p.dy * SCALE, p.dw * SCALE, p.dh * SCALE)
      }
      ctx.drawImage(overlay, 0, 0)

      return new Promise<Blob>((resolve, reject) =>
        out.toBlob(b => b ? resolve(b) : reject(new Error("Captura retornou vazia")), "image/png")
      )
    } finally {
      hideEls.forEach((el, i) => { el.style.display = prevDisplay[i] })
      restore()
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setDownloadErr(null)
    const slug = `${vehicle.brand}-${vehicle.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    try {
      await waitForFonts()
      if (mediaType === "carousel") {
        const nodes = Array.from(hiddenSlidesRef.current?.querySelectorAll(".media-preview") ?? [])
        const zip = new JSZip()
        for (let i = 0; i < nodes.length; i++) {
          const blob   = await captureNode(nodes[i] as HTMLElement)
          const buffer = await blob.arrayBuffer()
          zip.file(`carousel-${slug}-${i + 1}.png`, buffer)
        }
        const zipBlob = await zip.generateAsync({ type: "blob" })
        await triggerDownload(zipBlob, `carousel-${slug}.zip`)
      } else {
        const node = previewWrapRef.current?.querySelector(".media-preview") as HTMLElement | null
        if (!node) return
        const blob = storyCollage ? await captureCollageManual(vehicle, framingPositions) : await captureNode(node)
        await triggerDownload(blob, `${mediaType}-${slug}.png`)
      }
    } catch {
      setDownloadErr("Não consegui gerar a imagem. Tenta de novo.")
    }
    setDownloading(false)
  }

  // Para o upload no Instagram, converte o Blob para data URL (uploadArtImages espera strings)
  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async function captureArtImages(): Promise<string[]> {
    await waitForFonts()
    if (mediaType === "story") {
      const node = previewWrapRef.current?.querySelector(".media-preview") as HTMLElement | null
      if (!node) throw new Error("Preview do Story não encontrado")
      return [await blobToDataUrl(storyCollage ? await captureCollageManual(vehicle, framingPositions) : await captureNode(node))]
    }
    const nodes = Array.from(hiddenSlidesRef.current?.querySelectorAll(".media-preview") ?? [])
    const dataUrls: string[] = []
    for (const node of nodes) {
      dataUrls.push(await blobToDataUrl(await captureNode(node as HTMLElement)))
    }
    return dataUrls
  }

  async function uploadArtImages(dataUrls: string[]): Promise<string[]> {
    const supabase = createClient()
    const urls: string[] = []
    for (let i = 0; i < dataUrls.length; i++) {
      const blob = await (await fetch(dataUrls[i])).blob()
      const path = `instagram-posts/${Date.now()}_${i}_${Math.random().toString(36).slice(2)}.png`
      const { error: uploadError } = await supabase.storage
        .from("vehicle-images")
        .upload(path, blob, { contentType: "image/png" })
      if (uploadError) throw new Error(uploadError.message)
      const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  async function handlePostInstagram() {
    setPosting(true)
    setPostErr(null)
    try {
      const dataUrls = await captureArtImages()
      const publicUrls = await uploadArtImages(dataUrls)
      const result = await postToInstagram({
        images: publicUrls,
        caption,
        mediaType: mediaType === "story" ? "story" : "carousel",
      })
      if (result.error) {
        setPostErr(result.error)
      } else {
        setPostedLink(result.permalink)
        setShowPostConfirm(false)
      }
    } catch (err) {
      setPostErr(err instanceof Error ? err.message : "Erro ao publicar no Instagram")
    }
    setPosting(false)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex flex-col sm:flex-row gap-4 lg:shrink-0">
        <div ref={previewWrapRef} className={`shrink-0 w-full ${mediaType === "story" ? "sm:w-[360px]" : "sm:w-[405px]"}`}>
          {mediaType === "story" && storyCollage && (
            <StoryCollagePreview vehicle={vehicle} positions={framingPositions} onPositionChange={handleFramingChange} />
          )}
          {mediaType === "story" && !storyCollage && (
            <StoryPreview
              vehicle={vehicle}
              position={framingPositions[0]}
              onPositionChange={(p) => handleFramingChange(0, p)}
              layers={storyLayers}
              onLayerPositionChange={saved ? undefined : handleLayerPositionChange}
              selectedLayer={selectedLayer}
              onSelectLayer={setSelectedLayer}
            />
          )}
          {mediaType === "post" && <PostPreview vehicle={vehicle} />}
          {mediaType === "carousel" && <CarouselPreview vehicle={vehicle} />}
        </div>

        {mediaType === "story" && !saved && (
          <div className="flex flex-col gap-4 w-full sm:w-[210px] shrink-0">
            <FramingPanel
              positions={framingPositions}
              slots={storyCollage ? COLLAGE_SLOTS : SINGLE_SLOT}
              onZoomStep={handleZoomStep}
              onResetOne={handleResetOne}
              onResetAll={() => setFramingPositions(defaultFraming)}
            />
            {!storyCollage && (
              <TextLayersPanel
                layers={storyLayers}
                isNew={vehicle.isNew}
                selected={selectedLayer}
                onSelect={setSelectedLayer}
                onTextChange={handleLayerTextChange}
                onResetOne={handleLayerResetOne}
                onResetAll={() => setStoryLayers(defaultStoryLayers(vehicle))}
              />
            )}
          </div>
        )}
      </div>

      {/* Slides escondidos — só pra capturar todas as fotos do carrossel na hora de postar */}
      {mediaType === "carousel" && (
        <div ref={hiddenSlidesRef} style={{ position: "fixed", top: 0, left: "-9999px", pointerEvents: "none" }} aria-hidden>
          {carouselSlides.map((src, i) => (
            <div key={i} className="media-preview carousel-slide">
              <PhotoSlide src={src} />
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4">
        {mediaType !== "story" && (
          <>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: MUTED }}>
                Legenda final — editável
              </label>
              <textarea
                value={caption}
                onChange={(e) => onChangeCaption(e.target.value)}
                rows={12}
                style={{
                  backgroundColor: SURF2, border: `1px solid ${BORDER}`, color: TEXT,
                  borderRadius: "10px", padding: "14px", fontSize: "13px", outline: "none",
                  width: "100%", resize: "vertical", lineHeight: "1.6",
                }}
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
          </>
        )}

        {mediaType === "story" && !saved && (
          <div
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: vehicle.isNew ? "rgba(29,63,214,0.08)" : SURF2, border: `1px solid ${vehicle.isNew ? "rgba(29,63,214,0.3)" : BORDER}` }}
          >
            <div>
              <p className="text-[13px] font-semibold flex items-center" style={{ color: vehicle.isNew ? ACCENT : TEXT }}>
                <Sparkles className="inline w-4 h-4 mr-1.5" />
                Selo &quot;Novo no estoque&quot;
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>Mostra a tag no topo da arte do Story</p>
            </div>
            <Switch value={vehicle.isNew} onChange={onToggleNewBadge} activeColor={ACCENT} disabled={updatingNewBadge} />
          </div>
        )}

        {error && (
          <p className="text-[13px]" style={{ color: "#ff6b6b" }}>{error}</p>
        )}

        {saved && !postedLink && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ backgroundColor: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: SUCCESS }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Mídia salva. {canAutoPost ? "Poste direto no Instagram ou baixe a arte." : "Baixe a imagem pra postar."}
          </div>
        )}

        {postedLink && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ backgroundColor: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: SUCCESS }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Publicado no Instagram!{" "}
            <a href={postedLink} target="_blank" rel="noopener noreferrer" className="underline">Ver post</a>
          </div>
        )}

        {downloadErr && (
          <p className="text-[13px]" style={{ color: "#ff6b6b" }}>{downloadErr}</p>
        )}

        {postErr && (
          <p className="text-[13px]" style={{ color: "#ff6b6b" }}>Falha ao publicar: {postErr}</p>
        )}

        <div className="flex flex-wrap gap-2 justify-end pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          {!saved && (
            <>
              <Button type="button" variant="outline" size="sm" onPress={onBack} className="font-semibold" isDisabled={saving}>
                Voltar
              </Button>
              <Button type="button" variant="primary" size="sm" onPress={onSave} className="font-semibold" isPending={saving}>
                Salvar mídia
              </Button>
            </>
          )}
          {saved && (
            <>
              <Button type="button" variant="outline" size="sm" className="font-semibold" onPress={handleDownload} isDisabled={downloading}>
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Baixar imagem
              </Button>
              {canAutoPost && !postedLink && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="font-semibold bg-linear-to-tr! from-[#feda75]! via-[#d62976]! to-[#4f5bd5]!"
                  onPress={() => setShowPostConfirm(true)}
                  isDisabled={posting}
                >
                  <Send className="w-4 h-4" />
                  Postar no Instagram
                </Button>
              )}
              <Button type="button" variant="primary" size="sm" className="font-semibold" onPress={onDone}>
                Ir pra Central de Mídias
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showPostConfirm}
        onClose={() => setShowPostConfirm(false)}
        onConfirm={handlePostInstagram}
        title="Postar no Instagram"
        description={
          mediaType === "story"
            ? `Vou gerar a arte e publicar como Story no Instagram da ${STORE_NAME} agora. Essa ação é imediata e pública — não dá pra desfazer por aqui.${posting ? " Publicando…" : ""}`
            : `Vou gerar as ${carouselSlides.length} fotos do carrossel e publicar no feed do Instagram da ${STORE_NAME} agora, com a legenda ao lado. Essa ação é imediata e pública — não dá pra desfazer por aqui.${posting ? " Publicando…" : ""}`
        }
        confirmLabel={posting ? "Publicando…" : "Sim, postar agora"}
        danger
      />
    </div>
  )
}
