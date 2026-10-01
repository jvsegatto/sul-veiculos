import { NextRequest, NextResponse } from "next/server"
import { getUserInfo } from "@/lib/actions/vehicles"

// Proxy usado pelo gerador de artes (lib/midias/captureCollage.ts e
// prepareCapture.ts) pra desenhar fotos no canvas sem erro de CORS.
// Endurecido: só usuário logado, só hosts de imagem da própria loja (R2 e
// storage do Supabase), sem seguir redirect, sem SVG (que roda script na
// origem do painel) e com tamanho máximo.

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "application/octet-stream"]

function allowedHosts(): Set<string> {
  const hosts = new Set<string>()
  for (const base of [process.env.R2_PUBLIC_BASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!base) continue
    try { hosts.add(new URL(base).host) } catch { /* env mal formatada: ignora */ }
  }
  return hosts
}

export async function GET(req: NextRequest) {
  if (!(await getUserInfo())) return new NextResponse("Unauthorized", { status: 401 })

  const rawUrl = req.nextUrl.searchParams.get("url")
  if (!rawUrl) return new NextResponse("Missing url", { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return new NextResponse("Invalid URL", { status: 400 })
  }

  if (parsed.protocol !== "https:" || !allowedHosts().has(parsed.host)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const res = await fetch(parsed, { redirect: "error" })
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status })

    const ct = (res.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase()
    if (!ALLOWED_TYPES.includes(ct)) return new NextResponse("Not an image", { status: 415 })

    if (Number(res.headers.get("Content-Length") ?? 0) > MAX_BYTES) {
      return new NextResponse("Too large", { status: 413 })
    }
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > MAX_BYTES) return new NextResponse("Too large", { status: 413 })

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    })
  } catch {
    return new NextResponse("Proxy error", { status: 502 })
  }
}
