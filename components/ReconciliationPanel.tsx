"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

export interface ReconRow {
  id: string;
  name: string;
  /** Saldo terhitung app saat ini (termasuk penyesuaian sebelumnya). */
  appBalance: number;
}

interface Props {
  rows: ReconRow[];
  /** Catat penyesuaian agar saldo app = saldo riil. */
  onAdjust: (accountId: string, realBalance: number, note?: string) => void;
}

function parseRp(s: string): number | null {
  const cleaned = s.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Panel Rekonsiliasi (Opsi B): bandingkan saldo tercatat app vs saldo RIIL
 * yang diketik finance. Klik "Sesuaikan" → catat 1 entri penyesuaian sebesar
 * selisih sehingga saldo app = saldo riil. Tidak menghapus transaksi apa pun.
 */
export default function ReconciliationPanel({ rows, onAdjust }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const setInput = (id: string, v: string) => setInputs((p) => ({ ...p, [id]: v }));

  const handleAdjust = (r: ReconRow) => {
    const riil = parseRp(inputs[r.id] ?? "");
    if (riil === null) { alert("Isi Saldo Riil dulu (angka)."); return; }
    const selisih = riil - r.appBalance;
    if (Math.abs(selisih) < 0.01) { alert("Saldo sudah sama, tidak perlu penyesuaian."); return; }
    const arah = selisih > 0 ? "menambah" : "mengurangi";
    if (!confirm(
      `Sesuaikan ${r.name}?\n\n` +
      `Saldo tercatat : ${formatCurrency(r.appBalance)}\n` +
      `Saldo riil      : ${formatCurrency(riil)}\n` +
      `Selisih         : ${selisih > 0 ? "+" : ""}${formatCurrency(selisih)}\n\n` +
      `Akan dibuat entri penyesuaian (${arah} saldo). Transaksi lain tidak diubah.`
    )) return;
    onAdjust(r.id, riil);
    setInput(r.id, "");
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🧮 Rekonsiliasi Saldo</span>
        <span style={{ fontSize: 11, color: "#B89678" }}>Isi saldo riil lapangan → Sesuaikan</span>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Akun</th>
              <th style={{ textAlign: "right" }}>Saldo Tercatat</th>
              <th style={{ width: 180 }}>Saldo Riil (Lapangan)</th>
              <th style={{ textAlign: "right" }}>Selisih</th>
              <th style={{ width: 120, textAlign: "center" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const riil = parseRp(inputs[r.id] ?? "");
              const selisih = riil === null ? null : riil - r.appBalance;
              const off = selisih !== null && Math.abs(selisih) > 0.01;
              return (
                <tr key={r.id} style={off ? { background: "#FFFBEB" } : undefined}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(r.appBalance)}</td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={inputs[r.id] ?? ""}
                      onChange={(e) => setInput(r.id, e.target.value)}
                      placeholder="cth: 5000000"
                      className="form-input"
                      style={{ padding: "5px 8px", fontSize: 13 }}
                    />
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: selisih === null ? "#B89678" : off ? "#DC2626" : "#15803D" }}>
                    {selisih === null ? "—" : (selisih > 0 ? "+" : "") + formatCurrency(selisih)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      onClick={() => handleAdjust(r)}
                      disabled={!off}
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: "5px 12px", opacity: off ? 1 : 0.45, cursor: off ? "pointer" : "not-allowed" }}
                    >
                      Sesuaikan
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card-body" style={{ fontSize: 11.5, color: "#8A7B6E" }}>
        💡 Penyesuaian dicatat sebagai entri <strong>is_adjustment</strong> (badge ADJ) di riwayat —
        tidak dihitung sebagai Masuk/Keluar operasional, dan tidak menghapus transaksi lain.
      </div>
    </div>
  );
}
