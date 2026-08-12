"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createVehicle } from '@/lib/actions/vehicles'
import { VehicleForm, type VehicleFormData } from '@/components/vehicles/VehicleForm'
import { STORE_NAME } from '@/lib/constants'

import { SURFACE, BORDER, TEXT, MUTED, DANGER } from "@/lib/theme"

export default function NovoVeiculoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(data: VehicleFormData) {
    setLoading(true)
    setError(null)
    const now = new Date().toISOString()
    const result = await createVehicle({
      ...data,
      ...(data.status === 'vendido' ? { soldAt: now } : {}),
    })
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    router.push('/estoque')
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-6">

      <Link
        href="/estoque"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:underline"
        style={{ color: MUTED }}
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao estoque
      </Link>

      <div>
        <h1 className="text-[22px] font-black" style={{ color: TEXT }}>Novo carro</h1>
        <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
          Preencha os dados para adicionar um veículo ao estoque da {STORE_NAME}
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
        <VehicleForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  )
}
