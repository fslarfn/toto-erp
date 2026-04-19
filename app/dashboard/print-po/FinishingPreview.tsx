
import React, { useMemo } from 'react';
import { PesananRow } from '@/lib/pesanan-store';

interface Props {
  items: PesananRow[];
  operatorFinishing: string;
}

export const FinishingPreview: React.FC<Props> = ({ items, operatorFinishing }) => {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const custA = (a.customer || "").trim().toUpperCase();
      const custB = (b.customer || "").trim().toUpperCase();
      
      const charA = custA[0] || "";
      const charB = custB[0] || "";
      
      // 1. Sort by Abjad (First Char)
      if (charA !== charB) return charA.localeCompare(charB);
      
      // 2. Sort by Full Name
      if (custA !== custB) return custA.localeCompare(custB);
      
      // 3. Sort by Description
      const deskA = (a.deskripsi || "").toLowerCase();
      const deskB = (b.deskripsi || "").toLowerCase();
      return deskA.localeCompare(deskB);
    });
  }, [items]);

  const totalQty = useMemo(() => {
    return sortedItems.reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
  }, [sortedItems]);

  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 20px rgba(92,64,51,0.09)", padding: "32px 36px", maxWidth: 900, margin: "0 auto" }}>
      <div id="print-area">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            body { padding: 0 !important; margin: 0 !important; }
            .print-container { padding: 0 !important; box-shadow: none !important; border: none !important; }
            @page { 
              margin: 1.5cm;
              @bottom-right {
                content: "Hal " counter(page) " / " counter(pages);
              }
            }
          }
          .finishing-table th { background: #f3f4f6 !important; color: #1f2937 !important; border: 1px solid #d1d5db !important; }
          .finishing-table td { border: 1px solid #e5e7eb !important; padding: 8px 10px !important; }
          .checkbox-cell { width: 45px; text-align: center; }
          .checkbox-square { width: 18px; height: 18px; border: 1.5px solid #374151; border-radius: 3px; display: inline-block; }
        `}</style>
        
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>TANGGAL: {today}</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "4px 0" }}>PO FINISHING</h2>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>OPERATOR: {operatorFinishing || "...................."}</div>
        </div>

        <table className="finishing-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>NO</th>
              <th style={{ textAlign: "left" }}>CUSTOMER</th>
              <th style={{ textAlign: "left" }}>DESKRIPSI</th>
              <th style={{ width: 60 }}>UK</th>
              <th style={{ width: 40 }}>QTY</th>
              <th className="checkbox-cell">REPAIR</th>
              <th className="checkbox-cell">WARNA</th>
              <th className="checkbox-cell">GUDANG</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontStyle: "italic" }}>
                  Pilih satu atau lebih sesi PO di panel kiri untuk melihat pratinjau.
                </td>
              </tr>
            ) : (
              sortedItems.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: "center", color: "#9CA3AF" }}>{idx + 1}</td>
                  <td style={{ fontWeight: 800, color: "#000", textTransform: "uppercase" }}>{item.customer}</td>
                  <td style={{ color: "#374151" }}>{item.deskripsi}</td>
                  <td style={{ textAlign: "center" }}>{item.ukuran || "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{item.qty}</td>
                  <td className="checkbox-cell"><div className="checkbox-square" /></td>
                  <td className="checkbox-cell"><div className="checkbox-square" /></td>
                  <td className="checkbox-cell"><div className="checkbox-square" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {sortedItems.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 12, color: "#4B5563" }}>
              <strong>Total Qty: {totalQty.toFixed(2)}</strong> <br/>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>Dicetak pada {new Date().toLocaleString('id-ID')}</span>
            </div>
            <div style={{ textAlign: "center", width: 140 }}>
              <div style={{ height: 60 }} />
              <div style={{ borderTop: "1.5px solid #111827", fontSize: 11, fontWeight: 700, paddingTop: 4 }}>{operatorFinishing || "Operator Finishing"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
