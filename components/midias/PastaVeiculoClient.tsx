"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import html2canvas from "html2canvas"
import { AlertTriangle, ArrowLeft, CheckCircle2, Clipboard, Download, Eye, Folder, Loader2, Send, Trash2, X } from "lucide-react"
import { Button, Chip } from "@heroui/react"
import { VeiculoResumoCard } from "@/components/midias/VeiculoResumoCard"
import { StoryPreview } from "@/components/midias/preview/StoryPreview"
import { StoryCollagePreview } from "@/components/midias/preview/StoryCollagePreview"
import { PostPreview } from "@/components/midias/preview/PostPreview"
import { CarouselPreview } from "@/components/midias/preview/CarouselPreview"
import { deleteGeneratedMedia } from "@/lib/actions/media"
import { postToInstagram } from "@/lib/actions/instagram"
import { createClient } from "@/lib/supabase/client"
import { MEDIA_TYPE_CFG, STORE_NAME } from "@/lib/constants"
import { captureCollage as captureCollageManual } from "@/lib/midias/captureCollage"
import { prepareNodeForCapture } from "@/lib/midias/prepareCapture"
import type { GeneratedMedia, MediaFolder, MediaType, Vehicle } from "@/lib/types"

// html2canvas não usa SVG foreignObject — re-implementa o CSS diretamente no
// Canvas 2D, o que resolve o bug do iOS Safari que tornava as fotos pretas.

import { SURFACE, SURF2, BORDER, ACCENT, TEXT, MUTED, SUCCESS, DANGER_LIGHT as DANGER } from "@/lib/theme"

const GROUP_ORDER: { type: MediaType; label: string }[] = [
  { type: "story",    label: "Stories" },
  { type: "post",     label: "Posts" },
  { type: "carousel", label: "Carrosséis" },
]

// ── Primitives (mesmo padrão usado em VehicleDetailClient) ───────────────────

