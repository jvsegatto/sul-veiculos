import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicleAction,
  archiveVehicle,
  markAsSold,
  markAsAvailable,
  type VehicleFormInput,
} from '@/lib/actions/vehicles'
import { gerarLegenda, gerarHashtags, formatPrecoSemCentavos } from '@/lib/midias/legenda'
import { postToInstagram } from '@/lib/actions/instagram'
import { createPendingAction, getPendingActionAdmin, markPendingActionStatus, logMcpAction } from '@/lib/mcp/store'
import { resolveMcpUser } from '@/lib/mcp/auth'
import type { Vehicle } from '@/lib/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function ok(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }], isError: true }
}

function vehicleLabel(v: Pick<Vehicle, 'brand' | 'name'>): string {
  return [v.brand, v.name].filter(Boolean).join(' ')
}

function vehicleSummary(v: Vehicle) {
  return {
    id: v.id,
    nome: vehicleLabel(v),
    marca: v.brand,
    modelo: v.model,
    ano: v.yearModel ? `${v.year}/${v.yearModel}` : v.year,
    km: v.km,
    preco: v.price,
    status: v.status,
    categoria: v.category,
    premium: v.isPremium,
    novidade: v.isNew,
    fotos: v.images?.length ?? 0,
  }
}

const CRIAR_VEICULO_REQUIRED = ['name', 'brand', 'model', 'year', 'km', 'price'] as const

