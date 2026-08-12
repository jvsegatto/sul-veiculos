import { NextRequest, NextResponse } from "next/server"

// IPs privados / locais — bloqueados para evitar SSRF
const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")
  if (!rawUrl) return new NextResponse("Missing url", { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return new NextResponse("Invalid URL", { status: 400 })
  }

  // Só HTTPS externo — bloqueia protocolos locais e IPs privados (SSRF básico)
  if (parsed.protocol !== "https:") {
    return new NextResponse("Forbidden", { status: 403 })
  }
  if (PRIVATE_HOST.test(parsed.hostname)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const res = await fetch(rawUrl)
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status })

    const ct = res.headers.get("Content-Type") ?? ""
    // Só serve imagens — evita vazar conteúdo arbitrário de terceiros
    if (!ct.startsWith("image/") && !ct.startsWith("application/octet-stream")) {
      return new NextResponse("Not an image", { status: 415 })
    }

    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    })
  } catch {
    return new NextResponse("Proxy error", { status: 502 })
  }
}
