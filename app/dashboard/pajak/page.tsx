"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Building2, Calculator, CheckCircle2, Database, Lock, Save, Search, ShieldCheck, Users } from "lucide-react";
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

type Tab = "ringkasan" | "panduan" | "badan" | "transaksi" | "akuntansi" | "pph21" | "fiskal" | "rekonsiliasi" | "laporan";
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
  const [tab, setTab] = useState<Tab>("ringkasan");
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

  return <div style={{ padding: "20px 24px 36px", color: colors.ink, maxWidth: 1450, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
      <div><h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Akuntansi & Pajak</h1><p style={{ margin: "4px 0 0", color: colors.med, fontSize: 12 }}>Pencatatan, rekonsiliasi, kontrol kepatuhan, dan kertas kerja pajak dari data ERP.</p></div>
      <button disabled={isSaving} onClick={saveDrafts} style={{ display: "flex", alignItems: "center", gap: 7, border: 0, borderRadius: 7, padding: "9px 14px", background: colors.accent, color: "white", fontSize: 12, fontWeight: 700, cursor: isSaving ? "wait" : "pointer", opacity: isSaving ? .7 : 1 }}><Save size={15}/>{saved || (isSaving ? "Menyimpan..." : "Simpan profil")}</button>
    </div>

    <div style={{ display: "flex", gap: 4, padding: 4, background: colors.soft, borderRadius: 9, width: "fit-content", maxWidth:"100%", overflowX:"auto", marginBottom: 16 }}>
      {([['ringkasan','Ringkasan'],['panduan','Panduan & Checklist'],['badan','Profil Badan'],['transaksi','Transaksi Pajak'],['akuntansi','Akuntansi'],['pph21','Payroll & PPh 21'],['fiskal','Fiskal & PPh Badan'],['rekonsiliasi','Ekualisasi & Kepatuhan'],['laporan','Laporan']] as [Tab,string][]).map(([key,label]) => <button key={key} onClick={() => setTab(key)} style={{ border: 0, borderRadius: 6, padding: "8px 13px", background: tab === key ? "white" : "transparent", color: tab === key ? colors.ink : colors.med, boxShadow: tab === key ? "0 1px 3px rgba(92,64,51,.12)" : "none", fontSize: 12, fontWeight: 700, whiteSpace:"nowrap", flexShrink:0, cursor: "pointer" }}>{label}</button>)}
    </div>

    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, border: dbStatus === "connected" ? "1px solid #BBE2C5" : "1px solid #F3D08B", background: dbStatus === "connected" ? "#F0FBF3" : "#FFF9E8", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 11, color: dbStatus === "connected" ? colors.green : "#875F13" }}>{dbStatus === "connected" ? <Database size={16}/> : <AlertTriangle size={16}/>}<span>{dbStatus === "connected" ? "Database pajak terhubung. Profil dan masa pajak dapat disimpan, lalu dikunci setelah diperiksa." : dbStatus === "loading" ? "Memeriksa koneksi database pajak..." : dbStatus === "migration-required" ? "Mode local aktif. Migrasi database pajak belum diterapkan, sehingga data tetap disimpan sebagai draft di browser." : "Database pajak belum dapat diakses. Draft browser tetap dapat digunakan."} Perhitungan tidak otomatis memotong gaji atau mengirim data ke Coretax.</span></div>
    {message ? <div role="status" style={{border:`1px solid ${colors.line}`,background:"white",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:11,display:"flex",justifyContent:"space-between",gap:12}}><span>{message}</span><button onClick={()=>setMessage("")} style={{border:0,background:"transparent",cursor:"pointer",color:colors.med}}>Tutup</button></div> : null}

    {tab === "ringkasan" && <>
      <TaxDashboard year={year} month={month} isPkp={entity.pkp} employeeConfigured={configured} employeeTotal={karyawan.length}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 14 }}>
        {[
          [Building2,"Profil badan",entity.npwp ? "Sudah diisi" : "NPWP belum diisi"],
          [Users,"Profil pajak karyawan",`${configured} dari ${karyawan.length} lengkap`],
          [Calculator,"PPh 21 periode",rupiah(taxTotal)],
          [ShieldCheck,"Status data",periodLocked ? "Masa pajak terkunci" : savedPeriodRows.length ? "Draft database" : dbStatus === "connected" ? "Belum disimpan" : "Draft local"],
        ].map(([Icon,label,value]) => { const I = Icon as typeof Building2; return <div key={String(label)} style={cardStyle}><div style={{ display: "flex", alignItems: "center", gap: 8, color: colors.med, fontSize: 11, fontWeight: 700 }}><I size={16}/>{String(label)}</div><div style={{ marginTop: 10, fontSize: 17, fontWeight: 800 }}>{String(value)}</div></div> })}
      </div>
      <div style={cardStyle}><h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Kesiapan implementasi</h2>{[
        [!!entity.npwp,"Identitas dan NPWP badan"],[configured === karyawan.length && karyawan.length > 0,"NIK dan PTKP seluruh karyawan"],[gaji.length > 0,"Data penggajian tersedia"],[dbStatus === "connected","Migrasi database pajak diterapkan"],[periodLocked,"Masa pajak terverifikasi dan dikunci"],
      ].map(([ok,label]) => <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${colors.soft}`, fontSize: 12 }}><CheckCircle2 size={16} color={ok ? colors.green : "#B8A89B"}/><span style={{ color: ok ? colors.ink : colors.med }}>{String(label)}</span></div>)}</div>
    </>}

    {tab === "panduan" && <><div style={{display:"flex",gap:10,alignItems:"end",marginBottom:12,flexWrap:"wrap"}}><Field label="Tahun"><input type="number" style={{...inputStyle,width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field><Field label="Bulan"><select style={{...inputStyle,width:145}} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2020,i,1).toLocaleDateString("id-ID",{month:"long"})}</option>)}</select></Field></div><TaxWorkflowGuide year={year} month={month}/></>}

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

    {tab === "transaksi" && <>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:12}}><Field label="Tahun"><input type="number" style={{...inputStyle,width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field><Field label="Masa pajak"><select style={{...inputStyle,width:145}} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2020,i,1).toLocaleDateString("id-ID",{month:"long"})}</option>)}</select></Field></div>
      <TaxTransactionLedger year={year} month={month}/>
    </>}

    {tab === "akuntansi" && <>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:12}}><Field label="Tahun"><input type="number" style={{...inputStyle,width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field><Field label="Periode jurnal"><select style={{...inputStyle,width:145}} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2020,i,1).toLocaleDateString("id-ID",{month:"long"})}</option>)}</select></Field></div>
      <AccountingJournal year={year} month={month}/>
    </>}

    {tab === "fiskal" && <>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:12}}><Field label="Tahun pajak"><input type="number" style={{...inputStyle,width:110}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field></div>
      <FiscalCorporateTax year={year} regime={entity.regime}/>
    </>}

    {tab === "rekonsiliasi" && <>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:12,flexWrap:"wrap"}}><Field label="Tahun"><input type="number" style={{...inputStyle,width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field><Field label="Masa pajak"><select style={{...inputStyle,width:145}} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2020,i,1).toLocaleDateString("id-ID",{month:"long"})}</option>)}</select></Field></div>
      <TaxReconciliationCompliance year={year} month={month} isPkp={entity.pkp}/>
    </>}

    {tab === "laporan" && <>
      <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:12}}><Field label="Tahun laporan"><input type="number" style={{...inputStyle,width:110}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field></div>
      <TaxReports year={year} entityName={entity.legalName} npwp={entity.npwp}/>
    </>}

    {tab === "pph21" && <>
      <div style={{ ...cardStyle, padding: 12, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <Field label="Tahun"><input type="number" style={{...inputStyle,width:100}} value={year} onChange={e=>setYear(Number(e.target.value))}/></Field>
        <Field label="Masa pajak"><select style={{...inputStyle,width:145}} value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2020,i,1).toLocaleDateString("id-ID",{month:"long"})}</option>)}</select></Field>
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
