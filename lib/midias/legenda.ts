import type { Vehicle } from "@/lib/types"
import { STORE_NAME, STORE_ADDRESS, STORE_WHATSAPP, STORE_HASHTAGS, SELLERS } from "@/lib/constants"

const FALLBACK_OPTIONALS = "diversos itens de conforto, segurança e tecnologia"
const MAX_HASHTAGS = 10
const MAX_OPTIONALS_LEGENDA = 8

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function formatPrecoSemCentavos(value: number): string {
  return `R$ ${new Intl.NumberFormat("pt-BR").format(Math.round(value))}`
}

// ── Hashtags ──────────────────────────────────────────────────────────────────
// Deriva hashtags só de campos reais do veículo (marca, modelo, nome/versão,
// categoria) + termos fixos da loja. Nunca inventa palavra que não esteja
// em algum desses campos.
export function gerarHashtags(vehicle: Vehicle): string[] {
  const candidatos: string[] = []

  // Palavras do nome/versão completo (ex: "T-CROSS COMFORTLINE" → tcross, comfortline)
  const palavrasNome = (vehicle.name ?? "")
    .split(/\s+/)
    .map(slugify)
    .filter((w) => w.length > 2)
  candidatos.push(...palavrasNome)

  if (vehicle.brand) candidatos.push(slugify(vehicle.brand))
  if (vehicle.model) candidatos.push(slugify(vehicle.model))
  if (vehicle.brand && palavrasNome[0]) candidatos.push(slugify(vehicle.brand) + palavrasNome[0])
  if (vehicle.category) candidatos.push(slugify(vehicle.category))

  // Termos comerciais fixos (ver STORE_HASHTAGS em lib/constants.ts)
  candidatos.push(...STORE_HASHTAGS)

  const unicos = Array.from(new Set(candidatos.filter((c) => c.length > 1)))
  return unicos.slice(0, MAX_HASHTAGS).map((c) => `#${c}`)
}

// ── Legenda ───────────────────────────────────────────────────────────────────
// Template fixo da loja (ver STORE_NAME em lib/constants.ts). Cada linha só aparece se o dado existir —
// nunca inventa informação que não veio do cadastro do veículo.
export function gerarLegenda(vehicle: Vehicle): string {
  const anoLinha = vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : vehicle.year ? `${vehicle.year}` : ""
  const titulo = [vehicle.brand, vehicle.name, anoLinha].filter(Boolean).join(" ").trim()

  const blocos: string[] = []

  blocos.push(titulo.toUpperCase())

  const specLine = [vehicle.motor, vehicle.transmission, vehicle.fuel, vehicle.color].filter(Boolean).join(" • ")
  if (specLine) blocos.push(specLine)

  if (vehicle.km) blocos.push(`📍 ${new Intl.NumberFormat("pt-BR").format(vehicle.km)} km`)

  const opcionais = vehicle.optionals?.length
    ? vehicle.optionals.slice(0, MAX_OPTIONALS_LEGENDA)
    : [FALLBACK_OPTIONALS]
  blocos.push(opcionais.map((item) => `✅ ${item}`).join("\n"))

  if (vehicle.price) blocos.push(`💰 ${formatPrecoSemCentavos(vehicle.price)}`)

  const contatos = [
    `📍 ${STORE_ADDRESS}`,
    `📞 ${STORE_WHATSAPP} — ${STORE_NAME}`,
    ...SELLERS.map((s) => `📞 ${s.phone} — ${s.name}`),
  ].join("\n")
  blocos.push(contatos)

  const hashtags = gerarHashtags(vehicle)
  if (hashtags.length) blocos.push(hashtags.join(" "))

  return blocos.join("\n\n")
}
