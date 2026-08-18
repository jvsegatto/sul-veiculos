import imageCompression from "browser-image-compression"

// Comprime no navegador antes de subir — converte pra WebP, largura máx
// 1280px. O servidor (app/api/upload) ainda reprocessa com sharp e gera as
// versões finais (full + thumb); essa etapa existe só pra não mandar o
// arquivo cru (câmera de celular facilmente teria 5-10MB) pela rede antes
// disso — NÃO é a etapa que define a qualidade final, então a meta de
// tamanho aqui só precisa ser "bem menor que o arquivo cru", não pequena.
// Com maxSizeMB 0.3 (valor antigo), o navegador derrubava a qualidade bem
// abaixo de 0.82 pra caber nesse teto numa foto de carro com detalhe —
// depois o servidor recomprimia de novo em cima disso já degradado (perda
// dupla). 2.5MB dá folga de sobra pra manter qualidade e ainda fica muito
// menor que o arquivo original.
export async function compressForUpload(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 1280,
    maxSizeMB: 2.5,
    fileType: "image/webp",
    useWebWorker: true,
    initialQuality: 0.9,
  })
}
