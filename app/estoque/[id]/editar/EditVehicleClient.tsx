"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updateVehicleAction } from '@/lib/actions/vehicles'
import { VehicleForm, type VehicleFormData } from '@/components/vehicles/VehicleForm'
import type { Vehicle } from '@/lib/types'

import { SURFACE, BORDER, TEXT, MUTED, DANGER } from "@/lib/theme"

export function EditVehicleClient({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(data: VehicleFormData) {
    setLoading(true)
    setError(null)
    const result = await updateVehicleAction(vehicle.id, data)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    router.push(`/estoque/${vehicle.id}`)
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-6">

      <Link
        href={`/estoque/${vehicle.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
        style={{ color: MUTED }}
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao veículo
      </Link>

      <div>
        <h1 className="text-[22px] font-black" style={{ color: TEXT }}>Editar carro</h1>
        <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
          Atualize os dados de {vehicle.brand} {vehicle.model}
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-[13px] font-medium"
          style={{ backgroundColor: "rgba(168,14,14,0.1)", border: `1px solid rgba(168,14,14,0.3)`, color: DANGER }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: SURFACE,
          border:          `1px solid ${BORDER}`,
          boxShadow:       "0 4px 24px rgba(0,0,0,0.25)",
        }}
      >
        <VehicleForm
          defaultValues={vehicle}
          onSubmit={handleSubmit}
          loading={loading}
          cancelHref={`/estoque/${vehicle.id}`}
          submitLabel="Salvar alterações"
        />
      </div>
    </div>
  )
}
