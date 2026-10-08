import type { HppProductRow } from "./store";

/** An explicit empty choice means skip, not fall back to automatic matching. */
export function resolveHppProduct(description: string, products: HppProductRow[], aliases: Record<string, string>, selected?: string): HppProductRow | null {
  if (selected !== undefined) return products.find(product => product.id === selected && product.workspace === "toto") ?? null;
  return matchHppProduct(description, products, aliases);
}

export function normalizeHppName(name: string): string {
  return name.toUpperCase().replace(/\\/g, "").replace(/['"“”″]+/g, ' IN ')
    .replace(/\bOB\b/g, "OPENBACK").replace(/\bH[.]\s*DOFF\b/g, "HITAM DOFF")
    .replace(/\s+/g, " ").trim();
}

/** Match a unique catalog prefix; unknown profile/finish qualifiers are never guessed. */
export function matchHppProduct(description: string, products: HppProductRow[], aliases: Record<string, string> = {}): HppProductRow | null {
  const aliasId = aliases[description.trim().toLowerCase()];
  if (aliasId) return products.find(p => p.id === aliasId) ?? null;
  const name = normalizeHppName(description);
  const candidates = products.filter(p => {
    if (!p.id || p.workspace !== "toto") return false;
    const prefix = normalizeHppName(p.product_name);
    if (!prefix) return false;
    if (name === prefix) return true;
    if (!name.startsWith(prefix + " ")) return false;
    const suffix = name.slice(prefix.length).trim();
    // Only dimensional/template qualifiers may follow the complete catalog name.
    return /^(?:L\s*\d|T\s*\d|D\.?\s*\d|MAL\b|LINGKARAN\b)/.test(suffix)
      && !/\b(?:OPENBACK|YKK|MF|SEMI|DOFF|WHITE|COKLAT|HITAM|ORNAMEN|STOPER|DAUN)\b/.test(suffix);
  });
  return candidates.length === 1 ? candidates[0] : null;
}
