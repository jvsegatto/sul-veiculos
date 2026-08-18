"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, CheckCircle2, Loader2, Package, Sparkles, XCircle } from "lucide-react"
import { Button } from "@heroui/react"
import { SelecionarVeiculo } from "@/components/midias/steps/SelecionarVeiculo"
import { VeiculoResumoCard } from "@/components/midias/VeiculoResumoCard"
import { EscolherFormato, mediaTypeFromFormato, type FormatoKey } from "@/components/midias/steps/EscolherFormato"
import { SelecionarFotos, MAX_FOTOS_CARROSSEL } from "@/components/midias/steps/SelecionarFotos"
import { SelecionarFotosCollage } from "@/components/midias/steps/SelecionarFotosCollage"
import { SelecionarFotoCapa } from "@/components/midias/steps/SelecionarFotoCapa"
import { Legenda } from "@/components/midias/steps/Legenda"
import { PreviewFinal } from "@/components/midias/steps/PreviewFinal"
import { getDimensionsForType } from "@/lib/midias/dimensoes"
import { gerarLegenda, gerarHashtags, formatPrecoSemCentavos } from "@/lib/midias/legenda"
import { createGeneratedMedia } from "@/lib/actions/media"
import { updateVehicleAction } from "@/lib/actions/vehicles"
import { formatKm } from "@/lib/format"
import type { Vehicle } from "@/lib/types"

import { SURFACE, SURF2, BORDER, ACCENT, TEXT, MUTED, SUCCESS } from "@/lib/theme"

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop"

const FORMATO_LABEL: Record<FormatoKey, string> = {
  "story":         "Story",
  "story-collage": "Story (3 fotos)",
  "carousel":      "Carrossel",
}

type BatchResult = {
  vehicleId:   string
  vehicleName: string
  formato:     FormatoKey
  status:      "pending" | "saving" | "saved" | "error"
  error?:      string
}

type Props = {
  vehicles: Vehicle[]
}

