
import React, { useState, useMemo } from 'react';
import { usePesanan, PesananRow } from '@/lib/pesanan-store';
import { FinishingOperatorSelect } from './FinishingOperatorSelect';
import { FinishingPreview } from './FinishingPreview';

const MONTH_NAMES_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtDateFull(iso: string): string {
  if (!iso) return "—";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${parseInt(p[2])} ${MONTH_NAMES_LONG[parseInt(p[1]) - 1]} ${p[0]}`;
}

export const FinishingTab: React.FC = () => {
  const { rows } = usePesanan();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);
  const [operatorFinishing, setOperatorFinishing] = useState("");

  const years: number[] = [];
  for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

  // Grouping logic (Sama dengan Riwayat)
  const baseRows = rows.filter((r) => (r.customer || r.deskripsi) && r.printed_at);
  const filtered = baseRows.filter((r) => {
    const d = r.printed_at;
    return d && parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month;
  });

  const groupMap: Record<string, { poLabel: string; tanggal: string; rows: PesananRow[] }> = {};
  filtered.forEach((r) => {
    const opKey = r.po_label || "(Tanpa Operator)";
    const key = `${r.printed_at}|||${opKey}`;
    if (!groupMap[key]) {
      groupMap[key] = { poLabel: opKey, tanggal: r.printed_at, rows: [] };
    }
    groupMap[key].rows.push(r);
  });

  const sortedKeys = Object.keys(groupMap).sort((a, b) => b.localeCompare(a));

  const toggleGroup = (key: string) => {
    setSelectedGroupKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectedItems = useMemo(() => {
    const all: PesananRow[] = [];
    selectedGroupKeys.forEach(key => {
      if (groupMap[key]) {
        all.push(...groupMap[key].rows);
      }
    });
    return all;
  }, [selectedGroupKeys, groupMap]);

  const handlePrint = () => {
    const el = document.getElementById("print-area");
    if (!el || !operatorFinishing || selectedItems.length === 0) return;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    
    // Gunakan CSS counter untuk penomoran halaman yang akurat di window.print()
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>PO Finishing - ${operatorFinishing}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color:#000; margin:0 }
  @media print {
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    @page { 
      margin: 1.5cm; 
      @bottom-center {
        content: "Halaman " counter(page) " dari " counter(pages);
      }
    }
    .no-print { display: none !important; }
    .page-footer {
      position: fixed;
      bottom: 0;
      right: 0;
      font-size: 10px;
      color: #666;
    }
  }
  table { width:100%; border-collapse:collapse; }
  th { background:#f3f4f6 !important; color:#000 !important; padding:8px 10px; border:1px solid #000; font-size:11px; text-transform:uppercase; }
  td { padding:8px 10px; border:1px solid #000; font-size:12px; }
  .checkbox-square { width:18px; height:18px; border:1.5px solid #000; display:inline-block; }
</style></head>
<body onload="window.print();window.close();">
  <div style="padding: 20px;">
    ${el.innerHTML}
  </div>
</body></html>`);
    win.document.close();
  };

  // Responsivitas: Deteksi jika layar kecil
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1000);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, overflow: "hidden" }}>
      {/* Panel Kiri: List Sesi */}
      <div style={{ 
        width: isMobile ? "100%" : 380, 
        height: isMobile ? "50%" : "auto",
        minWidth: isMobile ? "100%" : 320, 
        background: "white", 
        borderRight: isMobile ? "none" : "1px solid #E6D5BE",
        borderBottom: isMobile ? "1px solid #E6D5BE" : "none",
        display: "flex", 
        flexDirection: "column", 
        overflow: "hidden" 
      }}>
        <div style={{ padding: "16px 18px", background: "#FAF7F3", borderBottom: "1px solid #E6D5BE" }}>
           <h3 style={{ fontSize: 13, fontWeight: 800, color: "#5C4033", margin: "0 0 12px" }}>PILIH SESI PO</h3>
           <div style={{ display: "flex", gap: 6 }}>
              <select value={month} onChange={(e) => setMonth(+e.target.value)}
                  style={{ flex: 1, border: "1.5px solid #D1BFA3", borderRadius: 6, padding: "6px px", fontSize: 12, color: "#5C4033", background: "white" }}>
                  {MONTH_NAMES_LONG.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(+e.target.value)}
                  style={{ width: 80, border: "1.5px solid #D1BFA3", borderRadius: 6, padding: "6px px", fontSize: 12, color: "#5C4033", background: "white" }}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
           </div>
        </div>

        <div style={{ padding: "16px 18px", borderBottom: "1px solid #F0E6D8" }}>
          <FinishingOperatorSelect value={operatorFinishing} onChange={setOperatorFinishing} />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {sortedKeys.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#C5A882", fontSize: 12 }}>
              Tidak ada riwayat cetak di bulan ini.
            </div>
          ) : (
            sortedKeys.map((key) => {
              const grp = groupMap[key];
              const isSel = selectedGroupKeys.includes(key);
              const dateOnly = grp.tanggal.slice(0, 10);
              const timeOnly = grp.tanggal.slice(11, 16);
              return (
                <div 
                  key={key} 
                  onClick={() => toggleGroup(key)}
                  style={{ 
                    padding: "12px 18px", 
                    borderBottom: "1px solid #F5F0EC", 
                    cursor: "pointer", 
                    background: isSel ? "#FEF3E8" : "white",
                    borderLeft: isSel ? "4px solid #A67B5B" : "4px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}
                >
                  <input type="checkbox" checked={isSel} readOnly style={{ accentColor: "#A67B5B" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678" }}>{fmtDateFull(dateOnly)} - {timeOnly}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#3C2F2F" }}>{grp.poLabel}</div>
                    <div style={{ fontSize: 11, color: "#8B5E3C" }}>{grp.rows.length} item · Qty: {grp.rows.reduce((a, r) => a + (parseFloat(r.qty) || 0), 0).toFixed(2)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: "16px 18px", background: "#FAF7F3", borderTop: "1px solid #E6D5BE" }}>
           <button 
             onClick={handlePrint}
             disabled={!operatorFinishing || selectedItems.length === 0}
             style={{ 
               width: "100%", 
               padding: "12px", 
               borderRadius: 10, 
               border: "none", 
               background: (!operatorFinishing || selectedItems.length === 0) ? "#D1BFA3" : "#A67B5B",
               color: "white",
               fontWeight: 800,
               fontSize: 14,
               cursor: "pointer",
               boxShadow: "0 4px 6px rgba(166,123,91,0.2)",
               transition: "all 0.2s"
             }}
           >
             🖨️ CETAK PO FINISHING ({selectedItems.length})
           </button>
        </div>
      </div>

      {/* Panel Kanan: Preview */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px", background: "#F5EBDD" }}>
        <FinishingPreview items={selectedItems} operatorFinishing={operatorFinishing} />
      </div>
    </div>
  );
};
