"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type Employee = {
    id: number;
    nama: string;
    jabatan: string;
    divisi: string;
    status: string;
    gaji_pokok: number;
    gaji_harian: number;
    tanggal_join: string;
};

const emptyForm = {
    nama: "", jabatan: "", divisi: "Produksi", status: "Full-time",
    gaji_pokok: "", gaji_harian: "", tanggal_join: "",
};

const rupiah = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;

export default function SidoarjoKaryawanPage() {
    const [rows, setRows] = useState<Employee[]>([]);
    const [form, setForm] = useState({ ...emptyForm });
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("karyawan")
            .select("id,nama,jabatan,divisi,status,gaji_pokok,gaji_harian,tanggal_join")
            .eq("operating_unit", "toto_sidoarjo")
            .order("nama", { ascending: true });
        if (error) setMessage({ ok: false, text: `Gagal memuat data cabang: ${error.message}` });
        else setRows((data ?? []) as Employee[]);
        setLoading(false);
    };

    useEffect(() => { void load(); }, []);

    const visibleRows = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase("id-ID");
        if (!needle) return rows;
        return rows.filter((row) => [row.nama, row.jabatan, row.divisi].join(" ").toLocaleLowerCase("id-ID").includes(needle));
    }, [query, rows]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!form.nama.trim()) {
            setMessage({ ok: false, text: "Nama karyawan wajib diisi." });
            return;
        }
        setSaving(true);
        setMessage(null);
        const { error } = await supabase.from("karyawan").insert({
            nama: form.nama.trim(),
            jabatan: form.jabatan.trim(),
            divisi: form.divisi.trim(),
            status: form.status,
            gaji_pokok: Number(form.gaji_pokok || 0),
            gaji_harian: Number(form.gaji_harian || 0),
            tanggal_join: form.tanggal_join,
            operating_unit: "toto_sidoarjo",
        });
        setSaving(false);
        if (error) {
            setMessage({ ok: false, text: `Gagal menyimpan: ${error.message}` });
            return;
        }
        setForm({ ...emptyForm });
        setMessage({ ok: true, text: "Karyawan Sidoarjo tersimpan." });
        await load();
    };

    return (
        <div className="page-content" style={{ maxWidth: 1180, paddingTop: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#A67B5B", marginBottom: 7 }}>SDM · TOTO SIDOARJO</div>
                    <h1 className="page-title-h1" style={{ marginBottom: 6 }}>Data Karyawan Cabang</h1>
                    <p className="page-subtitle">Data ini khusus Sidoarjo dan tidak muncul pada daftar karyawan Toto Pusat.</p>
                </div>
                <div style={{ padding: "10px 14px", border: "1px solid #E8DCCF", borderRadius: 10, background: "#FFFDF9", color: "#6B4423", fontSize: 13, fontWeight: 800 }}>
                    {rows.length} karyawan cabang
                </div>
            </div>

            <form onSubmit={save} className="card" style={{ marginBottom: 18 }}>
                <div className="card-body">
                    <div style={{ fontWeight: 800, color: "#3C2F2F", marginBottom: 14 }}>Tambah Karyawan Sidoarjo</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                        <Field label="Nama *"><input required value={form.nama} onChange={(e) => setForm((v) => ({ ...v, nama: e.target.value }))} style={inputStyle} /></Field>
                        <Field label="Jabatan"><input value={form.jabatan} onChange={(e) => setForm((v) => ({ ...v, jabatan: e.target.value }))} style={inputStyle} /></Field>
                        <Field label="Divisi"><input value={form.divisi} onChange={(e) => setForm((v) => ({ ...v, divisi: e.target.value }))} style={inputStyle} /></Field>
                        <Field label="Status"><select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))} style={inputStyle}><option>Full-time</option><option>Part-time</option><option>Kontrak</option></select></Field>
                        <Field label="Gaji pokok / bulan"><input inputMode="numeric" value={form.gaji_pokok} onChange={(e) => setForm((v) => ({ ...v, gaji_pokok: e.target.value.replace(/\D/g, "") }))} style={inputStyle} placeholder="0" /></Field>
                        <Field label="Gaji harian"><input inputMode="numeric" value={form.gaji_harian} onChange={(e) => setForm((v) => ({ ...v, gaji_harian: e.target.value.replace(/\D/g, "") }))} style={inputStyle} placeholder="0" /></Field>
                        <Field label="Tanggal bergabung"><input type="date" value={form.tanggal_join} onChange={(e) => setForm((v) => ({ ...v, tanggal_join: e.target.value }))} style={inputStyle} /></Field>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                        <button type="submit" disabled={saving} style={primaryButton}>{saving ? "Menyimpan…" : "+ Tambah Karyawan"}</button>
                        {message && <span style={{ color: message.ok ? "#15803D" : "#B91C1C", fontWeight: 700, fontSize: 13 }}>{message.text}</span>}
                    </div>
                </div>
            </form>

            <section className="card">
                <div className="card-body" style={{ paddingBottom: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                        <strong style={{ color: "#3C2F2F" }}>Daftar Karyawan Sidoarjo</strong>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, jabatan, divisi…" style={{ ...inputStyle, width: 270, maxWidth: "100%" }} />
                    </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead><tr>{["Nama", "Jabatan", "Divisi", "Status", "Gaji pokok", "Gaji harian", "Tgl bergabung"].map((heading) => <th key={heading} style={headStyle}>{heading}</th>)}</tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={7} style={emptyStyle}>Memuat data cabang…</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={7} style={emptyStyle}>Belum ada data karyawan Sidoarjo.</td></tr> : visibleRows.map((row) => <tr key={row.id}>
                                <td style={{ ...cellStyle, fontWeight: 800 }}>{row.nama}</td><td style={cellStyle}>{row.jabatan || "—"}</td><td style={cellStyle}>{row.divisi || "—"}</td><td style={cellStyle}>{row.status || "—"}</td><td style={cellStyle}>{Number(row.gaji_pokok) ? rupiah(Number(row.gaji_pokok)) : "—"}</td><td style={cellStyle}>{Number(row.gaji_harian) ? rupiah(Number(row.gaji_harian)) : "—"}</td><td style={cellStyle}>{row.tanggal_join || "—"}</td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label style={{ display: "flex", flexDirection: "column", gap: 5, color: "#6B574B", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}{children}</label>;
}

const inputStyle: React.CSSProperties = { minHeight: 38, border: "1px solid #D8C1AA", borderRadius: 7, padding: "8px 10px", color: "#3C2F2F", background: "white", fontSize: 13 };
const primaryButton: React.CSSProperties = { minHeight: 38, padding: "0 14px", border: 0, borderRadius: 7, background: "#8B5E3C", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 13 };
const headStyle: React.CSSProperties = { textAlign: "left", padding: "11px 14px", background: "#F4EBDD", borderTop: "1px solid #E8DCCF", borderBottom: "1px solid #E8DCCF", color: "#6B4423", fontSize: 11, whiteSpace: "nowrap" };
const cellStyle: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #F0E7DE", color: "#514036", whiteSpace: "nowrap" };
const emptyStyle: React.CSSProperties = { ...cellStyle, textAlign: "center", color: "#927C6D", padding: "28px 14px" };
