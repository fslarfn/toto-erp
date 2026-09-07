"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, BookOpenCheck, Calculator, ClipboardCheck, Database, FileText, Landmark, Lock, Save, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useKaryawan } from "@/lib/karyawan-store";
import { decemberTrueUp, monthlyTerTax, PtkpStatus, terCategory, terRate } from "@/lib/pajak/pph21";
import { isMissingTaxSchema, loadTaxWorkspace, PayrollTaxPeriodRow, saveEmployeeTaxProfiles, savePayrollTaxPeriods, saveTaxEntity } from "@/lib/pajak/store";
import TaxTransactionLedger from "@/components/pajak/TaxTransactionLedger";
import AccountingJournal from "@/components/pajak/AccountingJournal";
import FiscalCorporateTax from "@/components/pajak/FiscalCorporateTax";
import TaxDashboard from "@/components/pajak/TaxDashboard";
import TaxReconciliationCompliance from "@/components/pajak/TaxReconciliationCompliance";
import TaxReports from "@/components/pajak/TaxReports";
import TaxWorkflowGuide from "@/components/pajak/TaxWorkflowGuide";
import AccountingAdminWorkspace from "@/components/pajak/AccountingAdminWorkspace";
import AccountingPeriodClose from "@/components/pajak/AccountingPeriodClose";

type Tab = "kerja" | "panduan" | "badan" | "transaksi" | "akuntansi" | "penyesuaian" | "pph21" | "fiskal" | "rekonsiliasi" | "laporan";
type MainSection = "kerja" | "pembukuan" | "tutup" | "pajak" | "laporan";
type EntityDraft = { legalName: string; npwp: string; nitku: string; address: string; businessType: string; pkp: boolean; regime: string };
type Profiles = Record<number, { nik: string; npwp: string; ptkp: PtkpStatus; method: "gross" | "gross_up" | "net" }>;
type DbStatus = "loading" | "connected" | "migration-required" | "error";

const ENTITY_KEY = "toto-tax-entity-draft-v1";
const PROFILE_KEY = "toto-employee-tax-profile-draft-v1";
const PTKP: PtkpStatus[] = ["TK/0","TK/1","TK/2","TK/3","K/0","K/1","K/2","K/3"];
const initialEntity: EntityDraft = { legalName: "CV Toto Aluminium Manufacture", npwp: "", nitku: "", address: "Mustika Jaya, Bekasi Timur, Bekasi, Jawa Barat", businessType: "Manufaktur aluminium", pkp: false, regime: "general" };