export function registerMcpTools(server: McpServer) {
  // ── Leitura ──────────────────────────────────────────────────────────────

  server.tool(
    'estoque_listar_veiculos',
    'Lista veículos do estoque (não arquivados), com filtros opcionais.',
    {
      busca:     z.string().optional().describe('Texto livre pra buscar no nome/marca/modelo'),
      marca:     z.string().optional(),
      status:    z.enum(['disponivel', 'vendido', 'reservado']).optional(),
      categoria: z.string().optional(),
      precoMin:  z.number().optional(),
      precoMax:  z.number().optional(),
    },
    async (args, extra) => {
      const user = resolveMcpUser(extra)
      const { vehicles } = await getVehicles({ admin: true })
      let filtered = vehicles

      if (args.busca) {
        const q = args.busca.toLowerCase()
        filtered = filtered.filter((v) => [v.name, v.brand, v.model].some((f) => f?.toLowerCase().includes(q)))
      }
      if (args.marca) filtered = filtered.filter((v) => v.brand?.toLowerCase() === args.marca!.toLowerCase())
      if (args.status) filtered = filtered.filter((v) => v.status === args.status)
      if (args.categoria) filtered = filtered.filter((v) => v.category?.toLowerCase() === args.categoria!.toLowerCase())
      if (args.precoMin !== undefined) filtered = filtered.filter((v) => v.price >= args.precoMin!)
      if (args.precoMax !== undefined) filtered = filtered.filter((v) => v.price <= args.precoMax!)

      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_listar_veiculos', params: args, result: 'success' })

      return ok({ total: filtered.length, veiculos: filtered.slice(0, 30).map(vehicleSummary) })
    }
  )

  server.tool(
    'estoque_buscar_veiculo',
    'Busca um veículo específico por ID, nome, modelo ou ano. Use antes de propor uma ação sobre um veículo citado por nome.',
    {
      id:    z.string().optional(),
      termo: z.string().optional().describe('Nome, marca, modelo ou ano pra buscar'),
    },
    async (args, extra) => {
      const user = resolveMcpUser(extra)
      if (args.id) {
        const { vehicle } = await getVehicleById(args.id, { admin: true })
        await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_buscar_veiculo', vehicleId: args.id, params: args, result: vehicle ? 'success' : 'error' })
        if (!vehicle) return fail('Veículo não encontrado')
        return ok(vehicleSummary(vehicle))
      }

      const { vehicles } = await getVehicles({ admin: true })
      const termo = (args.termo ?? '').toLowerCase()
      const encontrados = vehicles.filter((v) =>
        [v.name, v.brand, v.model, String(v.year)].some((f) => f?.toString().toLowerCase().includes(termo))
      )
      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_buscar_veiculo', params: args, result: 'success' })
      return ok({ total: encontrados.length, veiculos: encontrados.slice(0, 10).map(vehicleSummary) })
    }
  )

  // ── Criar veículo (rascunho → confirmação) ──────────────────────────────

  server.tool(
    'estoque_criar_rascunho_veiculo',
    'Propõe o cadastro de um veículo novo. NUNCA chame sem nome, marca, modelo, ano, km e preço — pergunte ao usuário antes se faltar algum desses campos. Depois de criado, o rascunho precisa de fotos (enviadas pelo painel) antes de poder ser confirmado.',
    {
      name: z.string(), brand: z.string(), model: z.string(),
      year: z.number(), yearModel: z.number().optional(),
      km: z.number(), price: z.number(),
      color: z.string().optional(),
      category: z.enum(['Hatch', 'Sedan', 'SUV', 'Pickup', 'Van', 'Conversível', 'Coupé', 'Moto', 'Elétrico', 'Outro']).optional().describe('Categoria do veículo — use exatamente um desses valores'),
      transmission: z.string().optional(), fuel: z.string().optional(),
      doors: z.number().optional(), motor: z.string().optional(),
      optionals: z.array(z.string()).optional(),
      isPremium: z.boolean().optional(), isNew: z.boolean().optional(),
    },
    async (args, extra) => {
      const missing = CRIAR_VEICULO_REQUIRED.filter((f) => args[f] === undefined || args[f] === null)
      if (missing.length) return fail(`Campos obrigatórios faltando: ${missing.join(', ')}`)

      const input: VehicleFormInput = {
        name: args.name, brand: args.brand, model: args.model,
        year: args.year, yearModel: args.yearModel,
        km: args.km, price: args.price,
        color: args.color ?? '', category: args.category ?? '',
        transmission: args.transmission ?? '', fuel: args.fuel ?? '',
        doors: args.doors ?? 4, motor: args.motor ?? '',
        optionals: args.optionals ?? [],
        isPremium: args.isPremium ?? false, isNew: args.isNew ?? false,
        images: [], thumbnails: [], imageUrl: '',
        status: 'disponivel',
        acquiredAt: new Date().toISOString(),
      }

      const user = resolveMcpUser(extra)
      const summary = `Cadastro novo: ${input.brand} ${input.name} (${input.year}, ${input.km.toLocaleString('pt-BR')} km, ${formatPrecoSemCentavos(input.price)}). Precisa de pelo menos 1 foto antes de confirmar.`
      const pendingAction = await createPendingAction({
        kind: 'criar', payload: { ...input }, summary, userId: user.userId,
      })

      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_criar_rascunho_veiculo', params: args, result: 'success' })

      return ok({
        pendingActionId: pendingAction.id,
        summary,
        uploadFotosUrl: `${SITE_URL}/admin/estoque/rascunhos/${pendingAction.id}`,
        instrucao: 'Peça pro usuário abrir esse link e subir pelo menos 1 foto antes de chamar estoque_confirmar_criacao_veiculo.',
      })
    }
  )

  server.tool(
    'estoque_confirmar_criacao_veiculo',
    'Confirma e efetiva o cadastro de um veículo criado com estoque_criar_rascunho_veiculo. Só funciona se o rascunho já tiver pelo menos 1 foto.',
    { pendingActionId: z.string() },
    async ({ pendingActionId }, extra) => {
      const user = resolveMcpUser(extra)
      const pendingAction = await getPendingActionAdmin(pendingActionId)
      if (!pendingAction || pendingAction.kind !== 'criar') return fail('Rascunho não encontrado')
      if (pendingAction.status !== 'pending') return fail(`Esse rascunho já está "${pendingAction.status}"`)

      const images = Array.isArray(pendingAction.payload.images) ? (pendingAction.payload.images as string[]) : []
      if (images.length === 0) {
        return fail('Esse rascunho ainda não tem fotos. Peça pro usuário subir pelo menos 1 foto no painel antes de confirmar.')
      }

      const input = { ...(pendingAction.payload as unknown as VehicleFormInput), images, imageUrl: images[0] }
      const { vehicle, error } = await createVehicle(input, { userInfo: user })

      await markPendingActionStatus(pendingActionId, error ? 'pending' : 'confirmed')
      await logMcpAction({
        userId: user.userId, userName: user.name, tool: 'estoque_confirmar_criacao_veiculo',
        vehicleId: vehicle?.id ?? null, params: { pendingActionId }, result: error ? 'error' : 'success', errorMessage: error,
      })

      if (error) return fail(error)
      return ok({ vehicle: vehicle ? vehicleSummary(vehicle) : null, mensagem: 'Veículo cadastrado com sucesso.' })
    }
  )

  // ── Editar veículo (rascunho → confirmação) ─────────────────────────────

  server.tool(
    'estoque_editar_rascunho_veiculo',
    'Propõe um patch de edição num veículo já existente — não aplica nada ainda.',
    {
      vehicleId: z.string(),
      name: z.string().optional(), brand: z.string().optional(), model: z.string().optional(),
      year: z.number().optional(), yearModel: z.number().optional(), km: z.number().optional(),
      price: z.number().optional(), color: z.string().optional(),
      category: z.enum(['Hatch', 'Sedan', 'SUV', 'Pickup', 'Van', 'Conversível', 'Coupé', 'Moto', 'Elétrico', 'Outro']).optional().describe('Categoria do veículo — use exatamente um desses valores'),
      transmission: z.string().optional(), fuel: z.string().optional(), doors: z.number().optional(),
      motor: z.string().optional(), optionals: z.array(z.string()).optional(),
    },
    async (args, extra) => {
      const { vehicleId, ...patch } = args
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')

      const fields = Object.entries(patch).filter(([, v]) => v !== undefined)
      if (fields.length === 0) return fail('Nenhum campo pra alterar foi informado')

      const user = resolveMcpUser(extra)
      const diff = fields.map(([k, v]) => `${k}: ${v}`).join(', ')
      const summary = `Editar ${vehicleLabel(vehicle)} — ${diff}.`
      const pendingAction = await createPendingAction({
        kind: 'editar', vehicleId, payload: Object.fromEntries(fields), summary, userId: user.userId,
      })

      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_editar_rascunho_veiculo', vehicleId, params: args, result: 'success' })

      return ok({ pendingActionId: pendingAction.id, summary })
    }
  )

  server.tool(
    'estoque_confirmar_edicao_veiculo',
    'Aplica de verdade a edição proposta com estoque_editar_rascunho_veiculo.',
    { pendingActionId: z.string() },
    async ({ pendingActionId }, extra) => {
      const user = resolveMcpUser(extra)
      const pendingAction = await getPendingActionAdmin(pendingActionId)
      if (!pendingAction || pendingAction.kind !== 'editar' || !pendingAction.vehicleId) return fail('Rascunho não encontrado')
      if (pendingAction.status !== 'pending') return fail(`Esse rascunho já está "${pendingAction.status}"`)

      const { vehicle, error } = await updateVehicleAction(pendingAction.vehicleId, pendingAction.payload, { userInfo: user })

      await markPendingActionStatus(pendingActionId, error ? 'pending' : 'confirmed')
      await logMcpAction({
        userId: user.userId, userName: user.name, tool: 'estoque_confirmar_edicao_veiculo',
        vehicleId: pendingAction.vehicleId, params: { pendingActionId }, result: error ? 'error' : 'success', errorMessage: error,
      })

      if (error) return fail(error)
      return ok({ vehicle: vehicle ? vehicleSummary(vehicle) : null, mensagem: 'Veículo atualizado com sucesso.' })
    }
  )

  // ── Remover veículo (rascunho → confirmação) ────────────────────────────

  server.tool(
    'estoque_remover_rascunho_veiculo',
    'Propõe arquivar (remover das listagens) um veículo. É reversível — nunca apaga de verdade.',
    { vehicleId: z.string() },
    async ({ vehicleId }, extra) => {
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')

      const user = resolveMcpUser(extra)
      const summary = `Arquivar ${vehicleLabel(vehicle)} — sai das listagens, mas fica guardado e pode ser restaurado depois.`
      const pendingAction = await createPendingAction({ kind: 'remover', vehicleId, payload: {}, summary, userId: user.userId })

      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_remover_rascunho_veiculo', vehicleId, params: {}, result: 'success' })

      return ok({ pendingActionId: pendingAction.id, summary })
    }
  )

  server.tool(
    'estoque_confirmar_remocao_veiculo',
    'Efetiva a remoção (arquivamento) proposta com estoque_remover_rascunho_veiculo.',
    { pendingActionId: z.string() },
    async ({ pendingActionId }, extra) => {
      const user = resolveMcpUser(extra)
      const pendingAction = await getPendingActionAdmin(pendingActionId)
      if (!pendingAction || pendingAction.kind !== 'remover' || !pendingAction.vehicleId) return fail('Rascunho não encontrado')
      if (pendingAction.status !== 'pending') return fail(`Esse rascunho já está "${pendingAction.status}"`)

      const { error } = await archiveVehicle(pendingAction.vehicleId, { userInfo: user })

      await markPendingActionStatus(pendingActionId, error ? 'pending' : 'confirmed')
      await logMcpAction({
        userId: user.userId, userName: user.name, tool: 'estoque_confirmar_remocao_veiculo',
        vehicleId: pendingAction.vehicleId, params: { pendingActionId }, result: error ? 'error' : 'success', errorMessage: error,
      })

      if (error) return fail(error)
      return ok({ mensagem: 'Veículo arquivado com sucesso.' })
    }
  )

  // ── Status / destaque — diretos (reversíveis, sem ciclo de confirmação) ──

  server.tool(
    'estoque_marcar_vendido',
    'Marca um veículo como VENDIDO. Reversível (o usuário pode pedir pra marcar como disponível de novo).',
    { vehicleId: z.string() },
    async ({ vehicleId }, extra) => {
      const user = resolveMcpUser(extra)
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')

      const { error } = await markAsSold(vehicleId, { userInfo: user })
      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_marcar_vendido', vehicleId, params: {}, result: error ? 'error' : 'success', errorMessage: error })

      if (error) return fail(error)
      return ok({ mensagem: `${vehicleLabel(vehicle)} marcado como vendido.` })
    }
  )

  server.tool(
    'estoque_marcar_disponivel',
    'Marca um veículo como DISPONÍVEL de novo (ex: desfazer uma venda registrada por engano).',
    { vehicleId: z.string() },
    async ({ vehicleId }, extra) => {
      const user = resolveMcpUser(extra)
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')

      const { error } = await markAsAvailable(vehicleId, { userInfo: user })
      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_marcar_disponivel', vehicleId, params: {}, result: error ? 'error' : 'success', errorMessage: error })

      if (error) return fail(error)
      return ok({ mensagem: `${vehicleLabel(vehicle)} marcado como disponível.` })
    }
  )

  server.tool(
    'estoque_definir_destaque',
    'Marca ou desmarca o selo "Carro premium / Destaque especial no estoque" de um veículo. Não afeta o selo separado de "Novidade no estoque".',
    { vehicleId: z.string(), destaque: z.boolean() },
    async ({ vehicleId, destaque }, extra) => {
      const user = resolveMcpUser(extra)
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')

      const { error } = await updateVehicleAction(vehicleId, { isPremium: destaque }, { userInfo: user })
      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'estoque_definir_destaque', vehicleId, params: { destaque }, result: error ? 'error' : 'success', errorMessage: error })

      if (error) return fail(error)
      return ok({ mensagem: `Destaque de ${vehicleLabel(vehicle)} ${destaque ? 'ativado' : 'removido'}.` })
    }
  )

  // ── Instagram ────────────────────────────────────────────────────────────

  server.tool(
    'instagram_gerar_preview_post',
    'Monta a legenda e a lista de fotos de um veículo pra revisão antes de publicar. Não publica nada.',
    { vehicleId: z.string() },
    async ({ vehicleId }, extra) => {
      const user = resolveMcpUser(extra)
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')
      if (!vehicle.images?.length) return fail(`${vehicleLabel(vehicle)} não tem fotos cadastradas — suba fotos pelo painel antes.`)

      const caption = gerarLegenda(vehicle)
      const hashtags = gerarHashtags(vehicle)

      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'instagram_gerar_preview_post', vehicleId, params: {}, result: 'success' })

      return ok({
        vehicleId, veiculo: vehicleLabel(vehicle), fotos: vehicle.images, caption, hashtags,
        observacao: 'Esse post usa as fotos originais do veículo, sem o overlay de arte (preço/specs sobrepostos) — pra isso, use o gerador de mídias do painel.',
      })
    }
  )

  server.tool(
    'instagram_publicar_post',
    'Publica de verdade um carrossel no Instagram da loja com as fotos do veículo (sem overlay de arte) + legenda. Cria uma proposta que exige confirmação explícita do usuário antes de publicar.',
    { vehicleId: z.string(), caption: z.string().optional() },
    async ({ vehicleId, caption }, extra) => {
      const user = resolveMcpUser(extra)
      const { vehicle } = await getVehicleById(vehicleId, { admin: true })
      if (!vehicle) return fail('Veículo não encontrado')
      if (!vehicle.images?.length) return fail(`${vehicleLabel(vehicle)} não tem fotos cadastradas.`)

      const finalCaption = caption ?? gerarLegenda(vehicle)
      const summary = `Publicar no Instagram (carrossel) as ${vehicle.images.length} fotos de ${vehicleLabel(vehicle)}. Ação pública e imediata — não dá pra desfazer depois.`
      const pendingAction = await createPendingAction({
        kind: 'publicar', vehicleId, payload: { caption: finalCaption, images: vehicle.images }, summary, userId: user.userId,
      })

      await logMcpAction({ userId: user.userId, userName: user.name, tool: 'instagram_publicar_post', vehicleId, params: { caption: finalCaption }, result: 'success' })

      return ok({ pendingActionId: pendingAction.id, summary })
    }
  )

  server.tool(
    'instagram_confirmar_publicacao',
    'Confirma e publica de verdade no Instagram a proposta criada com instagram_publicar_post.',
    { pendingActionId: z.string() },
    async ({ pendingActionId }, extra) => {
      const user = resolveMcpUser(extra)
      const pendingAction = await getPendingActionAdmin(pendingActionId)
      if (!pendingAction || pendingAction.kind !== 'publicar') return fail('Rascunho não encontrado')
      if (pendingAction.status !== 'pending') return fail(`Esse rascunho já está "${pendingAction.status}"`)

      const images = (pendingAction.payload.images as string[]) ?? []
      const caption = (pendingAction.payload.caption as string) ?? ''
      const result = await postToInstagram({ images, caption, mediaType: 'carousel' })

      await markPendingActionStatus(pendingActionId, result.error ? 'pending' : 'confirmed')
      await logMcpAction({
        userId: user.userId, userName: user.name, tool: 'instagram_confirmar_publicacao',
        vehicleId: pendingAction.vehicleId, params: { pendingActionId }, result: result.error ? 'error' : 'success', errorMessage: result.error,
      })

      if (result.error) return fail(result.error)
      return ok({ mensagem: 'Publicado no Instagram!', permalink: result.permalink })
    }
  )
}
