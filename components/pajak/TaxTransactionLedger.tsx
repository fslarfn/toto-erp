"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, Lock, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { isMissingTaxSchema, loadTaxTransactions, saveTaxTransaction, TaxTransactionRow } from "@/lib/pajak/store";

type Props = { year: number; month: number };
type Draft = Pick<TaxTransactionRow, "tax_code" | "tax_direction" | "dpp_amount" | "tax_rate" | "tax_amount" | "counterparty_name" | "document_number" | "notes">;
const ink="#3C2F2F", med="#7C685B", line="#E6D5BE", soft="#F6EEE6", accent="#A67B5B";
const inp:React.CSSProperties={border:`1px solid ${line}`,borderRadius:6,padding:"6px 8px",fontSize:11,color:ink,background:"white",width:"100%"};
const TAX_CODES: Array<[TaxTransactionRow["tax_code"],string]> = [["non_tax","Non Pajak"],["ppn","PPN"],["pph23","PPh 23"],["pph21","PPh 21"],["pph_final","PPh Final"],["other","Lainnya"]];
const DIRECTIONS: Array<[TaxTransactionRow["tax_direction"],string]> = [["none","Tidak ada"],["output","PPN Keluaran"],["input","PPN Masukan"],["withheld_by_us","Dipotong CV Toto"],["withheld_from_us","Dipotong pihak lain"],["borne_by_company","Ditanggung perusahaan"]];

function rp(v:number){return `Rp ${Math.round(v).toLocaleString("id-ID")}`;}
function defaultDraft(amount:number):Draft{return {tax_code:"non_tax",tax_direction:"none",dpp_amount:amount,tax_rate:0,tax_amount:0,counterparty_name:"",document_number:"",notes:""};}

