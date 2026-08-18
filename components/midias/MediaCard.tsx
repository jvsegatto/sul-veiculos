"use client"

import { useState } from "react"
import Link from "next/link"
import { Chip } from "@heroui/react"
import { Clapperboard, Image as ImageIcon, GalleryHorizontal, Folder, Trash2 } from "lucide-react"
import { MEDIA_TYPE_CFG, MEDIA_STATUS_CFG } from "@/lib/constants"
import { deleteGeneratedMedia } from "@/lib/actions/media"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import type { GeneratedMediaWithRelations } from "@/lib/types"

import { CARD, BORDER, TEXT, MUTED } from "@/lib/theme"

const TYPE_ICON = {
  story:    Clapperboard,
  post:     ImageIcon,
  carousel: GalleryHorizontal,
} as const

type Props = {
  media: GeneratedMediaWithRelations
  onDeleted?: (id: string) => void
  onError?: (message: string) => void
}

export function MediaCard({ media, onDeleted, onError }: Props) {
  const tc = MEDIA_TYPE_CFG[media.mediaType]
  const sc = MEDIA_STATUS_CFG[media.status]
  const Icon = TYPE_ICON[media.mediaType]
  const isCarousel = media.mediaType === "carousel"
  const showThumbnail = isCarousel || media.mediaType === "story"

  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  function openConfirm(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(true)
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await deleteGeneratedMedia(media.id)
    setDeleting(false)
    setShowConfirm(false)
    if (error) {
      onError?.("Não foi possível apagar a mídia. Tente de novo.")
      return
    }
    onDeleted?.(media.id)
  }

  return (
    <>
      <Link
        href={`/midias/pasta/${media.folderId}`}
        className="block rounded-xl overflow-hidden p-4 space-y-3 transition-colors hover:bg-white/2"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: "rgba(29,63,214,0.12)", color: "#E2231A" }}
          >
            <Icon className="w-3.5 h-3.5" />
            {tc.label}
          </span>
          <div className="flex items-center gap-1.5">
            <Chip size="sm" variant="soft" color={sc.chipColor} className="text-[10px] font-bold">
              {sc.label}
            </Chip>
            <button
              type="button"
              onClick={openConfirm}
              title="Apagar mídia"
              className="inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:bg-white/10 shrink-0"
              style={{ color: MUTED }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {showThumbnail && (
          <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "16/9", backgroundColor: "#111111" }}>
            {media.vehicleImage ? (
              <img src={media.vehicleImage} alt={media.vehicleName} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon className="w-5 h-5" style={{ color: MUTED }} />
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-[14px] font-bold line-clamp-1" style={{ color: TEXT }}>{media.title}</p>
          <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>{media.vehicleName || "Veículo não encontrado"}</p>
        </div>

        {!isCarousel && media.folderName && (
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: MUTED }}>
            <Folder className="w-3 h-3" />
            {media.folderName}
          </div>
        )}

        {!isCarousel && (
          <p className="text-[11px] line-clamp-2" style={{ color: MUTED }}>{media.caption}</p>
        )}
      </Link>

      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Apagar mídia"
        description={`Tem certeza que deseja apagar "${media.title}"? A mídia é apagada de vez, sem volta.`}
        confirmLabel={deleting ? "Apagando…" : "Sim, apagar"}
        danger
      />
    </>
  )
}
