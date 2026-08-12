import "server-only"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import smartcrop from "smartcrop-sharp"
import heicConvert from "heic-convert"

// Credenciais só existem no servidor (nunca em NEXT_PUBLIC_*) — este módulo
// importa "server-only" pra garantir que um bundle de client component nunca
// consiga puxar o secret access key por engano.
function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 não configurado — faltam R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY")
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

const FULL_WIDTH = 1280
const THUMB_WIDTH = 480
// Mesma proporção do card no site/painel (.vehicle-card-media { aspect-ratio: 4/3 }).
// Gerar o thumb já nesse recorte evita que o browser corte o carro de novo com
// object-fit: cover — o corte "burro" (sempre centro do frame) é o que cortava
// o carro quando ele não estava centralizado na foto original.
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * 3) / 4)
const CACHE_CONTROL = "public, max-age=31536000, immutable"

// Recorte com foco no assunto principal da foto (o veículo), via detecção de
// saliência (bordas/contraste) — sem precisar de posição manual por foto.
// Sem ajuda, o algoritmo puro de saliência às vezes prioriza a fachada/letreiro
// iluminado da loja (muito mais contraste que a lataria do carro) — testado com
// fotos reais do estoque, ele cortava a picape pra caber o letreiro no quadro.
// Como as fotos da loja são sempre tiradas do chão (carro na metade de baixo do
// quadro, fachada/letreiro em cima), um boost simples nos ~2/3 inferiores da
// imagem resolve isso sem precisar de detecção de objeto de verdade.
async function smartCropThumb(rotated: Buffer): Promise<Buffer> {
  try {
    const { width, height } = await sharp(rotated).metadata()
    const boost = (width && height)
      ? [{ x: 0, y: Math.round(height * 0.32), width, height: Math.round(height * 0.68), weight: 1 }]
      : undefined
    const { topCrop } = await smartcrop.crop(rotated, { width: THUMB_WIDTH, height: THUMB_HEIGHT, boost })
    return await sharp(rotated)
      .extract({ left: topCrop.x, top: topCrop.y, width: topCrop.width, height: topCrop.height })
      .resize({ width: THUMB_WIDTH, height: THUMB_HEIGHT, fit: "cover" })
      .webp({ quality: 78 })
      .toBuffer()
  } catch {
    // Foto atípica (ex: muito pequena) — cai pro corte central simples de sempre.
    return sharp(rotated)
      .resize({ width: THUMB_WIDTH, height: THUMB_HEIGHT, fit: "cover", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
  }
}

// iPhone grava foto em HEIC por padrão (Ajustes > Câmera > Formatos > "Alta
// Eficiência"). O `sharp`/libvips instalado aqui só decodifica AVIF na família
// HEIF (decoder de HEIC de verdade tem licença de patente H.265 e não vem no
// binário padrão) — sharp.format.heif.input.fileSuffix == [".avif"], sem
// ".heic". Detecta pela assinatura ISO-BMFF (brand no box "ftyp") e converte
// pra JPEG antes do pipeline normal — dali em diante é tratado como qualquer
// outra foto, MESMO tamanho final (full 1280px + thumb 480px em WebP), sem
// guardar o HEIC original em lugar nenhum.
const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"])

function isHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false
  return HEIC_BRANDS.has(buffer.toString("ascii", 8, 12).trim().toLowerCase())
}

async function normalizeInput(input: Buffer): Promise<Buffer> {
  if (!isHeic(input)) return input
  return heicConvert({ buffer: input, format: "JPEG", quality: 0.92 })
}

function publicUrlFor(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL
  if (!base) throw new Error("R2 não configurado — falta R2_PUBLIC_BASE_URL")
  return `${base.replace(/\/$/, "")}/${key}`
}

async function putWebp(client: S3Client, key: string, buffer: Buffer): Promise<void> {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error("R2 não configurado — falta R2_BUCKET")
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: "image/webp",
    CacheControl: CACHE_CONTROL,
  }))
}

/**
 * Recebe a imagem (já comprimida no cliente) e gera duas versões WebP —
 * full (1280px) e thumb (480px) — via sharp, sobe as duas pro R2 e devolve
 * as URLs públicas. `withoutEnlargement` evita esticar fotos menores que a
 * largura alvo (não faz sentido "upscalar" uma imagem já pequena).
 */
export async function processAndUploadImage(
  input: Buffer,
  baseName: string
): Promise<{ fullUrl: string; thumbUrl: string }> {
  const client = getR2Client()

  const normalized = await normalizeInput(input)

  // rotate() normaliza a orientação EXIF uma vez só — full e thumb (e a
  // análise de smart crop) partem do mesmo buffer já corrigido.
  const rotated = await sharp(normalized).rotate().toBuffer()

  const [fullBuffer, thumbBuffer] = await Promise.all([
    sharp(rotated).resize({ width: FULL_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    smartCropThumb(rotated),
  ])

  const fullKey = `vehicles/${baseName}-full.webp`
  const thumbKey = `vehicles/${baseName}-thumb.webp`

  await Promise.all([
    putWebp(client, fullKey, fullBuffer),
    putWebp(client, thumbKey, thumbBuffer),
  ])

  return { fullUrl: publicUrlFor(fullKey), thumbUrl: publicUrlFor(thumbKey) }
}
