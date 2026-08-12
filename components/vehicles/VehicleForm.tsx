"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ChevronDown, Star } from "lucide-react";
import type { Vehicle, VehicleStatus } from "@/lib/types";
import { formatCurrencyInput, maskCurrencyInput, parseCurrencyInput } from "@/lib/format";
import { BRANDS, CATEGORIES } from "@/lib/constants";
import { Switch } from "@/components/ui/Switch";
import { PhotoManager } from "@/components/vehicles/PhotoManager";

import { SURF2, BORDER, MUTED, TEXT, DANGER, ACCENT, YELLOW } from "@/lib/theme";

export type VehicleFormData = Omit<Vehicle, "id" | "createdAt" | "archivedAt">;

type Props = {
  defaultValues?: Partial<VehicleFormData>;
  onSubmit: (data: VehicleFormData) => void;
  loading?: boolean;
  cancelHref?: string;
  submitLabel?: string;
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503736334956-4c8f8e4733e7?w=800&q=80&auto=format&fit=crop";

const TRANSMISSION_OPTIONS = ["Automático", "Manual", "Automatizado", "CVT"];
const FUEL_OPTIONS       = ["Flex", "Gasolina", "Álcool", "Diesel", "Elétrico", "Híbrido"];
const DOORS_OPTIONS      = [2, 3, 4, 5];
const COLOR_OPTIONS      = [
  "Branco", "Preto", "Prata", "Cinza", "Vermelho", "Azul", "Verde",
  "Amarelo", "Laranja", "Marrom", "Bege", "Dourado", "Outra",
];

const OPTIONALS_LIST = [
  "Ar condicionado", "Ar digital", "Direção elétrica", "Direção hidráulica",
  "Vidros elétricos", "Travas elétricas", "Retrovisores elétricos", "Câmera de ré",
  "Sensor de estacionamento", "Sensor de chuva", "Central multimídia",
  "Bluetooth", "GPS / Navegador", "Banco de couro", "Bancos aquecidos",
  "Teto solar", "Teto panorâmico", "Rodas de liga leve", "Airbag duplo",
  "Airbag lateral", "ABS", "Controle de tração", "Controle de estabilidade",
  "Piloto automático", "Freio a disco nas 4 rodas", "Volante multifuncional",
  "Keyless Entry / Start", "Computador de bordo", "Start/Stop automático",
  "Carregador wireless", "Apple CarPlay / Android Auto", "Kit multimídia original",
  "4×4 / AWD / Tração integral", "Blindagem", "GNV instalado",
];

// ── Native field primitives ───────────────────────────────────────────────────

const labelCls    = "text-[10px] font-bold tracking-[0.12em] uppercase";
const inputBaseCls =
  "w-full h-10 rounded-[10px] px-3 text-[13px] outline-none border transition-colors appearance-none";

function DInput({
  label, error, hint, ...rest
}: { label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls} style={{ color: MUTED }}>{label}</span>
      <input
        className={inputBaseCls}
        style={{ backgroundColor: SURF2, borderColor: error ? DANGER : BORDER, color: TEXT, caretColor: ACCENT }}
        onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = error ? DANGER : BORDER; }}
        {...rest}
      />
      {error  && <span className="text-[11px]" style={{ color: DANGER }}>{error}</span>}
      {!error && hint && <span className="text-[11px]" style={{ color: MUTED }}>{hint}</span>}
    </div>
  );
}

function DCombobox({
  label, value, onChange, options, error, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  error?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = value.trim()
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  function selectOption(opt: string) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    onChange(opt);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls} style={{ color: MUTED }}>{label}</span>
      <div className="relative">
        <input
          className={inputBaseCls}
          style={{ backgroundColor: SURF2, borderColor: error ? DANGER : BORDER, color: TEXT, caretColor: ACCENT, paddingRight: "32px" }}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; setOpen(true); }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? DANGER : BORDER;
            blurTimeout.current = setTimeout(() => setOpen(false), 120);
          }}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: MUTED }} />
        {open && filtered.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-[10px] border overflow-y-auto z-20"
            style={{ backgroundColor: SURF2, borderColor: BORDER, maxHeight: "220px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
          >
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => selectOption(opt)}
                className="w-full text-left px-3 py-2 text-[13px] transition-colors hover:bg-white/10"
                style={{ color: TEXT }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <span className="text-[11px]" style={{ color: DANGER }}>{error}</span>}
    </div>
  );
}

function DSelect({ label, children, ...rest }: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls} style={{ color: MUTED }}>{label}</span>
      <select className={inputBaseCls} style={{ backgroundColor: SURF2, borderColor: BORDER, color: TEXT }} {...rest}>
        {children}
      </select>
    </div>
  );
}

function DSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[13px] font-bold" style={{ color: TEXT }}>{children}</h2>;
}

// ── Optionals chips ───────────────────────────────────────────────────────────

function OptionalsSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((o) => o !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  return (
    <div className="space-y-2">
      <span className={labelCls} style={{ color: MUTED }}>Opcionais</span>
      <p className="text-[11px]" style={{ color: MUTED }}>Clique para marcar. Pode marcar quantos quiser.</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONALS_LIST.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                backgroundColor: active ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.04)",
                color:           active ? ACCENT : MUTED,
                border:          `1px solid ${active ? "rgba(212,175,55,0.4)" : BORDER}`,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Toggle row (premium / selo de novidade) ────────────────────────────────────

function ToggleRow({
  value, onChange, icon, label, description, activeColor, activeBg, activeBorder,
}: {
  value: boolean
  onChange: (v: boolean) => void
  icon: ReactNode
  label: string
  description: string
  activeColor: string
  activeBg: string
  activeBorder: string
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ backgroundColor: value ? activeBg : SURF2, border: `1px solid ${value ? activeBorder : BORDER}` }}
    >
      <div>
        <p className="text-[13px] font-semibold flex items-center" style={{ color: value ? activeColor : TEXT }}>
          {icon}
          {label}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{description}</p>
      </div>
      <Switch value={value} onChange={onChange} activeColor={activeColor} />
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

export function VehicleForm({
  defaultValues,
  onSubmit,
  loading     = false,
  cancelHref  = "/estoque",
  submitLabel = "Cadastrar carro",
}: Props) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    name:         defaultValues?.name         ?? "",
    brand:        defaultValues?.brand        ?? "",
    model:        defaultValues?.model        ?? "",
    color:        defaultValues?.color        ?? "",
    category:     defaultValues?.category     ?? "",
    year:         defaultValues?.year?.toString()         ?? new Date().getFullYear().toString(),
    yearModel:    defaultValues?.yearModel?.toString()    ?? "",
    km:           defaultValues?.km?.toString()           ?? "0",
    transmission: defaultValues?.transmission ?? "Automático",
    fuel:         defaultValues?.fuel         ?? "Flex",
    doors:        defaultValues?.doors?.toString()        ?? "4",
    motor:        defaultValues?.motor        ?? "",
    price:        defaultValues?.price        ? formatCurrencyInput(defaultValues.price) : "",
    status:       (defaultValues?.status ?? "disponivel") as VehicleStatus,
    acquiredAt:   defaultValues?.acquiredAt   ?? today,
  });

  const [images,    setImages]    = useState<string[]>(
    defaultValues?.images?.length  ? defaultValues.images
    : defaultValues?.imageUrl      ? [defaultValues.imageUrl]
    : []
  );
  const [thumbnails, setThumbnails] = useState<string[]>(defaultValues?.thumbnails ?? []);
  const [optionals, setOptionals] = useState<string[]>(defaultValues?.optionals ?? []);
  const [isPremium, setIsPremium] = useState(defaultValues?.isPremium ?? false);
  const isNew = defaultValues?.isNew ?? false;
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  function setF(key: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Obrigatório";
    if (!form.brand.trim()) e.brand = "Obrigatório";
    if (!form.model.trim()) e.model = "Obrigatório";
    const yr = Number(form.year);
    if (!form.year || yr < 1950 || yr > new Date().getFullYear() + 2) e.year = "Ano inválido";
    if (form.yearModel) {
      const yrModel = Number(form.yearModel);
      if (yrModel < yr || yrModel > yr + 1) e.yearModel = "Deve ser o ano de fabricação ou o seguinte";
    }
    if (!form.price || parseCurrencyInput(form.price) <= 0) e.price = "Obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const cover = images[0] ?? PLACEHOLDER_IMAGE;
    onSubmit({
      name:         form.name.trim(),
      brand:        form.brand.trim(),
      model:        form.model.trim(),
      color:        form.color,
      category:     form.category,
      year:         parseInt(form.year),
      yearModel:    form.yearModel ? parseInt(form.yearModel) : undefined,
      km:           parseInt(form.km) || 0,
      transmission: form.transmission,
      fuel:         form.fuel,
      doors:        parseInt(form.doors),
      motor:        form.motor.trim(),
      optionals,
      isPremium,
      isNew,
      images,
      thumbnails,
      imageUrl:     cover,
      price:        parseCurrencyInput(form.price),
      status:       form.status,
      acquiredAt:   form.acquiredAt || today,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">

      {/* Fotos */}
      <section className="space-y-4">
        <DSectionTitle>Fotos do carro</DSectionTitle>
        <div className="h-px" style={{ backgroundColor: BORDER }} />
        <PhotoManager
          images={images}
          thumbnails={thumbnails}
          onChange={(imgs, thumbs) => { setImages(imgs); setThumbnails(thumbs); }}
        />
      </section>

      {/* Informações */}
      <section className="space-y-4">
        <DSectionTitle>Informações do veículo</DSectionTitle>
        <div className="h-px" style={{ backgroundColor: BORDER }} />

        <DInput label="Nome completo" placeholder="Ex: Tracker 1.2 Premier Turbo Aut. 5p"
          value={form.name} onChange={(e) => setF("name", e.target.value)} error={errors.name} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DCombobox label="Marca" placeholder="Ex: Chevrolet" options={BRANDS}
            value={form.brand} onChange={(v) => setF("brand", v)} error={errors.brand} />
          <DInput label="Modelo" placeholder="Ex: Tracker"
            value={form.model} onChange={(e) => setF("model", e.target.value)} error={errors.model} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DSelect label="Categoria" value={form.category} onChange={(e) => setF("category", e.target.value)}>
            <option value="">— Selecionar —</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </DSelect>
          <DSelect label="Cor" value={form.color} onChange={(e) => setF("color", e.target.value)}>
            <option value="">— Selecionar —</option>
            {COLOR_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </DSelect>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <DInput label="Ano fabricação" placeholder="2021" type="number"
            value={form.year} onChange={(e) => setF("year", e.target.value)} error={errors.year} />
          <DInput label="Ano modelo" placeholder="2022" type="number" hint="Opcional"
            value={form.yearModel} onChange={(e) => setF("yearModel", e.target.value)} error={errors.yearModel} />
          <DInput label="KM" placeholder="60000" type="number"
            value={form.km} onChange={(e) => setF("km", e.target.value)} />
          <DSelect label="Portas" value={form.doors} onChange={(e) => setF("doors", e.target.value)}>
            {DOORS_OPTIONS.map((d) => <option key={d} value={d}>{d} portas</option>)}
          </DSelect>
          <DSelect label="Status" value={form.status} onChange={(e) => setF("status", e.target.value as VehicleStatus)}>
            <option value="disponivel">Disponível</option>
            <option value="reservado">Reservado</option>
            <option value="vendido">Vendido</option>
          </DSelect>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DSelect label="Câmbio" value={form.transmission} onChange={(e) => setF("transmission", e.target.value)}>
            {TRANSMISSION_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </DSelect>
          <DSelect label="Combustível" value={form.fuel} onChange={(e) => setF("fuel", e.target.value)}>
            {FUEL_OPTIONS.map((f) => <option key={f}>{f}</option>)}
          </DSelect>
        </div>

        <DInput label="Motor (opcional)" placeholder="Ex: 1.6 TGDI"
          value={form.motor} onChange={(e) => setF("motor", e.target.value)}
          hint="Aparece nas especificações do site" />

        <DInput label="Data de aquisição" type="date"
          value={form.acquiredAt} onChange={(e) => setF("acquiredAt", e.target.value)}
          hint="Para cálculo de giro no estoque" />

        <div className="pt-2">
          <OptionalsSelector selected={optionals} onChange={setOptionals} />
        </div>

        <ToggleRow
          value={isPremium} onChange={setIsPremium}
          icon={<Star className="inline w-4 h-4 mr-1.5" />}
          label="Carro premium" description="Destaque especial no estoque"
          activeColor={YELLOW} activeBg="rgba(255,174,31,0.08)" activeBorder="rgba(255,174,31,0.3)"
        />
      </section>

      {/* Preço */}
      <section className="space-y-4">
        <DSectionTitle>Preço</DSectionTitle>
        <div className="h-px" style={{ backgroundColor: BORDER }} />

        <DInput label="Preço exibido no site (R$)" placeholder="104.590,00" type="text" inputMode="decimal"
          value={form.price} onChange={(e) => setF("price", maskCurrencyInput(e.target.value))} error={errors.price} />
      </section>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
        <Link
          href={cancelHref}
          className="inline-flex items-center px-5 h-9 text-[13px] font-semibold rounded-xl transition-colors hover:bg-white/5"
          style={{ color: MUTED, border: `1px solid ${BORDER}` }}
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isPending={loading}
          className="font-semibold px-5"
          style={{ boxShadow: "0 2px 12px rgba(212,175,55,0.35)" }}
        >
          {submitLabel}
        </Button>
      </div>

    </form>
  );
}
