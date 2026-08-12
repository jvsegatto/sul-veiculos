export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// ── Currency input mask (ex: "99.990,00") ──────────────────────────────────────

export function formatCurrencyInput(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function maskCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseCurrencyInput(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) / 100 : 0;
}

export function formatKm(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value) + " km";
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateString));
}
