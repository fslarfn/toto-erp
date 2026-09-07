export type MatchReceipt = {
  amount: number;
  date: string;
  payerName: string;
  description: string;
  reference: string;
};

export type MatchInvoice = {
  invoiceKey: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  outstanding: number;
};

export type InvoiceMatch = MatchInvoice & {
  score: number;
  confidence: "tinggi" | "sedang" | "rendah";
  reasons: string[];
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length >= 3));

function nameSimilarity(left: string, right: string) {
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / Math.max(a.size, b.size);
}

function dayDistance(left: string, right: string) {
  const a = Date.parse(`${left.slice(0, 10)}T00:00:00Z`), b = Date.parse(`${right.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(a - b) / 86_400_000);
}

export function scoreInvoiceMatch(receipt: MatchReceipt, invoice: MatchInvoice): InvoiceMatch {
  if (invoice.outstanding <= 0) return { ...invoice, score: 0, confidence: "rendah", reasons: [] };
  let score = 0;
  const reasons: string[] = [];
  const haystack = normalize(`${receipt.description} ${receipt.reference}`);
  const invoiceToken = normalize(invoice.invoiceNumber);
  if (invoiceToken.length >= 3 && haystack.includes(invoiceToken)) {
    score += 60;
    reasons.push("nomor invoice ditemukan pada mutasi");
  }

  const amountGap = Math.abs(receipt.amount - invoice.outstanding);
  const amountRatio = amountGap / Math.max(invoice.outstanding, 1);
  if (amountGap <= 1) {
    score += 35;
    reasons.push("nominal sama");
  } else if (amountRatio <= 0.01) {
    score += 28;
    reasons.push("nominal hampir sama");
  } else if (receipt.amount < invoice.outstanding) {
    score += 8;
    reasons.push("memungkinkan pembayaran sebagian");
  }

  const similarity = Math.max(
    nameSimilarity(receipt.payerName, invoice.customerName),
    nameSimilarity(receipt.description, invoice.customerName),
  );
  if (similarity >= 0.75) {
    score += 24;
    reasons.push("nama customer sangat mirip");
  } else if (similarity >= 0.4) {
    score += 14;
    reasons.push("nama customer mirip");
  }

  const days = dayDistance(receipt.date, invoice.date);
  if (days <= 7) {
    score += 8;
    reasons.push("tanggal berdekatan");
  } else if (days <= 45) {
    score += 4;
    reasons.push("tanggal masih dalam rentang wajar");
  }

  score = Math.min(score, 100);
  return { ...invoice, score, confidence: score >= 80 ? "tinggi" : score >= 50 ? "sedang" : "rendah", reasons };
}

export function rankInvoiceMatches(receipt: MatchReceipt, invoices: MatchInvoice[], limit = 30) {
  return invoices
    .map(invoice => scoreInvoiceMatch(receipt, invoice))
    .sort((a, b) => b.score - a.score || Math.abs(receipt.amount - a.outstanding) - Math.abs(receipt.amount - b.outstanding))
    .slice(0, limit);
}
