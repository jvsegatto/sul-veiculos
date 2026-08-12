"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { GripVertical, ImagePlus, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { compressForUpload } from "@/lib/uploads/compressImage";

import { SURF2, BORDER, MUTED, TEXT, DANGER, ACCENT, YELLOW } from "@/lib/theme";

const labelCls = "text-[10px] font-bold tracking-[0.12em] uppercase";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop";

type UploadResult = { full: string; thumb: string };

// Comprime no navegador (WebP, máx 1280px, ~0.3MB — ver compressImage.ts) e
// sobe pra /api/upload, que reprocessa com sharp (full 1280px + thumb 480px)
// e sobe as duas versões pro Cloudflare R2. Precisa do prefixo /admin na URL
// porque basePath do Next não reescreve fetch() de client component — só
// asset/navegação gerados pelo próprio Next (mesmo padrão do image-proxy).
async function uploadViaApi(file: File): Promise<UploadResult> {
  const compressed = await compressForUpload(file);
  const formData = new FormData();
  formData.append("file", compressed, "photo.webp");

  const res = await fetch("/admin/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ao enviar (HTTP ${res.status})`);
  }
  const data = await res.json() as { fullUrl: string; thumbUrl: string };
  return { full: data.fullUrl, thumb: data.thumbUrl };
}

type Props = {
  images: string[];
  thumbnails: string[];
  onChange: (images: string[], thumbnails: string[]) => void;
  /**
   * Override opcional de como cada arquivo é enviado — por padrão sobe via
   * /api/upload (exige sessão autenticada de manager). A página de
   * rascunhos do conector MCP (sem login, só com o capability link) passa
   * uma versão que sobe via Server Action com o service role, já que não
   * tem sessão pra passar por essa rota.
   */
  uploadFile?: (file: File) => Promise<UploadResult>;
};

type Pair = { full: string; thumb: string };

function zip(images: string[], thumbnails: string[]): Pair[] {
  return images.map((full, i) => ({ full, thumb: thumbnails[i] ?? full }));
}

// Uploader de fotos pro Cloudflare R2 (compressão no cliente + full/thumb no
// servidor), compartilhado entre o formulário de veículo (VehicleForm.tsx) e
// a página de rascunhos do conector MCP (/estoque/rascunhos/[id]).
export function PhotoManager({ images, thumbnails, onChange, uploadFile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [draggedFull, setDraggedFull] = useState<string | null>(null);
  // Reordenar dispara "dragover" várias vezes por segundo enquanto o dedo/mouse
  // passa por cada posição — chamar onChange (e o autosave do rascunho) a cada
  // evento desses cria várias chamadas concorrentes que podem terminar fora de
  // ordem e sobrescrever a ordem final com uma intermediária. Por isso o
  // arraste só atualiza esse preview local; onChange só dispara uma vez, no
  // drop/dragEnd, com a ordem definitiva.
  const [previewOrder, setPreviewOrder] = useState<Pair[] | null>(null);
  const pairs = previewOrder ?? zip(images, thumbnails);

  function emit(next: Pair[]) {
    onChange(next.map((p) => p.full), next.map((p) => p.thumb));
  }

  function openPicker() {
    fileRef.current?.click();
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setUploadErr(null);

    const uploaded: Pair[] = [];

    for (const file of files) {
      try {
        const result = uploadFile ? await uploadFile(file) : await uploadViaApi(file);
        uploaded.push({ full: result.full, thumb: result.thumb });
      } catch (err) {
        setUploadErr(`Erro ao enviar ${file.name}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
        setUploading(false);
        e.target.value = "";
        return;
      }
    }

    emit([...zip(images, thumbnails), ...uploaded]);
    setUploading(false);
    e.target.value = "";
  }

  function remove(i: number) {
    emit(pairs.filter((_, idx) => idx !== i));
  }

  function setCover(i: number) {
    const reordered = [...pairs];
    const [item] = reordered.splice(i, 1);
    reordered.unshift(item);
    emit(reordered);
  }

  function handleDragStart(full: string) {
    setDraggedFull(full);
    setPreviewOrder(pairs);
  }

  function handleDragOver(i: number) {
    if (!draggedFull || !previewOrder) return;
    const from = previewOrder.findIndex((p) => p.full === draggedFull);
    if (from === -1 || from === i) return;
    const next = [...previewOrder];
    const [item] = next.splice(from, 1);
    next.splice(i, 0, item);
    setPreviewOrder(next);
  }

  function handleDragEnd() {
    if (previewOrder) emit(previewOrder);
    setDraggedFull(null);
    setPreviewOrder(null);
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex items-center justify-between">
        <div>
          <span className={labelCls} style={{ color: MUTED }}>Fotos do carro</span>
          <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
            A primeira foto vira a capa. Arraste as fotos para reordenar.
          </p>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="h-9 px-4 rounded-[10px] flex items-center gap-1.5 text-[12px] font-bold transition-colors shrink-0"
          style={{ backgroundColor: "rgba(212,175,55,0.15)", color: ACCENT, border: `1px solid rgba(212,175,55,0.3)` }}
        >
          {uploading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ImagePlus className="w-3.5 h-3.5" />
          }
          {uploading ? "Enviando…" : "Adicionar fotos"}
        </button>
      </div>

      {uploadErr && (
        <p className="text-[11px]" style={{ color: DANGER }}>{uploadErr}</p>
      )}

      {pairs.length > 0 ? (
        <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {pairs.map((pair, i) => (
            <motion.div
              key={pair.full}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.6 }}
              draggable
              onDragStart={() => handleDragStart(pair.full)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(i); }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              className="relative rounded-xl overflow-hidden group cursor-grab active:cursor-grabbing"
              style={{
                aspectRatio: "4/3",
                opacity: draggedFull === pair.full ? 0.5 : 1,
                scale: draggedFull === pair.full ? 0.95 : 1,
                zIndex: draggedFull === pair.full ? 10 : 1,
                boxShadow: draggedFull === pair.full ? "0 8px 24px rgba(0,0,0,0.5)" : "none",
              }}
            >
              <img
                src={pair.thumb}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
              />
              <div className="absolute top-1.5 right-1.5 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
                <GripVertical className="w-3 h-3" style={{ color: "rgba(255,255,255,0.8)" }} />
              </div>
              {i === 0 && (
                <span
                  className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: "rgba(0,0,0,0.7)", color: YELLOW }}
                >
                  CAPA
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => setCover(i)}
                    className="rounded-lg p-1.5"
                    style={{ backgroundColor: "rgba(255,174,31,0.2)", color: YELLOW }}
                    title="Tornar capa"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg p-1.5"
                  style={{ backgroundColor: "rgba(168,14,14,0.2)", color: DANGER }}
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
          <button
            type="button"
            onClick={openPicker}
            className="rounded-xl flex flex-col items-center justify-center gap-1 transition-colors hover:border-blue-400/50"
            style={{ aspectRatio: "4/3", border: `2px dashed ${BORDER}`, color: MUTED }}
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px]">Mais fotos</span>
          </button>
        </motion.div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="w-full rounded-xl flex flex-col items-center justify-center gap-2 py-10 transition-colors hover:border-blue-400/40"
          style={{ border: `2px dashed ${BORDER}`, color: MUTED }}
        >
          <ImagePlus className="w-8 h-8" />
          <span className="text-[13px] font-semibold" style={{ color: TEXT }}>Clique para selecionar fotos</span>
          <span className="text-[11px]">JPG, PNG, WEBP — pode selecionar várias de uma vez. No iPhone, prefira JPEG.</span>
        </button>
      )}
    </div>
  );
}
