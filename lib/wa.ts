// ============================================================
// lib/wa.ts — util WhatsApp bersama (klik-chat via wa.me)
// Tanpa emoji di pesan: beberapa klien WhatsApp merusak emoji
// yang dikirim lewat link wa.me.
// ============================================================

/** Bentuk link wa.me. Nomor 08.. → 62.., 8.. → 62... Null bila kosong. */
export function waUrl(phone: string | null | undefined, text: string): string | null {
  let p = (phone || "").replace(/[^0-9]/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = "62" + p.slice(1);
  else if (p.startsWith("8")) p = "62" + p;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
