import imageCompression from "browser-image-compression"

// Comprime no navegador antes de subir — converte pra WebP, largura máx
// 1280px, mirando ~0.3MB. O servidor (app/api/upload) ainda reprocessa com
// sharp e gera as versões finais (full + thumb); essa etapa existe só pra
// não mandar o arquivo cru (câmera de celular facilmente teria 5-10MB) pela
// rede antes disso.
export async function compressForUpload(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 1280,
    maxSizeMB: 0.3,
    fileType: "image/webp",
    useWebWorker: true,
    initialQuality: 0.82,
  })
}
