"use client"

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight,
  Pencil, RotateCcw, Star, Trash2,
} from 'lucide-react'
import { Button, Chip } from '@heroui/react'
import { formatCurrency, formatCurrencyInput, formatKm, maskCurrencyInput, parseCurrencyInput } from '@/lib/format'
import { updateVehicleAction, markAsSold, markAsAvailable, archiveVehicle } from '@/lib/actions/vehicles'
import { STATUS_CFG } from '@/lib/constants'
import { Modal, ConfirmModal } from '@/components/ui/ConfirmModal'
import type { Vehicle } from '@/lib/types'
import type { UserInfo } from '@/lib/actions/vehicles'

import { SURFACE, BORDER, ACCENT, TEXT, MUTED, SUCCESS, YELLOW } from '@/lib/theme'

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

function daysFromDate(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
    >
      {children}
    </div>
  )
}

// ── Image gallery ─────────────────────────────────────────────────────────────

function ImageGallery({ images, thumbnails, name }: { images: string[]; thumbnails: string[]; name: string }) {
  const [idx, setIdx] = useState(0)
  const imgs    = images.length > 0 ? images : [PLACEHOLDER_IMAGE]
  const current = imgs[idx] ?? PLACEHOLDER_IMAGE

  return (
    <div className="relative" style={{ height: "300px" }}>
      {/* Foto principal — full, sem lazy (é o conteúdo principal da página). */}
      <img
        src={current}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 50%, rgba(10,10,10,0.8) 100%)" }}
      />

      {imgs.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + imgs.length) % imgs.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % imgs.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === idx ? "18px" : "6px", height: "6px",
                  backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-10 right-3 flex gap-1.5">
            {imgs.slice(0, 5).map((url, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="rounded-md overflow-hidden transition-all"
                style={{ width: "36px", height: "28px", opacity: i === idx ? 1 : 0.55, border: i === idx ? `2px solid ${ACCENT}` : "2px solid transparent" }}
              >
                <img
                  src={thumbnails[i] || url}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE }}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Edit Price Modal ──────────────────────────────────────────────────────────

function EditPriceModal({ vehicle, onSave, onClose, saving }: {
  vehicle: Vehicle
  onSave: (price: number) => void
  onClose: () => void
  saving: boolean
}) {
  const [price, setPrice] = useState(formatCurrencyInput(vehicle.price))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseCurrencyInput(price)
    if (!value || value <= 0) return
    onSave(value)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: MUTED }}>
          Preço exibido no site (R$)
        </label>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          style={{
            backgroundColor: "#111111", border: `1px solid ${BORDER}`, color: TEXT,
            borderRadius: "10px", height: "40px", paddingLeft: "12px", paddingRight: "12px",
            fontSize: "13px", outline: "none", width: "100%",
          }}
          value={price}
          onChange={(e) => setPrice(maskCurrencyInput(e.target.value))}
        />
      </div>
      <div className="flex gap-2 justify-end pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
        <Button type="button" variant="outline" size="sm" onPress={onClose} className="font-semibold">Cancelar</Button>
        <Button type="submit" variant="primary" size="sm" className="font-semibold" isPending={saving}>Salvar preço</Button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  vehicle:         Vehicle
  canSeeSensitive: boolean
  userInfo:        UserInfo | null
}

