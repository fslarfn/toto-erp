"use client";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { PesananRow } from "@/lib/pesanan-store";

type Props = {
    onImport: (rows: Partial<PesananRow>[]) => void;
};

const COL_MAP: Record<string, keyof PesananRow> = {
    tanggal: "tanggal", date: "tanggal", tgl: "tanggal",
    customer: "customer", "nama customer": "customer", pelanggan: "customer", nama: "customer",
    deskripsi: "deskripsi", description: "deskripsi", keterangan: "deskripsi", barang: "deskripsi",
    ukuran: "ukuran", size: "ukuran", uk: "ukuran",
    qty: "qty", jumlah: "qty", quantity: "qty",
    harga: "harga", price: "harga", "harga satuan": "harga",
    "no inv": "no_inv", "no invoice": "no_inv", invoice: "no_inv", inv: "no_inv", noinv: "no_inv",
    "no sj": "no_sj", "surat jalan": "no_sj",
    "di produksi": "di_produksi", produksi: "di_produksi",
    "di warna": "di_warna", warna: "di_warna",
    "siap kirim": "siap_kirim", siap: "siap_kirim",
    "di kirim": "di_kirim", kirim: "di_kirim",
    ekspedisi: "ekspedisi", courier: "ekspedisi", pengiriman: "ekspedisi",
    "pembayaran": "is_paid", bayar: "is_paid", lunas: "is_paid", paid: "is_paid",
};

export function LocalImportExcel({ onImport }: Props) {
    const [modal, setModal] = useState(false);
    const [preview, setPreview] = useState<Partial<PesananRow>[]>([]);
    const [count, setCount] = useState(0);
    const [sheetName, setSheetName] = useState("");
    const [parsedData, setParsedData] = useState<Partial<PesananRow>[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseBool = (v: any) => ["true", "1", "ya", "yes", "✓", "v", "x"].includes(String(v || "").toLowerCase());
    const parseDate = (v: any) => {
        if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
        const m = String(v || "").match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
        if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        return String(v || "");
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb = XLSX.read(ev.target?.result, { type: "array" });
            let bestSheet = wb.SheetNames[0], bestScore = -1, bestRaw: any[] = [], bestMap: any = {};
            
            wb.SheetNames.forEach(name => {
                const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
                if (raw.length === 0) return;
                const hMap: any = {};
                Object.keys(raw[0]).forEach(h => {
                    const mapped = COL_MAP[h.toLowerCase().trim()];
                    if (mapped) hMap[h] = mapped;
                });
                if (Object.keys(hMap).length > bestScore) {
                    bestScore = Object.keys(hMap).length;
                    bestSheet = name; bestRaw = raw; bestMap = hMap;
                }
            });

            if (bestScore === 0) return alert("Header tidak cocok.");

            const parsed = bestRaw.filter(r => Object.values(r).some(v => !!v)).map(r => {
                const row: any = {};
                Object.entries(bestMap).forEach(([h, k]) => {
                    if (["di_produksi", "di_warna", "siap_kirim", "di_kirim", "is_paid"].includes(k as string)) row[k as string] = parseBool(r[h as string]);
                    else if (k === "tanggal") row[k as string] = parseDate(r[h as string]);
                    else row[k as string] = String(r[h as string] ?? "");
                });
                return row;
            });

            setCount(parsed.length);
            setPreview(parsed.slice(0, 5));
            setSheetName(bestSheet);
            setParsedData(parsed);
            setModal(true);
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    return (
        <>
            <button onClick={() => fileInputRef.current?.click()}
                style={{ border: "1px solid #A67B5B", borderRadius: 5, padding: "4px 12px", fontSize: 11, background: "#FEF3E8", color: "#A67B5B", cursor: "pointer", fontWeight: 700 }}>
                📥 Import Excel
            </button>
            <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFile} />

            {modal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "white", borderRadius: 12, padding: 24, width: "min(90vw, 700px)", maxHeight: "80vh", overflow: "auto" }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>Konfirmasi Import ({count} Baris)</div>
                        <p style={{ fontSize: 12, color: "#B89678" }}>Sheet: {sheetName}</p>
                        <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", marginTop: 10 }}>
                            <thead>
                                <tr>
                                    {["Tgl", "Customer", "Deskripsi"].map(h => <th key={h} style={{ border: "1px solid #ddd", padding: 4 }}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{r.tanggal}</td>
                                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{r.customer}</td>
                                        <td style={{ border: "1px solid #ddd", padding: 4 }}>{r.deskripsi}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                            <button onClick={() => setModal(false)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ddd", cursor: "pointer" }}>Batal</button>
                            <button onClick={() => { onImport(parsedData); setModal(false); }} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#A67B5B", color: "white", cursor: "pointer" }}>Import Sekarang</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