export function NovaMidiaWizard({ vehicles }: Props) {
  const router = useRouter()

  // ── Estado modo single (fluxo normal) ─────────────────────────────────────
  const [step,             setStep]             = useState(0)
  const [vehicle,          setVehicle]          = useState<Vehicle | null>(null)
  const [formatos,         setFormatos]         = useState<FormatoKey[]>([])
  const [carouselPhotos,   setCarouselPhotos]   = useState<string[]>([])
  const [collagePhotos,    setCollagePhotos]    = useState<string[]>([])
  const [storyCoverPhoto,  setStoryCoverPhoto]  = useState<string>("")
  const [caption,          setCaption]          = useState("")
  const [hashtags,         setHashtags]         = useState<string[]>([])
  const [savingFormato,    setSavingFormato]    = useState<FormatoKey | null>(null)
  const [savedFormats,     setSavedFormats]     = useState<Set<FormatoKey>>(new Set())
  const [error,            setError]            = useState<string | null>(null)
  const [activePreviewTab, setActivePreviewTab] = useState<FormatoKey | null>(null)
  const [updatingNewBadge, setUpdatingNewBadge] = useState(false)

  // ── Estado modo em lote ────────────────────────────────────────────────────
  const [batchMode,     setBatchMode]     = useState(false)
  const [batchVehicles, setBatchVehicles] = useState<Vehicle[]>([])
  const [batchResults,  setBatchResults]  = useState<BatchResult[]>([])
  const [batchRunning,  setBatchRunning]  = useState(false)
  const [batchDone,     setBatchDone]     = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  // ── Cálculos derivados ─────────────────────────────────────────────────────
  const needsPhotos  = formatos.some(f => f === "carousel" || f === "story-collage" || f === "story")
  const showPhotoSectionLabels =
    [formatos.includes("carousel"), formatos.includes("story-collage"), formatos.includes("story")]
      .filter(Boolean).length > 1
  const needsCaption = formatos.includes("carousel")

  const STEP_SEQ = batchMode
    ? [0, 1, 5]
    : [0, 1, ...(needsPhotos ? [2] : []), ...(needsCaption ? [3] : []), 4]

  const STEP_LABEL_MAP: Record<number, string> = {
    0: batchMode ? "Selecionar carros" : "Selecionar carro",
    1: "Escolher formatos",
    2: "Selecionar fotos",
    3: "Gerar legenda",
    4: "Preview e salvar",
    5: "Gerar e salvar tudo",
  }
  const STEP_LABELS  = STEP_SEQ.map(n => STEP_LABEL_MAP[n])
  const stepPosition = STEP_SEQ.indexOf(step)

  // ── Handlers modo single ───────────────────────────────────────────────────
  function handleSelectVehicle(v: Vehicle) {
    setVehicle(v)
    setCarouselPhotos((v.images ?? []).slice(0, MAX_FOTOS_CARROSSEL))
    setCollagePhotos([])
    setStoryCoverPhoto((v.images ?? [])[0] ?? "")
    setSavedFormats(new Set())
    setSavingFormato(null)
    setActivePreviewTab(null)
    setError(null)
  }

  function handleToggleFormato(key: FormatoKey) {
    const adding = !formatos.includes(key)
    setFormatos(prev => adding ? [...prev, key] : prev.filter(k => k !== key))
    if (!adding || !vehicle) return
    const imgs = vehicle.images ?? []
    if (key === "story-collage" && collagePhotos.length === 0) {
      setCollagePhotos([imgs[0] ?? "", imgs[1] ?? imgs[0] ?? "", imgs[2] ?? imgs[0] ?? ""])
    }
  }

  function advanceFromFormato() {
    if (batchMode) {
      setStep(5)
      return
    }
    if (needsPhotos) {
      setStep(2)
    } else {
      setCaption("")
      setHashtags([])
      setActivePreviewTab(formatos[0])
      setStep(4)
    }
  }

  function advanceFromFotos() {
    if (!vehicle) return
    if (needsCaption) {
      setCaption(gerarLegenda(vehicle))
      setHashtags(gerarHashtags(vehicle))
      setStep(3)
    } else {
      setCaption("")
      setHashtags([])
      setActivePreviewTab(formatos[0])
      setStep(4)
    }
  }

  function advanceFromLegenda() {
    setActivePreviewTab(formatos[0])
    setStep(4)
  }

  function getBackFromPreview() {
    if (needsCaption) return 3
    if (needsPhotos) return 2
    return 1
  }

  function getPreviewVehicle(fmt: FormatoKey): Vehicle {
    if (!vehicle) return null!
    if (fmt === "carousel")      return { ...vehicle, images: carouselPhotos }
    if (fmt === "story-collage") return { ...vehicle, images: collagePhotos }
    if (fmt === "story")         return { ...vehicle, images: storyCoverPhoto ? [storyCoverPhoto] : vehicle.images }
    return vehicle
  }

  async function handleToggleNewBadge(value: boolean) {
    if (!vehicle) return
    setVehicle(v => v && { ...v, isNew: value })
    setUpdatingNewBadge(true)
    await updateVehicleAction(vehicle.id, { isNew: value })
    setUpdatingNewBadge(false)
  }

  async function handleSave(fmt: FormatoKey) {
    if (!vehicle) return
    const mt        = mediaTypeFromFormato(fmt)
    const isCollage = fmt === "story-collage"
    const photos    = fmt === "carousel" ? carouselPhotos : fmt === "story-collage" ? collagePhotos : []

    setSavingFormato(fmt)
    setError(null)

    const baseDimensions = getDimensionsForType(mt)
    const dimensions = mt === "carousel"
      ? { ...baseDimensions, slideCount: photos.length + 4 }
      : baseDimensions

    const result = await createGeneratedMedia({
      vehicleId:    vehicle.id,
      vehicleModel: vehicle.model || vehicle.name,
      mediaType:    mt,
      title:        `${FORMATO_LABEL[fmt]} ${vehicle.name}`.trim(),
      previewData: {
        vehicleSnapshot: {
          brand:   vehicle.brand,
          model:   vehicle.model,
          version: vehicle.name,
          year:    vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : `${vehicle.year}`,
          price:   vehicle.price ? formatPrecoSemCentavos(vehicle.price) : "",
          mileage: vehicle.km    ? formatKm(vehicle.km) : "",
        },
        layout: isCollage ? "instagram-story-collage-v1" : `instagram-${mt}-v1`,
        ...(isCollage ? { collagePhotos: photos } : {}),
        ...(fmt === "story" ? { coverPhoto: storyCoverPhoto } : {}),
      },
      caption:  mt === "story" ? "" : caption,
      hashtags: mt === "story" ? [] : hashtags,
      dimensions,
    })

    setSavingFormato(null)
    if (!result.media) {
      setError(result.error ?? "Erro ao salvar mídia")
      return
    }
    setSavedFormats(prev => new Set([...prev, fmt]))
  }

  // ── Handlers modo em lote ──────────────────────────────────────────────────
  function handleToggleBatchMode() {
    const enabling = !batchMode
    setBatchMode(enabling)
    setStep(0)
    setVehicle(null)
    setBatchVehicles([])
    setFormatos([])
    setBatchResults([])
    setBatchRunning(false)
    setBatchDone(false)
    setSavedFormats(new Set())
    setError(null)
  }

  function handleToggleBatchVehicle(v: Vehicle) {
    setBatchVehicles(prev => {
      const exists = prev.some(p => p.id === v.id)
      return exists ? prev.filter(p => p.id !== v.id) : [...prev, v]
    })
  }

  async function saveBatchItem(v: Vehicle, fmt: FormatoKey): Promise<void> {
    const mt        = mediaTypeFromFormato(fmt)
    const isCollage = fmt === "story-collage"
    const imgs      = v.images ?? []

    let photos: string[] = []
    if (fmt === "carousel") {
      photos = imgs.slice(0, MAX_FOTOS_CARROSSEL)
    } else if (fmt === "story-collage") {
      photos = [
        imgs[0] ?? "",
        imgs[1] ?? imgs[0] ?? "",
        imgs[2] ?? imgs[0] ?? "",
      ]
    }

    const cap  = mt === "story" ? "" : gerarLegenda(v)
    const tags = mt === "story" ? [] : gerarHashtags(v)

    const baseDimensions = getDimensionsForType(mt)
    const dimensions = mt === "carousel"
      ? { ...baseDimensions, slideCount: photos.length + 4 }
      : baseDimensions

    const result = await createGeneratedMedia({
      vehicleId:    v.id,
      vehicleModel: v.model || v.name,
      mediaType:    mt,
      title:        `${FORMATO_LABEL[fmt]} ${v.name}`.trim(),
      previewData: {
        vehicleSnapshot: {
          brand:   v.brand,
          model:   v.model,
          version: v.name,
          year:    v.yearModel ? `${v.year}/${v.yearModel}` : `${v.year}`,
          price:   v.price ? formatPrecoSemCentavos(v.price) : "",
          mileage: v.km    ? formatKm(v.km) : "",
        },
        layout: isCollage ? "instagram-story-collage-v1" : `instagram-${mt}-v1`,
        ...(isCollage ? { collagePhotos: photos } : {}),
      },
      caption:  cap,
      hashtags: tags,
      dimensions,
    })

    if (!result.media) throw new Error(result.error ?? "Erro ao salvar")
  }

  async function runBatch() {
    if (batchVehicles.length === 0 || formatos.length === 0) return

    const items = batchVehicles.flatMap(v => formatos.map(fmt => ({ vehicle: v, formato: fmt })))

    setBatchResults(items.map(({ vehicle: v, formato: fmt }) => ({
      vehicleId:   v.id,
      vehicleName: v.name,
      formato:     fmt,
      status:      "pending",
    })))
    setBatchRunning(true)

    for (const { vehicle: v, formato: fmt } of items) {
      setBatchResults(prev => prev.map(r =>
        r.vehicleId === v.id && r.formato === fmt ? { ...r, status: "saving" } : r
      ))
      try {
        await saveBatchItem(v, fmt)
        setBatchResults(prev => prev.map(r =>
          r.vehicleId === v.id && r.formato === fmt ? { ...r, status: "saved" } : r
        ))
      } catch (err) {
        setBatchResults(prev => prev.map(r =>
          r.vehicleId === v.id && r.formato === fmt
            ? { ...r, status: "error", error: err instanceof Error ? err.message : "Erro" }
            : r
        ))
      }
    }

    setBatchRunning(false)
    setBatchDone(true)
  }

  // ── Utilitários de render ──────────────────────────────────────────────────
  const formatsLabel = formatos.map(f => FORMATO_LABEL[f]).join(" + ")
  const allSaved     = formatos.length > 0 && formatos.every(f => savedFormats.has(f))
  const batchTotal   = batchVehicles.length * formatos.length
  const batchSaved   = batchResults.filter(r => r.status === "saved").length
  const batchErrors  = batchResults.filter(r => r.status === "error").length

  return (
    <div className="p-5 space-y-6 max-w-300 mx-auto">

      {/* Header */}
      <div>
        <Link
          href="/midias"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
          style={{ color: MUTED }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar pra Central de Mídias
        </Link>
        <h1 className="text-[22px] font-black mt-2" style={{ color: TEXT }}>Nova mídia</h1>
      </div>

      {/* Stepper mobile */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between text-[12px] font-semibold">
          <span style={{ color: MUTED }}>Passo {stepPosition + 1} de {STEP_LABELS.length}</span>
          <span style={{ color: ACCENT }}>{STEP_LABELS[stepPosition]}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: SURF2 }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${((stepPosition + 1) / STEP_LABELS.length) * 100}%`, backgroundColor: ACCENT }}
          />
        </div>
      </div>

      {/* Stepper desktop */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{
              backgroundColor: i === stepPosition ? ACCENT : i < stepPosition ? "rgba(29,63,214,0.12)" : SURF2,
              color:           i === stepPosition ? "#fff"  : i < stepPosition ? ACCENT              : MUTED,
              border:          `1px solid ${i === stepPosition ? ACCENT : BORDER}`,
            }}
          >
            {i < stepPosition ? <Check className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
            {label}
          </div>
        ))}
      </div>

      {/* Conteúdo do passo */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>

        {/* Passo 0 — Selecionar veículo(s) */}
        {step === 0 && (
          <div className="space-y-5">

            {/* Toggle modo em lote */}
            <button
              type="button"
              onClick={handleToggleBatchMode}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
              style={{
                backgroundColor: batchMode ? "rgba(29,63,214,0.1)" : SURF2,
                border: `1px solid ${batchMode ? "rgba(29,63,214,0.35)" : BORDER}`,
              }}
            >
              <Package className="w-4 h-4 shrink-0" style={{ color: batchMode ? ACCENT : MUTED }} />
              <div className="flex-1">
                <p className="text-[13px] font-bold" style={{ color: TEXT }}>Modo em lote</p>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  Selecione vários carros e gere as mídias de todos de uma vez
                </p>
              </div>
              {/* Toggle visual */}
              <div
                className="relative shrink-0 rounded-full transition-colors"
                style={{
                  width: "38px", height: "22px",
                  backgroundColor: batchMode ? ACCENT : "rgba(255,255,255,0.12)",
                }}
              >
                <span
                  className="absolute top-0.5 rounded-full bg-white transition-all"
                  style={{
                    width: "18px", height: "18px",
                    left: batchMode ? "calc(100% - 20px)" : "2px",
                  }}
                />
              </div>
            </button>

            {batchMode ? (
              <>
                {batchVehicles.length > 0 && (
                  <p className="text-[12px] font-semibold" style={{ color: ACCENT }}>
                    {batchVehicles.length} {batchVehicles.length === 1 ? "carro selecionado" : "carros selecionados"}
                  </p>
                )}
                <SelecionarVeiculo
                  vehicles={vehicles}
                  selectedIds={batchVehicles.map(v => v.id)}
                  onToggle={handleToggleBatchVehicle}
                />
                <div className="flex justify-end pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Button
                    variant="primary"
                    size="sm"
                    className="font-semibold"
                    isDisabled={batchVehicles.length === 0}
                    onPress={() => setStep(1)}
                  >
                    Avançar com {batchVehicles.length} {batchVehicles.length === 1 ? "carro" : "carros"}
                  </Button>
                </div>
              </>
            ) : (
              <SelecionarVeiculo
                vehicles={vehicles}
                selectedId={vehicle?.id ?? null}
                onSelect={handleSelectVehicle}
                onDeselect={() => setVehicle(null)}
                renderDetail={(v) => <VeiculoResumoCard vehicle={v} onAdvance={() => setStep(1)} />}
              />
            )}
          </div>
        )}

        {/* Passo 1 — Escolher formatos */}
        {step === 1 && (batchMode ? batchVehicles.length > 0 : !!vehicle) && (
          <div className="space-y-5">
            <EscolherFormato selected={formatos} onToggle={handleToggleFormato} />
            <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <Button variant="outline" size="sm" className="font-semibold" onPress={() => setStep(0)}>Voltar</Button>
              <Button variant="primary" size="sm" className="font-semibold" isDisabled={formatos.length === 0} onPress={advanceFromFormato}>
                Avançar
              </Button>
            </div>
          </div>
        )}

        {/* Passo 2 — Selecionar fotos (modo single) */}
        {step === 2 && vehicle && (
          <div className="space-y-6">

            {formatos.includes("carousel") && (
              <div className="space-y-3">
                {showPhotoSectionLabels && (
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Fotos do carrossel</p>
                )}
                <SelecionarFotos
                  images={vehicle.images ?? []}
                  selected={carouselPhotos}
                  onChange={setCarouselPhotos}
                />
              </div>
            )}

            {formatos.includes("story-collage") && (
              <div className="space-y-3">
                {showPhotoSectionLabels && (
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Fotos do story (3 fotos)</p>
                )}
                <SelecionarFotosCollage
                  images={vehicle.images ?? []}
                  selected={collagePhotos}
                  onChange={setCollagePhotos}
                />
              </div>
            )}

            {formatos.includes("story") && (
              <div className="space-y-3">
                {showPhotoSectionLabels && (
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Foto do story</p>
                )}
                <SelecionarFotoCapa
                  images={vehicle.images ?? []}
                  selected={storyCoverPhoto}
                  onChange={setStoryCoverPhoto}
                />
              </div>
            )}

            <div className="flex items-start gap-3 rounded-xl p-4" style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}` }}>
              <Sparkles className="w-5 h-5 shrink-0" style={{ color: ACCENT }} />
              <div>
                <p className="text-[14px] font-bold" style={{ color: TEXT }}>
                  Gerar {formatsLabel} pra {vehicle.brand} {vehicle.name}
                </p>
                <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                  {needsCaption
                    ? "Vou montar o preview e a legenda automaticamente com os dados desse veículo. Você pode editar tudo antes de salvar."
                    : "Vou montar o preview automaticamente com os dados desse veículo. Story não usa legenda."}
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <Button variant="outline" size="sm" className="font-semibold" onPress={() => setStep(1)}>Voltar</Button>
              <Button
                variant="primary"
                size="sm"
                className="font-semibold"
                isDisabled={
                  (formatos.includes("carousel")      && (vehicle.images?.length ?? 0) > 0 && carouselPhotos.length === 0) ||
                  (formatos.includes("story-collage") && collagePhotos.filter(Boolean).length < 3)
                }
                onPress={advanceFromFotos}
              >
                Gerar mídia
              </Button>
            </div>
          </div>
        )}

        {/* Passo 3 — Gerar legenda (modo single, só se tiver carrossel) */}
        {step === 3 && needsCaption && (
          <div className="space-y-5">
            <Legenda caption={caption} hashtags={hashtags} onChange={setCaption} />
            <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <Button variant="outline" size="sm" className="font-semibold" onPress={() => setStep(needsPhotos ? 2 : 1)}>Voltar</Button>
              <Button variant="primary" size="sm" className="font-semibold" onPress={advanceFromLegenda}>Avançar pro preview</Button>
            </div>
          </div>
        )}

        {/* Passo 4 — Preview e salvar (modo single) */}
        {step === 4 && vehicle && activePreviewTab && (
          <div className="space-y-5">

            {formatos.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {formatos.map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setActivePreviewTab(fmt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                    style={{
                      backgroundColor: activePreviewTab === fmt ? ACCENT : savedFormats.has(fmt) ? "rgba(37,211,102,0.1)" : SURF2,
                      color:           activePreviewTab === fmt ? "#fff"  : savedFormats.has(fmt) ? SUCCESS              : MUTED,
                      border:          `1px solid ${activePreviewTab === fmt ? ACCENT : savedFormats.has(fmt) ? "rgba(37,211,102,0.3)" : BORDER}`,
                    }}
                  >
                    {savedFormats.has(fmt) && activePreviewTab !== fmt && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {FORMATO_LABEL[fmt]}
                  </button>
                ))}

                {allSaved && (
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={{ backgroundColor: "rgba(37,211,102,0.1)", color: SUCCESS, border: "1px solid rgba(37,211,102,0.3)" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tudo salvo!
                  </span>
                )}
              </div>
            )}

            {formatos.map(fmt => activePreviewTab === fmt && (
              <PreviewFinal
                key={fmt}
                vehicle={getPreviewVehicle(fmt)}
                mediaType={mediaTypeFromFormato(fmt)}
                storyCollage={fmt === "story-collage"}
                caption={mediaTypeFromFormato(fmt) === "story" ? "" : caption}
                hashtags={mediaTypeFromFormato(fmt) === "story" ? [] : hashtags}
                onChangeCaption={setCaption}
                onBack={() => setStep(getBackFromPreview())}
                onSave={() => handleSave(fmt)}
                onDone={() => router.push("/midias")}
                onToggleNewBadge={handleToggleNewBadge}
                updatingNewBadge={updatingNewBadge}
                saving={savingFormato === fmt}
                saved={savedFormats.has(fmt)}
                error={error}
              />
            ))}

          </div>
        )}

        {/* Passo 5 — Gerar e salvar tudo (modo em lote) */}
        {step === 5 && batchMode && (
          <div className="space-y-5">

            {/* Antes de iniciar: resumo do que vai ser gerado */}
            {!batchRunning && batchResults.length === 0 && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-bold" style={{ color: TEXT }}>
                    Vai gerar {batchTotal} {batchTotal === 1 ? "mídia" : "mídias"}
                  </p>
                  <p className="text-[12px]" style={{ color: MUTED }}>
                    {batchVehicles.length} {batchVehicles.length === 1 ? "carro" : "carros"} × {formatos.map(f => FORMATO_LABEL[f]).join(" + ")}
                  </p>
                </div>

                <div className="space-y-2">
                  {batchVehicles.map(v => {
                    const cover = v.thumbnails?.[0] || v.images?.[0] || v.imageUrl || PLACEHOLDER_IMAGE
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
                      >
                        <img
                          src={cover}
                          alt={v.name}
                          loading="lazy"
                          className="rounded-lg object-cover shrink-0"
                          style={{ width: "44px", height: "44px" }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold truncate" style={{ color: TEXT }}>{v.name}</p>
                          <p className="text-[11px]" style={{ color: MUTED }}>
                            {formatos.map(f => FORMATO_LABEL[f]).join(" + ")}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Button variant="outline" size="sm" className="font-semibold" onPress={() => {
                    setBatchResults([])
                    setBatchDone(false)
                    setStep(1)
                  }}>
                    Voltar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="font-semibold"
                    onPress={runBatch}
                  >
                    Gerar e salvar tudo
                  </Button>
                </div>
              </>
            )}

            {/* Durante/após: lista de status por item */}
            {batchResults.length > 0 && (
              <>
                {batchDone && (
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      backgroundColor: batchErrors === 0 ? "rgba(37,211,102,0.1)" : "rgba(29,63,214,0.1)",
                      border: `1px solid ${batchErrors === 0 ? "rgba(37,211,102,0.3)" : "rgba(29,63,214,0.3)"}`,
                    }}
                  >
                    {batchErrors === 0
                      ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: SUCCESS }} />
                      : <XCircle className="w-5 h-5 shrink-0" style={{ color: ACCENT }} />
                    }
                    <p className="text-[13px] font-semibold" style={{ color: TEXT }}>
                      {batchErrors === 0
                        ? `${batchSaved} ${batchSaved === 1 ? "mídia salva" : "mídias salvas"} com sucesso!`
                        : `${batchSaved} salvas, ${batchErrors} com erro`
                      }
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {batchResults.map(r => (
                    <div
                      key={`${r.vehicleId}-${r.formato}`}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: SURF2, border: `1px solid ${BORDER}` }}
                    >
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {r.status === "pending" && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MUTED }} />
                        )}
                        {r.status === "saving" && (
                          <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT }} />
                        )}
                        {r.status === "saved" && (
                          <CheckCircle2 className="w-4 h-4" style={{ color: SUCCESS }} />
                        )}
                        {r.status === "error" && (
                          <XCircle className="w-4 h-4" style={{ color: ACCENT }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: TEXT }}>
                          {r.vehicleName}
                        </p>
                        <p className="text-[11px]" style={{ color: MUTED }}>{FORMATO_LABEL[r.formato]}</p>
                      </div>
                      {r.status === "error" && r.error && (
                        <p className="text-[10px] shrink-0 max-w-[120px] text-right" style={{ color: "#cc4444" }}>
                          {r.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {batchDone && (
                  <div className="flex justify-end pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Button variant="primary" size="sm" className="font-semibold" onPress={() => router.push("/midias")}>
                      Ir pra Central de Mídias
                    </Button>
                  </div>
                )}
              </>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