export function VehicleDetailClient({ vehicle: initialVehicle, canSeeSensitive }: Props) {
  const router = useRouter()

  const [vehicle,           setVehicle]           = useState<Vehicle>(initialVehicle)
  const [toast,             setToast]             = useState<{ message: string; variant: "success" | "error" } | null>(null)
  const [showEditPrice,     setShowEditPrice]     = useState(false)
  const [showConfirmArchive,      setShowConfirmArchive]      = useState(false)
  const [showConfirmArchiveFinal, setShowConfirmArchiveFinal] = useState(false)
  const [showConfirmSold,    setShowConfirmSold]    = useState(false)
  const [showConfirmRestore, setShowConfirmRestore] = useState(false)
  const [saving,             setSaving]             = useState(false)

  function showToast(message: string, variant: "success" | "error" = "success") {
    setToast({ message, variant })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSavePrice(price: number) {
    setSaving(true)
    const result = await updateVehicleAction(vehicle.id, { price })
    setSaving(false)
    if (result.vehicle) {
      setVehicle(result.vehicle)
      setShowEditPrice(false)
      showToast("Preço atualizado")
    }
  }

  async function handleMarkSold() {
    setSaving(true)
    const { error } = await markAsSold(vehicle.id)
    setSaving(false)
    setShowConfirmSold(false)
    if (error) {
      showToast(`Não foi possível marcar como vendido: ${error}`, "error")
      return
    }
    setVehicle((v) => ({ ...v, status: "vendido", soldAt: new Date().toISOString() }))
    showToast("Veículo marcado como vendido")
  }

  async function handleRestore() {
    setSaving(true)
    const { error } = await markAsAvailable(vehicle.id)
    setSaving(false)
    setShowConfirmRestore(false)
    if (error) {
      showToast(`Não foi possível voltar ao estoque: ${error}`, "error")
      return
    }
    setVehicle((v) => ({ ...v, status: "disponivel", soldAt: undefined }))
    showToast("Veículo voltou ao estoque")
  }

  async function handleArchive() {
    setSaving(true)
    const { error } = await archiveVehicle(vehicle.id)
    setSaving(false)
    if (error) {
      setShowConfirmArchiveFinal(false)
      showToast(`Não foi possível apagar o carro: ${error}`, "error")
      return
    }
    router.push('/estoque')
  }

  function handleConfirmArchiveStep1() {
    setShowConfirmArchive(false)
    setShowConfirmArchiveFinal(true)
  }

  const sc        = STATUS_CFG[vehicle.status] ?? STATUS_CFG.disponivel
  const stockDays = daysFromDate(vehicle.acquiredAt ?? vehicle.createdAt)
  const isSold    = vehicle.status === "vendido"
  const images     = vehicle.images?.length ? vehicle.images : vehicle.imageUrl ? [vehicle.imageUrl] : []
  const thumbnails = vehicle.thumbnails ?? []

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">

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
          <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: toast.variant === "success" ? SUCCESS : "#ff6b6b" }} />
          {toast.message}
        </div>
      )}

      {/* Back */}
      <Link
        href="/estoque"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
        style={{ color: MUTED }}
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao estoque
      </Link>

      {/* Main card */}
      <Card className={`overflow-hidden ${isSold ? "opacity-70" : ""}`}>
        <div className="flex flex-col lg:flex-row">
          <div className="relative lg:w-[42%] shrink-0">
            <ImageGallery images={images} thumbnails={thumbnails} name={vehicle.name} />
            <span
              className="absolute top-4 left-4 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)", backdropFilter: "blur(4px)" }}
            >
              {stockDays}d no estoque
            </span>
            <Chip size="sm" variant="soft" color={sc.chipColor} className="absolute top-4 right-4 backdrop-blur-sm font-bold">
              {sc.label}
            </Chip>
          </div>

          <div className="flex-1 p-7 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: MUTED }}>{vehicle.brand}</p>
                  {vehicle.category && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(29,63,214,0.15)", color: ACCENT }}>
                      {vehicle.category}
                    </span>
                  )}
                  {vehicle.isPremium && (
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1"
                      style={{ backgroundColor: "rgba(255,174,31,0.15)", color: YELLOW }}
                    >
                      <Star className="w-2.5 h-2.5" />Destaque
                    </span>
                  )}
                </div>
                <h1 className="text-[28px] font-black leading-tight mt-1" style={{ color: TEXT }}>{vehicle.name}</h1>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
                {[
                  ["Ano",           vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : vehicle.year.toString()],
                  ["Quilometragem", formatKm(vehicle.km)],
                  ["Câmbio",        vehicle.transmission],
                  ["Combustível",   vehicle.fuel],
                  ["Portas",        `${vehicle.doors} portas`],
                  ...(vehicle.color ? [["Cor", vehicle.color]] : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>{label}</p>
                    <p className="text-[13px] font-semibold mt-0.5" style={{ color: TEXT }}>{value}</p>
                  </div>
                ))}
              </div>

              {(vehicle.optionals?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Opcionais</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vehicle.optionals.map((opt) => (
                      <span
                        key={opt}
                        className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: "rgba(29,63,214,0.1)", color: ACCENT, border: "1px solid rgba(29,63,214,0.2)" }}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "20px" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest uppercase mb-1.5" style={{ color: MUTED }}>Preço</p>
                  <p className="text-[36px] font-black tabular-nums" style={{ color: TEXT }}>{formatCurrency(vehicle.price)}</p>
                </div>
                {canSeeSensitive && (
                  <button
                    type="button"
                    onClick={() => setShowEditPrice(true)}
                    className="rounded-lg p-2 transition-colors hover:bg-white/5 shrink-0"
                    style={{ color: MUTED, border: `1px solid ${BORDER}` }}
                    title="Editar preço"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {canSeeSensitive && (
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "16px" }} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/estoque/${vehicle.id}/editar`}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors hover:bg-white/5"
                  style={{ color: TEXT, border: `1px solid ${BORDER}` }}
                >
                  <Pencil className="w-4 h-4" />
                  Editar carro
                </Link>
                <div className="flex-1 hidden sm:block" />
                {!isSold && (
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => setShowConfirmSold(true)}
                    className="font-semibold bg-[#25d366]! hover:bg-[#1aad54]!"
                    isPending={saving}
                  >
                    <BadgeCheck className="w-4 h-4" />
                    Marcar como vendido
                  </Button>
                )}
                {isSold && (
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => setShowConfirmRestore(true)}
                    className="font-semibold bg-[#ffae1f]! hover:bg-[#e69a14]!"
                    isPending={saving}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Voltar ao estoque
                  </Button>
                )}
                <Button variant="danger-soft" size="sm" onPress={() => setShowConfirmArchive(true)} className="font-semibold">
                  <Trash2 className="w-4 h-4" />
                  Apagar carro
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Modals */}
      <Modal open={showEditPrice} onClose={() => setShowEditPrice(false)} title="Editar preço">
        <EditPriceModal vehicle={vehicle} onSave={handleSavePrice} onClose={() => setShowEditPrice(false)} saving={saving} />
      </Modal>
      <ConfirmModal
        open={showConfirmSold}
        onClose={() => setShowConfirmSold(false)}
        onConfirm={handleMarkSold}
        title="Marcar como vendido"
        description={`Tem certeza que deseja marcar "${vehicle.brand} ${vehicle.name}" como vendido?`}
        confirmLabel="Sim, marcar vendido"
      />
      <ConfirmModal
        open={showConfirmRestore}
        onClose={() => setShowConfirmRestore(false)}
        onConfirm={handleRestore}
        title="Voltar ao estoque"
        description={`Tem certeza que deseja voltar "${vehicle.brand} ${vehicle.name}" ao estoque disponível?`}
        confirmLabel="Sim, voltar ao estoque"
      />
      <ConfirmModal
        open={showConfirmArchive}
        onClose={() => setShowConfirmArchive(false)}
        onConfirm={handleConfirmArchiveStep1}
        title="Apagar carro do estoque"
        description={`Tem certeza que deseja apagar "${vehicle.brand} ${vehicle.name}" do estoque? Ele some imediatamente do estoque ativo e do site.`}
        confirmLabel="Sim, apagar"
        danger
      />
      <ConfirmModal
        open={showConfirmArchiveFinal}
        onClose={() => setShowConfirmArchiveFinal(false)}
        onConfirm={handleArchive}
        title="Confirmar de novo"
        description={`Essa é a última confirmação: "${vehicle.brand} ${vehicle.name}" vai ser apagado do estoque agora. Não tem desfazer por aqui.`}
        confirmLabel={saving ? "Apagando…" : "Sim, apagar definitivamente"}
        danger
      />
    </div>
  )
}
