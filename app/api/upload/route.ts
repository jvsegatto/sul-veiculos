import { NextRequest, NextResponse } from "next/server"
import { getUserInfo } from "@/lib/actions/vehicles"
import { processAndUploadImage } from "@/lib/uploads/r2"

// sharp e o SDK do S3/R2 são libs Node nativas — não rodam no Edge runtime.
export const runtime = "nodejs"

// Upload de foto de veículo — recebe a imagem já comprimida no cliente
// (ver lib/uploads/compressImage.ts), gera full (1280px) + thumb (480px)
// em WebP via sharp e sobe as duas pro Cloudflare R2 (ver lib/uploads/r2.ts).
// Exige sessão de manager, igual às outras mutações de veículo — o fluxo sem
// sessão (conector MCP / rascunhos) usa a Server Action uploadDraftPhoto,
// que chama processAndUploadImage diretamente.
export async function POST(req: NextRequest) {
  const userInfo = await getUserInfo()
  if (!userInfo || userInfo.role === "VENDEDOR") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const baseName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const { fullUrl, thumbUrl } = await processAndUploadImage(buffer, baseName)
    return NextResponse.json({ fullUrl, thumbUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar imagem"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
