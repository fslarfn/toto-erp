"use client";
import type { AccountReconciliation } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  rows: AccountReconciliation[];
  syncing?: boolean;
  onSync?: () => void;
}

/**
 * Panel rekonsiliasi saldo: untuk tiap akun menampilkan
 * "saldo tersimpan" (cache) vs "saldo terhitung dari cash_flow" + selisihnya,
 * sehingga selisih sekecil 5.000 langsung terlihat.
 */
export default function ReconciliationPanel({ rows, syncing, onSync }: Props) {
  const totalStored = rows.reduce((s, r) => s + r.storedBalance, 0);
  const totalComputed = rows.reduce((s, r) => s + r.computedBalance, 0);
  const totalDiff = totalStored - totalComputed;
  const hasDiff = rows.some((r) => Math.abs(r.diff) > 0.01);

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🧮 Rekonsiliasi Saldo</span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: hasDiff ? "#B45309" : "#15803D",
          background: hasDiff ? "#FEF3C7" : "#DCFCE7",
          padding: "3px 10px", borderRadius: 999,
        }}>
          {hasDiff ? "⚠️ Ada selisih" : "✓ Seimbang"}
        </span>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Akun</th>
              <th style={{ textAlign: "right" }}>Saldo Tersimpan</th>
              <th style={{ textAlign: "right" }}>Saldo Terhitung</th>
              <th style={{ textAlign: "right" }}>Selisih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const off = Math.abs(r.diff) > 0.01;
              return (
                <tr key={r.id} style={off ? { background: "#FFFBEB" } : undefined}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.storedBalance)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(r.computedBalance)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: off ? "#DC2626" : "#15803D" }}>
                    {r.diff === 0 ? "—" : (r.diff > 0 ? "+" : "") + formatCurrency(r.diff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #E6D5BE", fontWeight: 700 }}>
              <td>Total</td>
              <td style={{ textAlign: "right" }}>{formatCurrency(totalStored)}</td>
              <td style={{ textAlign: "right" }}>{formatCurrency(totalComputed)}</td>
              <td style={{ textAlign: "right", color: Math.abs(totalDiff) > 0.01 ? "#DC2626" : "#15803D" }}>
                {totalDiff === 0 ? "—" : (totalDiff > 0 ? "+" : "") + formatCurrency(totalDiff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {hasDiff && onSync && (
        <div className="card-body" style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onSync} disabled={syncing} className="btn btn-primary" style={{ fontSize: 13 }}>
            {syncing ? "⌛ Menyinkronkan..." : "🔄 Sinkronkan Saldo Tersimpan"}
          </button>
        </div>
      )}
    </div>
  );
}