export default function TaxTransactionLedger({year,month}:Props){
  const {cashFlow,loading}=useStore();
  const {user}=useAuth();
  const period=`${year}-${String(month).padStart(2,"0")}`;
  const [saved,setSaved]=useState<TaxTransactionRow[]>([]);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [query,setQuery]=useState("");
  const [view,setView]=useState<"all"|"pending"|"reviewed">("pending");
  const [schemaReady,setSchemaReady]=useState(true);
  const [message,setMessage]=useState("");
  const [isPending,startTransition]=useTransition();

  useEffect(()=>{let cancelled=false;loadTaxTransactions(period).then(rows=>{if(!cancelled){setSaved(rows);setSchemaReady(true);}}).catch(e=>{if(!cancelled){setSchemaReady(false);setMessage(isMissingTaxSchema(e)?"Jalankan migrasi ledger transaksi pajak terlebih dahulu.":"Gagal memuat ledger pajak.");}});return()=>{cancelled=true};},[period]);

  const reviewedBySource=useMemo(()=>new Map(saved.filter(r=>r.source_id).map(r=>[r.source_id!,r])),[saved]);
  const rows=useMemo(()=>cashFlow.filter(cf=>!cf.isTest&&!cf.transferGroup&&cf.date.startsWith(period)).map(cf=>({cf,reviewed:reviewedBySource.get(cf.id)})).filter(({cf,reviewed})=>{
    const match=`${cf.description} ${cf.category}`.toLowerCase().includes(query.toLowerCase());
    return match&&(view==="all"||(view==="pending"&&!reviewed)||(view==="reviewed"&&!!reviewed));
  }),[cashFlow,period,query,view,reviewedBySource]);

  const draftOf=(id:string,amount:number,reviewed?:TaxTransactionRow):Draft=>drafts[id]??(reviewed?{tax_code:reviewed.tax_code,tax_direction:reviewed.tax_direction,dpp_amount:reviewed.dpp_amount,tax_rate:reviewed.tax_rate,tax_amount:reviewed.tax_amount,counterparty_name:reviewed.counterparty_name,document_number:reviewed.document_number,notes:reviewed.notes}:defaultDraft(amount));
  const setDraft=(id:string,amount:number,reviewed:TaxTransactionRow|undefined,patch:Partial<Draft>)=>setDrafts(current=>({...current,[id]:{...draftOf(id,amount,reviewed),...patch}}));
  const setRate=(id:string,amount:number,reviewed:TaxTransactionRow|undefined,rate:number)=>setDraft(id,amount,reviewed,{tax_rate:rate,tax_amount:Math.round(draftOf(id,amount,reviewed).dpp_amount*rate)});

  const saveRow=(cf:typeof cashFlow[number],reviewed:TaxTransactionRow|undefined,lock:boolean)=>startTransition(async()=>{
    if(!schemaReady){setMessage("Migrasi ledger transaksi belum dijalankan.");return;}
    if(reviewed?.status==="locked")return;
    if(lock&&!window.confirm("Kunci transaksi pajak ini? Setelah dikunci transaksi tidak dapat diubah."))return;
    const d=draftOf(cf.id,cf.amount,reviewed);
    try{
      const result=await saveTaxTransaction({id:reviewed?.id,workspace:"toto",source_type:"cash_flow",source_id:cf.id,transaction_date:cf.date,tax_period:period,flow_type:cf.type,category:cf.category,description:cf.description,counterparty_name:d.counterparty_name,document_number:d.document_number,tax_code:d.tax_code,tax_direction:d.tax_direction,gross_amount:cf.amount,dpp_amount:d.dpp_amount,tax_rate:d.tax_rate,tax_amount:d.tax_amount,status:lock?"locked":"reviewed",notes:d.notes,reviewed_by:user?.username??"",reviewed_at:new Date().toISOString(),locked_by:lock?user?.username??"":null,locked_at:lock?new Date().toISOString():null});
      setSaved(current=>[...current.filter(r=>r.source_id!==cf.id),result]);setMessage(lock?"Transaksi berhasil dikunci.":"Review transaksi tersimpan.");
    }catch(e){setMessage(`Gagal menyimpan: ${(e as {message?:string}).message??"kesalahan database"}`);}
  });

  const pendingCount=cashFlow.filter(cf=>!cf.isTest&&!cf.transferGroup&&cf.date.startsWith(period)&&!reviewedBySource.has(cf.id)).length;
  return <>
    <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap",padding:12,background:"white",border:`1px solid ${line}`,borderRadius:10,marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:700,color:med}}>Cari transaksi<div style={{position:"relative",marginTop:5}}><Search size={14} style={{position:"absolute",left:8,top:8,color:med}}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Keterangan atau kategori" style={{...inp,width:240,paddingLeft:28}}/></div></label>
      <div style={{display:"flex",gap:4,background:soft,padding:3,borderRadius:7}}>{([['pending',`Perlu review (${pendingCount})`],['reviewed','Sudah review'],['all','Semua']] as const).map(([key,label])=><button key={key} onClick={()=>setView(key)} style={{border:0,borderRadius:5,padding:"7px 10px",fontSize:11,fontWeight:700,background:view===key?"white":"transparent",color:view===key?ink:med,cursor:"pointer"}}>{label}</button>)}</div>
      <div style={{marginLeft:"auto",fontSize:11,color:med}}>Sumber: Keuangan · Masa {period}</div>
    </div>
    {message?<div role="status" style={{padding:"9px 11px",marginBottom:10,border:"1px solid #F3D08B",background:"#FFF9E8",borderRadius:8,fontSize:11,color:"#875F13",display:"flex",gap:8}}><AlertTriangle size={15}/><span>{message}</span></div>:null}
    <div style={{background:"white",border:`1px solid ${line}`,borderRadius:10,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1320,fontSize:11}}><thead><tr style={{background:"#EDE0D4",color:"#5C4033"}}>{["Tanggal / Transaksi","Arus / Nilai","Jenis Pajak","Perlakuan","Lawan Transaksi","No. Dokumen","DPP","Tarif","Pajak","Status / Aksi"].map(h=><th key={h} style={{padding:"9px 8px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>
      {loading?<tr><td colSpan={10} style={{padding:24,textAlign:"center",color:med}}>Memuat transaksi keuangan...</td></tr>:rows.length===0?<tr><td colSpan={10} style={{padding:24,textAlign:"center",color:med}}>Tidak ada transaksi pada filter ini.</td></tr>:rows.map(({cf,reviewed})=>{const d=draftOf(cf.id,cf.amount,reviewed),locked=reviewed?.status==="locked";return <tr key={cf.id} style={{borderBottom:`1px solid ${soft}`,opacity:locked ? .78 : 1}}>
        <td style={{padding:8,maxWidth:230}}><b>{cf.date}</b><div style={{marginTop:3}}>{cf.description||"Tanpa keterangan"}</div><div style={{fontSize:10,color:med}}>{cf.category}</div></td>
        <td style={{padding:8}}><span style={{fontSize:10,fontWeight:700,color:cf.type==="income"?"#15803D":"#B91C1C"}}>{cf.type==="income"?"MASUK":"KELUAR"}</span><div style={{fontWeight:800,marginTop:3}}>{rp(cf.amount)}</div></td>
        <td style={{padding:6}}><select disabled={locked} style={{...inp,minWidth:100}} value={d.tax_code} onChange={e=>setDraft(cf.id,cf.amount,reviewed,{tax_code:e.target.value as Draft['tax_code']})}>{TAX_CODES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
        <td style={{padding:6}}><select disabled={locked} style={{...inp,minWidth:135}} value={d.tax_direction} onChange={e=>setDraft(cf.id,cf.amount,reviewed,{tax_direction:e.target.value as Draft['tax_direction']})}>{DIRECTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>
        <td style={{padding:6}}><input disabled={locked} style={{...inp,minWidth:120}} value={d.counterparty_name} onChange={e=>setDraft(cf.id,cf.amount,reviewed,{counterparty_name:e.target.value})} placeholder="Nama pihak"/></td>
        <td style={{padding:6}}><input disabled={locked} style={{...inp,minWidth:105}} value={d.document_number} onChange={e=>setDraft(cf.id,cf.amount,reviewed,{document_number:e.target.value})} placeholder="Faktur/bupot"/></td>
        <td style={{padding:6}}><input disabled={locked} type="number" style={{...inp,width:110,textAlign:"right"}} value={d.dpp_amount} onChange={e=>{const val=Number(e.target.value);setDraft(cf.id,cf.amount,reviewed,{dpp_amount:val,tax_amount:Math.round(val*d.tax_rate)})}}/></td>
        <td style={{padding:6}}><input disabled={locked} type="number" step="0.0025" style={{...inp,width:72,textAlign:"right"}} value={d.tax_rate} onChange={e=>setRate(cf.id,cf.amount,reviewed,Number(e.target.value))}/><div style={{fontSize:9,color:med,textAlign:"right"}}>desimal</div></td>
        <td style={{padding:6}}><input disabled={locked} type="number" style={{...inp,width:105,textAlign:"right"}} value={d.tax_amount} onChange={e=>setDraft(cf.id,cf.amount,reviewed,{tax_amount:Number(e.target.value)})}/></td>
        <td style={{padding:7}}>{locked?<span style={{display:"flex",alignItems:"center",gap:5,color:"#15803D",fontWeight:700}}><Lock size={13}/>Terkunci</span>:<div style={{display:"flex",gap:5}}><button disabled={isPending} onClick={()=>saveRow(cf,reviewed,false)} title="Simpan review" style={{border:`1px solid ${line}`,background:"white",borderRadius:6,padding:6,cursor:"pointer",color:ink}}><Check size={14}/></button><button disabled={isPending} onClick={()=>saveRow(cf,reviewed,true)} title="Simpan dan kunci" style={{border:0,background:accent,color:"white",borderRadius:6,padding:6,cursor:"pointer"}}><Lock size={14}/></button></div>}</td>
      </tr>})}
    </tbody></table></div>
    <div style={{fontSize:10,color:med,marginTop:8}}>Tarif diisi sebagai desimal, misalnya 0,11 untuk 11% atau 0,02 untuk 2%. Nilai pajak dapat disesuaikan sebelum transaksi dikunci.</div>
  </>;
}