const colors = { ink: "#3C2F2F", med: "#7C685B", line: "#E6D5BE", paper: "#FFFBF7", accent: "#A67B5B", soft: "#F6EEE6", green: "#15803D" };
const inputStyle: React.CSSProperties = { width: "100%", border: `1px solid ${colors.line}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, color: colors.ink, background: "white", outline: "none" };
const cardStyle: React.CSSProperties = { background: "white", border: `1px solid ${colors.line}`, borderRadius: 10, padding: 16 };

const sectionForTab: Record<Tab, MainSection> = {
  kerja: "kerja", akuntansi: "pembukuan", transaksi: "pembukuan", panduan: "tutup", penyesuaian:"tutup",
  rekonsiliasi: "tutup", badan: "pajak", pph21: "pajak", fiskal: "pajak", laporan: "laporan",
};
const mainSections: Array<{ key: MainSection; label: string; icon: typeof BookOpenCheck; initial: Tab }> = [
  { key: "kerja", label: "Pekerjaan Saya", icon: BookOpenCheck, initial: "kerja" },
  { key: "pembukuan", label: "Pembukuan", icon: Landmark, initial: "akuntansi" },
  { key: "tutup", label: "Tutup Buku", icon: ClipboardCheck, initial: "panduan" },
  { key: "pajak", label: "Pajak", icon: Calculator, initial: "badan" },
  { key: "laporan", label: "Laporan", icon: FileText, initial: "laporan" },
];
const subSections: Partial<Record<MainSection, Array<[Tab, string]>>> = {
  pembukuan: [["akuntansi", "Jurnal dari Keuangan"], ["transaksi", "Review Pajak Transaksi"]],
  tutup: [["panduan", "Checklist Tutup Buku"], ["penyesuaian", "Penyesuaian & Kunci"], ["rekonsiliasi", "Rekonsiliasi & Kepatuhan"]],
  pajak: [["badan", "Profil Badan"], ["pph21", "Payroll & PPh 21"], ["fiskal", "Fiskal & PPh Badan"]],
};

function rupiah(value: number) { return `Rp ${Math.round(value).toLocaleString("id-ID")}`; }
function monthKey(date: string) { const m = date?.match(/^(\d{4})-(\d{2})/); return m ? `${m[1]}-${m[2]}` : ""; }
function periodDate(row: { tanggal_gajian?: string; periode_selesai?: string; periode: string }) {
  if (row.tanggal_gajian) return row.tanggal_gajian;
  if (row.periode_selesai) return row.periode_selesai;
  const range = row.periode.match(/~(\d{4}-\d{2}-\d{2})$/);
  return range?.[1] ?? (row.periode.match(/^\d{4}-\d{2}/)?.[0] ? `${row.periode.slice(0,7)}-01` : "");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 700, color: colors.med }}><span>{label}</span>{children}</label>;
}

export default function PajakPage() {
  const { user, hasAccess } = useAuth();
  const { karyawan, gaji, loading } = useKaryawan();
  const [tab, setTab] = useState<Tab>("kerja");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState<EntityDraft>(initialEntity);
  const [profiles, setProfiles] = useState<Profiles>({});
  const [periods, setPeriods] = useState<PayrollTaxPeriodRow[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>("loading");
  const [saved, setSaved] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    try {
      const e = localStorage.getItem(ENTITY_KEY);
      const p = localStorage.getItem(PROFILE_KEY);
      queueMicrotask(() => {
        if (e) setEntity(JSON.parse(e));
        if (p) setProfiles(JSON.parse(p));
      });
    } catch { /* draft rusak diabaikan */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTaxWorkspace(year).then(data => {
      if (cancelled) return;
      if (data.entity) setEntity({ legalName: data.entity.legal_name, npwp: data.entity.npwp, nitku: data.entity.nitku, address: data.entity.address, businessType: data.entity.business_type, pkp: data.entity.pkp_status, regime: data.entity.tax_regime });
      if (data.profiles.length) {
        const next: Profiles = {};
        for (const row of data.profiles) next[row.karyawan_id] = { nik: row.nik, npwp: row.npwp, ptkp: row.ptkp_status, method: row.tax_method };
        setProfiles(next);
      }
      setPeriods(data.periods);
      setDbStatus("connected");
    }).catch(error => {
      if (!cancelled) setDbStatus(isMissingTaxSchema(error) ? "migration-required" : "error");
    });
    return () => { cancelled = true; };
  }, [year]);

  const saveLocalDrafts = () => {
    localStorage.setItem(ENTITY_KEY, JSON.stringify(entity));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  };

  const saveDrafts = () => startSaving(async () => {
    saveLocalDrafts();
    if (dbStatus !== "connected") {
      setSaved("Draft tersimpan di browser");
      window.setTimeout(() => setSaved(""), 2500);
      return;
    }
    try {
      await Promise.all([
        saveTaxEntity({ workspace:"toto", legal_name:entity.legalName, npwp:entity.npwp, nitku:entity.nitku, legal_form:"CV", business_type:entity.businessType, address:entity.address, pkp_status:entity.pkp, tax_regime:entity.regime }),
        saveEmployeeTaxProfiles(Object.entries(profiles).map(([id,p]) => ({ karyawan_id:Number(id), nik:p.nik, npwp:p.npwp, ptkp_status:p.ptkp, tax_method:p.method, effective_from:`${year}-01-01`, is_active:true }))),
      ]);
      setSaved("Draft tersimpan ke database");
    } catch (error) { setMessage(`Gagal menyimpan: ${(error as {message?:string}).message ?? "kesalahan database"}`); }
    window.setTimeout(() => setSaved(""), 2500);
  });

  const rows = useMemo(() => karyawan.filter(k => k.status !== "Freelance").map(k => {
    const profile = profiles[k.id] ?? { nik: "", npwp: "", ptkp: "TK/0" as PtkpStatus, method: "gross" as const };
    const monthly = gaji.filter(row => row.karyawan_id === k.id && monthKey(periodDate(row)) === `${year}-${String(month).padStart(2,"0")}`);
    const gross = monthly.reduce((sum, row) => sum + row.gaji_pokok + row.lembur + row.tunjangan, 0);
    const employeeBpjs = monthly.reduce((sum, row) => sum + (row.bpjs_tk ?? 0) + (row.bpjs_kes ?? 0), 0);
    const rate = terRate(gross, profile.ptkp);
    const annualSlips = gaji.filter(row => row.karyawan_id === k.id && monthKey(periodDate(row)).startsWith(`${year}-`));
    const annualGross = annualSlips.reduce((sum,row) => sum + row.gaji_pokok + row.lembur + row.tunjangan, 0);
    const annualBpjs = annualSlips.reduce((sum,row) => sum + (row.bpjs_tk ?? 0) + (row.bpjs_kes ?? 0), 0);
    const priorWithholding = periods.filter(p => p.karyawan_id === k.id && p.tax_year === year && p.tax_month < 12).reduce((sum,p) => sum + p.tax_withheld, 0);
    const trueUp = decemberTrueUp({ annualGross, employeeBpjs:annualBpjs, priorWithholding, ptkp:profile.ptkp });
    return { k, profile, slips: monthly.length, gross, employeeBpjs, rate, priorWithholding, annualGross, annualBpjs, annualTax:trueUp.annualTax, tax: month === 12 ? trueUp.decemberTax : monthlyTerTax(gross, profile.ptkp) };
  }).filter(row => row.k.nama.toLowerCase().includes(query.toLowerCase())), [karyawan, gaji, profiles, periods, year, month, query]);

  const configured = karyawan.filter(k => profiles[k.id]?.nik && profiles[k.id]?.ptkp).length;
  const grossTotal = rows.reduce((s, r) => s + r.gross, 0);
  const taxTotal = rows.reduce((s, r) => s + r.tax, 0);
  const savedPeriodRows = periods.filter(p => p.tax_year === year && p.tax_month === month);
  const periodLocked = savedPeriodRows.length > 0 && savedPeriodRows.every(p => p.status === "locked");
  const priorMonthsComplete = month !== 12 || Array.from({length:11},(_,i)=>i+1).every(m => periods.some(p => p.tax_year === year && p.tax_month === m && p.status === "locked"));
  const allowed = user?.role === "owner" || hasAccess("pajak");
  const activeSection = sectionForTab[tab];

  const persistPeriod = (lock: boolean) => startSaving(async () => {
    if (dbStatus !== "connected") { setMessage("Jalankan migrasi database pajak terlebih dahulu."); return; }
    if (lock && !window.confirm(`Kunci masa pajak ${String(month).padStart(2,"0")}/${year}? Data yang dikunci menjadi acuan masa berikutnya.`)) return;
    if (lock && month === 12 && !priorMonthsComplete) { setMessage("Januari sampai November harus dikunci terlebih dahulu sebelum Desember."); return; }
    const incomplete = rows.filter(r => !r.profile.nik);
    if (incomplete.length) { setMessage(`Lengkapi NIK ${incomplete.length} karyawan sebelum menyimpan masa pajak.`); return; }
    try {
      const result = await savePayrollTaxPeriods(rows.map(r => ({
        karyawan_id:r.k.id, tax_year:year, tax_month:month, ptkp_status:r.profile.ptkp,
        ter_category:terCategory(r.profile.ptkp), gross_income:r.gross, employee_bpjs:r.employeeBpjs,
        ter_rate:month === 12 ? 0 : r.rate, tax_withheld:r.tax, annual_tax:month === 12 ? r.annualTax : null,
        prior_withholding:month === 12 ? r.priorWithholding : 0, status:lock ? "locked" : "draft",
        calculation_snapshot:{ slip_count:r.slips, annual_gross:r.annualGross, annual_employee_bpjs:r.annualBpjs, method:r.profile.method },
        locked_at:lock ? new Date().toISOString() : null, locked_by:lock ? user?.username ?? "" : null,
      })));
      setPeriods(current => [...current.filter(p => !(p.tax_year === year && p.tax_month === month)), ...result]);
      setMessage(lock ? "Masa pajak berhasil dikunci." : "Draft masa pajak berhasil disimpan.");
    } catch (error) { setMessage(`Gagal menyimpan masa: ${(error as {message?:string}).message ?? "kesalahan database"}`); }
  });

  if (!allowed) return <div style={{ padding: 24 }}><div style={cardStyle}>Anda tidak memiliki akses ke modul pajak.</div></div>;

  return <div className="page-content" style={{ color: colors.ink, width: "100%", maxWidth: "none", margin: 0, boxSizing: "border-box" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
      <div><h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Akuntansi & Pajak</h1><p style={{ margin: "4px 0 0", color: colors.med, fontSize: 12 }}>Ruang kerja admin untuk pembukuan, tutup buku, pajak, dan laporan perusahaan.</p></div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <Field label="Tahun"><input aria-label="Tahun kerja" type="number" style={{ ...inputStyle, width: 92 }} value={year} onChange={e => setYear(Number(e.target.value))}/></Field>
        <Field label="Periode"><select aria-label="Periode kerja" style={{ ...inputStyle, width: 132 }} value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2020, i, 1).toLocaleDateString("id-ID", { month: "long" })}</option>)}</select></Field>
        {activeSection === "pajak" ? <button disabled={isSaving} onClick={saveDrafts} style={{ display: "flex", alignItems: "center", gap: 7, border: 0, borderRadius: 7, padding: "9px 14px", background: colors.accent, color: "white", fontSize: 12, fontWeight: 700, cursor: isSaving ? "wait" : "pointer", opacity: isSaving ? .7 : 1 }}><Save size={15}/>{saved || (isSaving ? "Menyimpan..." : "Simpan profil")}</button> : null}
      </div>
    </div>

    <nav aria-label="Menu utama akuntansi" style={{ display: "flex", gap: 5, padding: 5, background: colors.soft, borderRadius: 10, maxWidth: "100%", overflowX: "auto", marginBottom: 8 }}>
      {mainSections.map(({ key, label, icon: Icon, initial }) => <button key={key} type="button" onClick={() => setTab(initial)} style={{ border: 0, borderRadius: 7, padding: "9px 12px", background: activeSection === key ? "white" : "transparent", color: activeSection === key ? colors.ink : colors.med, boxShadow: activeSection === key ? "0 1px 3px rgba(92,64,51,.12)" : "none", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><Icon size={14}/>{label}</button>)}
    </nav>

    {subSections[activeSection] ? (
      <nav aria-label="Submenu akuntansi" style={{ display: "flex", gap: 4, maxWidth: "100%", overflowX: "auto", marginBottom: 14, paddingLeft: 5 }}>
        {subSections[activeSection]?.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} style={{ border: 0, borderBottom: tab === key ? `2px solid ${colors.accent}` : "2px solid transparent", padding: "7px 9px", background: "transparent", color: tab === key ? colors.ink : colors.med, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{label}</button>)}
      </nav>
    ) : (
      <div style={{ height: 6 }}/>
    )}

    {(dbStatus !== "connected" || tab === "kerja") ? <div style={{ display: "flex", alignItems: "flex-start", gap: 8, border: dbStatus === "connected" ? "1px solid #BBE2C5" : "1px solid #F3D08B", background: dbStatus === "connected" ? "#F0FBF3" : "#FFF9E8", borderRadius: 8, padding: "9px 11px", marginBottom: 12, fontSize: 10, color: dbStatus === "connected" ? colors.green : "#875F13" }}>{dbStatus === "connected" ? <Database size={15}/> : <AlertTriangle size={15}/>}<span>{dbStatus === "connected" ? "Database terhubung. Data pekerjaan dan profil dapat digunakan bersama oleh admin finance dan owner." : dbStatus === "loading" ? "Memeriksa koneksi database..." : dbStatus === "migration-required" ? "Mode lokal aktif. Data baru disimpan sebagai draft di browser sampai migrasi workspace dijalankan." : "Database belum dapat diakses. Draft browser tetap dapat digunakan."} Sistem tidak mengirim atau melaporkan data otomatis ke Coretax.</span></div> : null}
    {message ? <div role="status" style={{border:`1px solid ${colors.line}`,background:"white",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:11,display:"flex",justifyContent:"space-between",gap:12}}><span>{message}</span><button onClick={()=>setMessage("")} style={{border:0,background:"transparent",cursor:"pointer",color:colors.med}}>Tutup</button></div> : null}

    {tab === "kerja" && <>
      <TaxDashboard year={year} month={month} isPkp={entity.pkp} employeeConfigured={configured} employeeTotal={karyawan.length}/>
      <AccountingAdminWorkspace year={year} month={month} onOpen={view => setTab(view)}/>
    </>}

    {tab === "panduan" ? <TaxWorkflowGuide year={year} month={month}/> : null}

    {tab === "badan" && <div style={cardStyle}>
      <div style={{ marginBottom: 14 }}><h2 style={{ fontSize: 14, margin: 0 }}>Profil wajib pajak badan</h2><p style={{ fontSize: 11, color: colors.med, margin: "4px 0 0" }}>Isi sesuai dokumen resmi CV Toto. Nilai contoh spreadsheet tidak digunakan.</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 13 }}>
        <Field label="Nama badan"><input style={inputStyle} value={entity.legalName} onChange={e=>setEntity({...entity,legalName:e.target.value})}/></Field>
        <Field label="NPWP"><input style={inputStyle} value={entity.npwp} onChange={e=>setEntity({...entity,npwp:e.target.value})} placeholder="Masukkan NPWP"/></Field>
        <Field label="NITKU"><input style={inputStyle} value={entity.nitku} onChange={e=>setEntity({...entity,nitku:e.target.value})} placeholder="Masukkan NITKU"/></Field>
        <Field label="Jenis usaha"><input style={inputStyle} value={entity.businessType} onChange={e=>setEntity({...entity,businessType:e.target.value})}/></Field>
        <Field label="Rezim pajak"><select style={inputStyle} value={entity.regime} onChange={e=>setEntity({...entity,regime:e.target.value})}><option value="general">PPh Badan umum</option><option value="final_transition">PPh Final UMKM masa transisi</option></select></Field>
        <Field label="Status PKP"><select style={inputStyle} value={entity.pkp ? "yes":"no"} onChange={e=>setEntity({...entity,pkp:e.target.value==="yes"})}><option value="no">Belum PKP</option><option value="yes">PKP</option></select></Field>
        <div style={{ gridColumn: "1 / -1" }}><Field label="Alamat"><textarea style={{...inputStyle,minHeight:70,resize:"vertical"}} value={entity.address} onChange={e=>setEntity({...entity,address:e.target.value})}/></Field></div>
      </div>
    </div>}

    {tab === "transaksi" ? <TaxTransactionLedger year={year} month={month}/> : null}

    {tab === "akuntansi" ? <AccountingJournal year={year} month={month}/> : null}

    {tab === "penyesuaian" ? <AccountingPeriodClose year={year} month={month}/> : null}

    {tab === "fiskal" ? <FiscalCorporateTax year={year} regime={entity.regime}/> : null}

    {tab === "rekonsiliasi" ? <TaxReconciliationCompliance year={year} month={month} isPkp={entity.pkp}/> : null}

    {tab === "laporan" ? <TaxReports year={year} month={month} entityName={entity.legalName} npwp={entity.npwp}/> : null}

    {tab === "pph21" && <>
      <div style={{ ...cardStyle, padding: 12, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <Field label="Cari karyawan"><div style={{ position:"relative" }}><Search size={14} style={{position:"absolute",left:9,top:9,color:colors.med}}/><input style={{...inputStyle,paddingLeft:30,width:220}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nama karyawan"/></div></Field>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}><span style={{fontSize:11,color:colors.med}}>Bruto {rupiah(grossTotal)} · PPh 21 {rupiah(taxTotal)}</span><button disabled={isSaving || periodLocked} onClick={()=>persistPeriod(false)} style={{border:`1px solid ${colors.line}`,background:"white",borderRadius:7,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:periodLocked?"not-allowed":"pointer",color:colors.ink}}>Simpan draft masa</button><button disabled={isSaving || periodLocked} onClick={()=>persistPeriod(true)} style={{border:0,background:periodLocked?"#D7C9BC":colors.accent,color:"white",borderRadius:7,padding:"8px 11px",fontSize:11,fontWeight:700,cursor:periodLocked?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:5}}><Lock size={13}/>{periodLocked?"Sudah dikunci":"Kunci masa"}</button></div>
      </div>
      <div style={{ ...cardStyle, padding: 0, overflow: "auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:980, fontSize:11 }}><thead><tr style={{background:"#EDE0D4",color:"#5C4033"}}>{["Karyawan","NIK","NPWP","PTKP / TER","Metode","Slip","Bruto","Tarif","PPh 21"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:h==="Bruto"||h==="Tarif"||h==="PPh 21"?"right":"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={9} style={{padding:24,textAlign:"center",color:colors.med}}>Memuat data penggajian...</td></tr> : rows.length===0 ? <tr><td colSpan={9} style={{padding:24,textAlign:"center",color:colors.med}}>Belum ada karyawan atau slip pada filter ini.</td></tr> : rows.map(({k,profile,slips,gross,rate,tax})=><tr key={k.id} style={{borderBottom:`1px solid ${colors.soft}`}}>
            <td style={{padding:"8px 10px",fontWeight:700}}>{k.nama}<div style={{fontSize:10,color:colors.med,fontWeight:400}}>{k.jabatan}</div></td>
            <td style={{padding:7}}><input style={{...inputStyle,minWidth:135}} value={profile.nik} onChange={e=>setProfiles({...profiles,[k.id]:{...profile,nik:e.target.value}})} placeholder="NIK"/></td>
            <td style={{padding:7}}><input style={{...inputStyle,minWidth:125}} value={profile.npwp} onChange={e=>setProfiles({...profiles,[k.id]:{...profile,npwp:e.target.value}})} placeholder="Opsional"/></td>
            <td style={{padding:7}}><select style={{...inputStyle,minWidth:95}} value={profile.ptkp} onChange={e=>setProfiles({...profiles,[k.id]:{...profile,ptkp:e.target.value as PtkpStatus}})}>{PTKP.map(v=><option key={v}>{v}</option>)}</select><div style={{fontSize:10,color:colors.med,marginTop:3}}>Kategori {terCategory(profile.ptkp)}</div></td>
            <td style={{padding:7}}><select style={{...inputStyle,minWidth:90}} value={profile.method} onChange={e=>setProfiles({...profiles,[k.id]:{...profile,method:e.target.value as typeof profile.method}})}><option value="gross">Gross</option><option value="gross_up">Gross-up</option><option value="net">Net</option></select></td>
            <td style={{padding:"8px 10px",textAlign:"center"}}>{slips}</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{rupiah(gross)}</td><td style={{padding:"8px 10px",textAlign:"right"}}>{month===12?"Tahunan":`${(rate*100).toLocaleString("id-ID",{maximumFractionDigits:2})}%`}</td><td style={{padding:"8px 10px",textAlign:"right",fontWeight:800,color:tax < 0 ? "#B91C1C" : colors.green}}>{rupiah(tax)}</td>
          </tr>)}</tbody></table>
      </div>
      {month===12 && <div style={{marginTop:10,fontSize:11,color:priorMonthsComplete?colors.green:"#875F13",background:priorMonthsComplete?"#F0FBF3":"#FFF9E8",border:priorMonthsComplete?"1px solid #BBE2C5":"1px solid #F3D08B",borderRadius:8,padding:10}}>Desember dihitung dengan tarif progresif tahunan atas penghasilan kumulatif, kemudian dikurangi pemotongan aktual dari masa yang tersimpan. {priorMonthsComplete ? "Seluruh masa Januari sampai November sudah terkunci." : "Kunci Januari sampai November terlebih dahulu agar Desember dapat dikunci."}</div>}
    </>}
  </div>;
}
