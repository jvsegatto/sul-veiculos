declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer | ArrayBuffer
    format: "JPEG" | "PNG"
    quality?: number
  }

  function convert(options: ConvertOptions): Promise<Buffer>

  export default convert
}
