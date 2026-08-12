export type UserRole = 'SUPER_ADMIN' | 'INVENTORY_MANAGER' | 'VENDEDOR'

export const CATEGORIES = ['Hatch', 'Sedan', 'SUV', 'Pickup', 'Van', 'Conversível', 'Coupé', 'Moto', 'Elétrico', 'Outro']

export const BRANDS = [
  'Audi', 'BMW', 'BYD', 'Caoa Chery', 'Chevrolet', 'Chrysler', 'Citroën', 'Dodge',
  'Fiat', 'Ford', 'GWM', 'Harley-Davidson', 'Honda', 'Hyundai', 'JAC', 'Jaguar',
  'Jeep', 'Kawasaki', 'Kia', 'Land Rover', 'Lexus', 'Mercedes-Benz', 'Mini',
  'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'RAM', 'Renault', 'Royal Enfield',
  'Subaru', 'Suzuki', 'Toyota', 'Triumph', 'Troller', 'Volkswagen', 'Volvo', 'Yamaha',
]

export const STATUS_CFG = {
  disponivel: { label: 'Disponível', chipColor: 'success' as const },
  reservado:  { label: 'Reservado',  chipColor: 'warning' as const },
  vendido:    { label: 'Vendido',    chipColor: 'default' as const },
} as const

// ── Central de Mídias ───────────────────────────────────────────────────────

export const MEDIA_TYPE_CFG = {
  story:    { label: 'Story',     chipColor: 'default' as const },
  post:     { label: 'Post',      chipColor: 'default' as const },
  carousel: { label: 'Carrossel', chipColor: 'default' as const },
} as const

export const MEDIA_STATUS_CFG = {
  draft:    { label: 'Rascunho',  chipColor: 'warning' as const },
  saved:    { label: 'Salvo',     chipColor: 'success' as const },
  archived: { label: 'Arquivado', chipColor: 'default' as const },
} as const

// ── Identidade do lojista ────────────────────────────────────────────────────
// TROQUE ESSES 4 VALORES (+ o logo em public/, + STORE_HASHTAGS logo abaixo)
// pra clonar esse painel pra um cliente novo — é o único lugar que precisa
// mudar. Nada mais no código referencia o nome/cidade/contato da loja direto.
export const STORE_NAME     = 'Dash Motors'
export const STORE_CITY     = 'Sua Cidade, UF'
export const STORE_ADDRESS  = 'Endereço completo da loja'
export const STORE_WHATSAPP = '(00) 00000-0000'

// Logo usado no header, tela de login, tela de autorização do conector MCP e
// nas artes geradas pela Central de Mídias (post/story/carrossel) — arquivo
// físico fica em public/, referenciado sempre por esse caminho único. Troque
// o arquivo em public/dash-motors-logo.png (ou aponte pra outro nome aqui).
export const STORE_LOGO_PATH = '/admin/dash-motors-logo.png'

// Hashtags fixas incluídas em toda legenda gerada pela Central de Mídias —
// pense em 2 termos genéricos de categoria + o @ da loja + a cidade (ver
// gerarHashtags em lib/midias/legenda.ts)
export const STORE_HASHTAGS = ['carrosusados', 'seminovos', 'dashmotors', 'suacidade']

// Vendedores — contato adicional incluído no final das legendas geradas,
// além do WhatsApp principal da loja (STORE_WHATSAPP)
export const SELLERS: readonly { name: string; phone: string }[] = []