// Renderiza num portal pro <body> — a animação de transição de página (motion.div
// com transform no Shell) cria um containing block novo pra elementos fixed, então
// um modal "fixed inset-0" preso dentro da árvore da página não cobre o header fixo.
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative rounded-2xl w-full max-w-lg z-10 overflow-hidden max-h-[85vh] flex flex-col"
        style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h2 className="text-[15px] font-bold" style={{ color: TEXT }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-white/5" style={{ color: MUTED }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}

function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", confirming = false, danger = false }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; description: string; confirmLabel?: string; confirming?: boolean; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>{description}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onPress={onClose} className="font-semibold" isDisabled={confirming}>Cancelar</Button>
          <Button variant={danger ? "danger-soft" : "primary"} size="sm" onPress={onConfirm} className="font-semibold" isPending={confirming}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

type Props = {
  folder: MediaFolder
  vehicle: Vehicle
  media: GeneratedMedia[]
}

export function PastaVeiculoClient({ folder, vehicle, media }: Props) {
  const router = useRouter()
  // Sem cópia local da lista — sempre renderiza a partir do prop `media`, que vem
  // direto do servidor. Depois de apagar, router.refresh() busca os dados de novo
  // e o React re-renderiza com a lista já atualizada (evita ficar desincronizado).
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null)

  function showToast(message: string, variant: "success" | "error" = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), variant === "error" ? 8000 : 3000)
  }

  async function handleDeleteMedia(id: string) {
    setDeletingId(id)
    const { error } = await deleteGeneratedMedia(id)
    setDeletingId(null)
    if (error) {
      showToast("Não foi possível apagar a mídia. Tente de novo.", "error")
      return
    }
    showToast("Mídia apagada")
    router.refresh()
  }

  return (
    <div className="p-5 space-y-6 max-w-300 mx-auto">

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold"
          style={{
            backgroundColor: SURFACE,
            border: `1px solid ${toast.variant === "success" ? "rgba(37,211,102,0.3)" : "rgba(255,107,107,0.3)"}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            color: TEXT,
          }}
        >
          {toast.variant === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: SUCCESS }} />
            : <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: DANGER }} />}
          {toast.message}
        </div>
      )}

      <div>
        <Link
          href="/midias"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
          style={{ color: MUTED }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar pra Central de Mídias
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <Folder className="w-5 h-5" style={{ color: ACCENT }} />
          <h1 className="text-[22px] font-black" style={{ color: TEXT }}>{folder.folderName}</h1>
        </div>
        <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
          {media.length} {media.length === 1 ? "mídia salva" : "mídias salvas"}
        </p>
      </div>

      <VeiculoResumoCard vehicle={vehicle} />

      {media.length === 0 ? (
        <div
          className="rounded-2xl py-16 flex flex-col items-center gap-3 text-center"
          style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p className="text-[14px] font-bold" style={{ color: TEXT }}>Nenhuma mídia salva nessa pasta ainda</p>
          <Link
            href="/midias/nova"
            className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 rounded-xl mt-2"
            style={{ height: "36px", background: "#1d3fd6", color: "#ffffff" }}
          >
            Gerar mídia
          </Link>
        </div>
      ) : (
        GROUP_ORDER.map(({ type, label }) => {
          const group = media.filter((m) => m.mediaType === type)
          if (group.length === 0) return null
          return (
            <div key={type} className="space-y-3">
              <h2 className="text-[14px] font-bold" style={{ color: TEXT }}>{label} <span style={{ color: MUTED }}>({group.length})</span></h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {group.map((m) => (
                  <MediaDetailCard
                    key={m.id}
                    media={m}
                    vehicle={vehicle}
                    deleting={deletingId === m.id}
                    onDelete={() => handleDeleteMedia(m.id)}
                    onToast={showToast}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function MediaDetailCard({ media, vehicle, deleting, onDelete, onToast }: {
  media: GeneratedMedia
  vehicle: Vehicle
  deleting: boolean
  onDelete: () => Promise<void>
  onToast: (message: string, variant?: "success" | "error") => void
}) {
  const [showPreviewModal,  setShowPreviewModal]  = useState(false)
  const [showDeleteModal,   setShowDeleteModal]   = useState(false)
  const [showPostModal,     setShowPostModal]     = useState(false)
  const [downloading,       setDownloading]       = useState(false)
  const [posting,           setPosting]           = useState(false)
  // captureModalRef aponta pro wrapper do preview dentro do modal de visualização.
  // O download captura desse elemento visível (não de um hidden preview) — garante
  // que as imagens estão carregadas, porque o usuário pode literalmente vê-las.
  const captureModalRef = useRef<HTMLDivElement>(null)

  const isCollage = media.previewData?.layout === "instagram-story-collage-v1"
  const collagePhotos = isCollage ? (media.previewData?.collagePhotos as string[] | undefined) : undefined
  const coverPhoto = !isCollage ? (media.previewData?.coverPhoto as string | undefined) : undefined
  const previewVehicle = collagePhotos?.length
    ? { ...vehicle, images: collagePhotos }
    : coverPhoto
    ? { ...vehicle, images: [coverPhoto] }
    : vehicle

  // Captura o nó em duas camadas: as fotos de fundo vão num Canvas 2D nativo
  // (drawImage direto na resolução original — sem isso, tanto o <img> quanto o
  // background-image do html2canvas saem borrados ou distorcidos, ver
  // prepareCapture.ts) e o html2canvas roda por cima só pro resto (texto,
  // degradês, selo), com fundo transparente pra não tampar a foto já desenhada.
  async function captureNode(node: HTMLElement): Promise<Blob> {
    const { restore, photos } = await prepareNodeForCapture(node)
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
      restore()
    }
  }

  // Aguarda todos os <img> do preview do modal confirmarem load.
  // Chamado depois de abrir o modal — modal visível = browser carrega imagens eagerly.
  async function waitForModalImages(): Promise<void> {
    const node = captureModalRef.current
    if (!node) return
    const imgs = Array.from(node.querySelectorAll<HTMLImageElement>("img"))
    await Promise.race([
      Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        return new Promise<void>(resolve => {
          img.addEventListener("load",  () => resolve(), { once: true })
          img.addEventListener("error", () => resolve(), { once: true })
        })
      })),
      new Promise<void>(resolve => setTimeout(resolve, 15_000)),
    ])
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(media.caption)
      onToast("Legenda copiada")
    } catch {
      onToast("Não foi possível copiar a legenda. Tente selecionar o texto manualmente.", "error")
    }
  }

  async function handleDownloadImage() {
    setDownloading(true)
    try {
      if (document.fonts) await document.fonts.ready
      let blob: Blob
      if (isCollage) {
        // Collage: Canvas 2D puro — carrega fotos via proxy, sem precisar do DOM
        blob = await captureCollageManual(previewVehicle)
      } else {
        setShowPreviewModal(true)
        await new Promise(resolve => setTimeout(resolve, 200))
        await waitForModalImages()
        const previewEl = captureModalRef.current?.querySelector(".media-preview") as HTMLElement | null
        if (!previewEl) throw new Error("Preview não encontrado")
        blob = await captureNode(previewEl)
        setShowPreviewModal(false)
      }
      const slug     = `${vehicle.brand}-${vehicle.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const filename = `${media.mediaType}-${slug}.png`
      const file     = new File([blob], filename, { type: "image/png" })
      const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent)
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
    } catch (err) {
      console.error("[download] falha ao capturar preview:", err)
      onToast("Não consegui gerar a imagem. Tente de novo.", "error")
      setShowPreviewModal(false)
    }
    setDownloading(false)
  }

  async function handlePostInstagram() {
    setPosting(true)
    setShowPostModal(false)
    try {
      if (document.fonts) await document.fonts.ready
      let blob: Blob
      if (isCollage) {
        blob = await captureCollageManual(previewVehicle)
      } else {
        setShowPreviewModal(true)
        await new Promise(resolve => setTimeout(resolve, 200))
        await waitForModalImages()
        const previewEl = captureModalRef.current?.querySelector(".media-preview") as HTMLElement | null
        if (!previewEl) throw new Error("Preview não encontrado")
        blob = await captureNode(previewEl)
        setShowPreviewModal(false)
      }

      const supabase = createClient()
      const path = `instagram-posts/${Date.now()}_${Math.random().toString(36).slice(2)}.png`
      const { error: uploadError } = await supabase.storage
        .from("vehicle-images")
        .upload(path, blob, { contentType: "image/png" })
      if (uploadError) throw new Error(uploadError.message)
      const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path)

      const result = await postToInstagram({ images: [data.publicUrl], caption: "", mediaType: "story" })
      if (result.error) throw new Error(result.error)

      onToast("Postado no Instagram Stories!")
    } catch (err) {
      console.error("[instagram] falha ao capturar/publicar:", err)
      onToast(err instanceof Error ? `Falha ao publicar: ${err.message}` : "Falha ao publicar no Instagram", "error")
    }
    setShowPreviewModal(false)
    setPosting(false)
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: "rgba(29,63,214,0.12)", color: ACCENT }}
        >
          {MEDIA_TYPE_CFG[media.mediaType].label}
        </span>
        <Chip size="sm" variant="soft" color="success" className="text-[10px] font-bold">Salvo</Chip>
      </div>

      <p className="text-[13px] font-bold" style={{ color: TEXT }}>{media.title}</p>

      <div
        className="rounded-xl p-3 text-[12px] whitespace-pre-line max-h-40 overflow-y-auto"
        style={{ backgroundColor: SURF2, color: MUTED, lineHeight: 1.6 }}
      >
        {media.caption}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" size="sm" className="font-semibold" onPress={() => setShowPreviewModal(true)}>
          <Eye className="w-3.5 h-3.5" />
          Visualizar
        </Button>
        {media.mediaType === "story" ? (
          <>
            <Button variant="outline" size="sm" className="font-semibold" onPress={handleDownloadImage} isDisabled={downloading}>
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Salvar imagem
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="font-semibold bg-linear-to-tr! from-[#feda75]! via-[#d62976]! to-[#4f5bd5]!"
              onPress={() => setShowPostModal(true)}
              isDisabled={posting}
            >
              <Send className="w-3.5 h-3.5" />
              Postar no Instagram
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="font-semibold" onPress={handleCopy}>
            <Clipboard className="w-3.5 h-3.5" />
            Copiar legenda
          </Button>
        )}
        <Button variant="danger-soft" size="sm" className="font-semibold" onPress={() => setShowDeleteModal(true)}>
          <Trash2 className="w-3.5 h-3.5" />
          Apagar
        </Button>
      </div>

      {/* Modal de visualização — também usado como fonte para captura de download/post.
          onClose bloqueado enquanto downloading/posting pra evitar fechar durante captura. */}
      <Modal
        open={showPreviewModal}
        onClose={() => { if (!downloading && !posting) setShowPreviewModal(false) }}
        title={media.title}
      >
        <div className="space-y-5">
          <div className="flex justify-center relative">
            {/* captureModalRef envolve só o preview — a overlay de carregamento fica fora.
                Largura explícita é necessária pro width:100% do .media-preview resolver
                (dentro de flex justify-center, um item sem largura própria colapsa pra 0). */}
            <div ref={captureModalRef} className={`shrink-0 w-full ${media.mediaType === "story" ? "sm:w-[360px]" : "sm:w-[405px]"}`}>
              {media.mediaType === "story" && isCollage && <StoryCollagePreview vehicle={previewVehicle} />}
              {media.mediaType === "story" && !isCollage && <StoryPreview vehicle={previewVehicle} />}
              {media.mediaType === "post" && <PostPreview vehicle={vehicle} />}
              {media.mediaType === "carousel" && <CarouselPreview vehicle={vehicle} />}
            </div>
            {(downloading || posting) && (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl"
                style={{ backgroundColor: "rgba(10,10,10,0.8)" }}
              >
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: MUTED }}>Legenda salva</p>
            <div
              className="rounded-xl p-3 text-[12px] whitespace-pre-line max-h-48 overflow-y-auto"
              style={{ backgroundColor: SURF2, color: TEXT, lineHeight: 1.6 }}
            >
              {media.caption}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmação de exclusão */}
      <ConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => { await onDelete(); setShowDeleteModal(false) }}
        title="Apagar mídia"
        description="Essa mídia é apagada de vez — some da Central de Mídias e da pasta do veículo, sem volta."
        confirmLabel="Sim, apagar"
        confirming={deleting}
        danger
      />

      {/* Confirmação de publicação */}
      <ConfirmModal
        open={showPostModal}
        onClose={() => setShowPostModal(false)}
        onConfirm={handlePostInstagram}
        title="Postar no Instagram"
        description={`Vou gerar a arte dessa mídia salva e publicar como Story no Instagram da ${STORE_NAME} agora.${posting ? " Publicando…" : " Essa ação é imediata e pública — não dá pra desfazer por aqui. Pode postar de novo quantas vezes quiser."}`}
        confirmLabel={posting ? "Publicando…" : "Sim, postar agora"}
        confirming={posting}
        danger
      />
    </div>
  )
}
