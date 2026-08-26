"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Link2, RefreshCw, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { HppProductRow, loadProductHpp, loadSalesHppRecognitions, mapAndProcessSalesHpp, SalesHppRecognitionRow, syncExistingShippedHpp } from "@/lib/hpp/store";
import { isMissingTaxSchema } from "@/lib/pajak/store";

const accent="#B18361",ink="#2A211C",med="#7B6658",line="#E8D4C3",soft="#F7EFE8",green="#15803D";
const rp=(value:number)=>`Rp ${Math.round(value||0).toLocaleString("id-ID")}`;

export default function HppSalesRecognition(){
  const {user}=useAuth();
  const [rows,setRows]=useState<SalesHppRecognitionRow[]>([]);
  const [products,setProducts]=useState<HppProductRow[]>([]);
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [message,setMessage]=useState("");
  const [schemaReady,setSchemaReady]=useState(true);
  const [pending,startTransition]=useTransition();

  const reload=useCallback(async()=>{
    try{
      const [recognitions,catalog]=await Promise.all([loadSalesHppRecognitions(),loadProductHpp()]);
      setRows(recognitions);setProducts(catalog);setSchemaReady(true);
    }catch(error){
      if(isMissingTaxSchema(error)){setSchemaReady(false);setMessage("Jalankan migrasi 20260826_shipped_hpp_recognition.sql untuk mengaktifkan HPP saat dikirim.");}
      else setMessage(error instanceof Error?error.message:"Gagal memuat pengakuan HPP penjualan.");
    }
  },[]);
  // Data baru masuk setelah operasi Supabase selesai; tidak ada setState sinkron di effect ini.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void reload()},[reload]);

  const summary=useMemo(()=>rows.reduce((total,row)=>{
    total[row.status]++;if(row.status==="posted"){total.revenue+=Number(row.revenue_total);total.hpp+=Number(row.total_hpp);total.margin+=Number(row.margin_total)}return total;
  },{posted:0,pending_mapping:0,blocked:0,revenue:0,hpp:0,margin:0}),[rows]);
  const {pendingRows,history}=useMemo(()=>({
    pendingRows:rows.filter(row=>row.status==="pending_mapping"),
    history:rows.filter(row=>row.status!=="pending_mapping"),
  }),[rows]);

  const syncOld=()=>{
    if(!confirm("Proses seluruh pesanan lama yang sudah ditandai Dikirim? Pesanan yang cocok akan membuat jurnal HPP bahan. Pesanan yang belum cocok masuk daftar mapping."))return;
    startTransition(async()=>{try{const result=await syncExistingShippedHpp(user?.username||"");setMessage(`Sinkronisasi selesai: ${result.posted} dibukukan, ${result.pending} perlu mapping, ${result.blocked} terblokir.`);await reload()}catch(error){setMessage(error instanceof Error?error.message:"Sinkronisasi gagal.")}});
  };
  const connect=(row:SalesHppRecognitionRow)=>{
    const productId=selected[row.id];if(!productId){setMessage("Pilih barang katalog HPP terlebih dahulu.");return}
    startTransition(async()=>{try{await mapAndProcessSalesHpp(row.id,productId,row.order_product_name,user?.username||"");setMessage(`${row.order_product_name} berhasil dihubungkan dan diproses.`);await reload()}catch(error){setMessage(error instanceof Error?error.message:"Pemetaan gagal.")}});
  };

  return <section style={{marginTop:16,border:`1px solid ${line}`,borderRadius:12,background:"white",padding:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><div><div style={{display:"flex",alignItems:"center",gap:7}}><Truck size={18} color={accent}/><h2 style={{margin:0,fontSize:15,color:ink}}>HPP barang terkirim</h2></div><p style={{margin:"4px 0 0",fontSize:10,color:med}}>HPP dibekukan otomatis tepat saat status barang ditandai Dikirim.</p></div><button type="button" disabled={pending||!schemaReady} onClick={syncOld} style={{border:0,borderRadius:7,background:accent,color:"white",padding:"9px 12px",fontSize:10,fontWeight:700,cursor:"pointer",opacity:(pending||!schemaReady) ? 0.6 : 1,display:"flex",gap:6,alignItems:"center"}}><RefreshCw size={13}/>{pending?"Memproses...":"Sinkronkan pesanan lama"}</button></div>
    {message&&<div style={{marginTop:10,padding:9,borderRadius:7,background:soft,color:med,fontSize:10}}>{message}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:12}}>{[["Sudah dibukukan",summary.posted],["Perlu mapping",summary.pending_mapping],["Terblokir",summary.blocked],["Penjualan",rp(summary.revenue)],["HPP lengkap",rp(summary.hpp)],["Margin",rp(summary.margin)]].map(([label,value])=><div key={label} style={{padding:10,border:`1px solid ${line}`,borderRadius:8,background:"#FFFCFA"}}><div style={{fontSize:9,color:med}}>{label}</div><b style={{display:"block",marginTop:3,fontSize:12,color:ink}}>{value}</b></div>)}</div>
    {pendingRows.length>0&&<div style={{marginTop:14}}><div style={{display:"flex",alignItems:"center",gap:6,color:"#B45309",fontSize:11,fontWeight:800}}><AlertTriangle size={14}/>Barang perlu dihubungkan ({pendingRows.length})</div><div style={{display:"grid",gap:7,marginTop:8}}>{pendingRows.map(row=><div key={row.id} style={{display:"grid",gridTemplateColumns:"minmax(160px,1fr) minmax(170px,1fr) auto",gap:7,alignItems:"center",padding:9,border:`1px solid ${line}`,borderRadius:8}}><div><b style={{fontSize:10,color:ink}}>{row.order_product_name||"Tanpa nama barang"}</b><div style={{fontSize:9,color:med,marginTop:2}}>{row.order_reference} · {row.customer_name}</div></div><select value={selected[row.id]||""} onChange={event=>setSelected(current=>({...current,[row.id]:event.target.value}))} style={{border:`1px solid ${line}`,borderRadius:6,padding:8,fontSize:10,background:"white"}}><option value="">Pilih katalog HPP</option>{products.filter(product=>product.id).map(product=><option key={product.id} value={product.id}>{product.product_name}</option>)}</select><button disabled={pending} onClick={()=>connect(row)} style={{border:0,borderRadius:6,background:ink,color:"white",padding:"8px 10px",fontSize:9,fontWeight:700,display:"flex",gap:5,alignItems:"center"}}><Link2 size={12}/>Hubungkan</button></div>)}</div></div>}
    <div style={{marginTop:14}}><div style={{display:"flex",alignItems:"center",gap:6,color:ink,fontSize:11,fontWeight:800}}><CheckCircle2 size={14} color={green}/>Riwayat pengakuan</div>{history.length===0?<p style={{fontSize:10,color:med}}>Belum ada barang terkirim yang diproses.</p>:<div style={{overflowX:"auto",marginTop:8}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}><thead><tr style={{background:soft,color:med}}>{["Tanggal","Referensi","Barang","Meter","Penjualan","HPP lengkap","Margin","Status"].map(label=><th key={label} style={{padding:8,textAlign:"left",whiteSpace:"nowrap"}}>{label}</th>)}</tr></thead><tbody>{history.slice(0,100).map(row=><tr key={row.id} style={{borderBottom:`1px solid ${line}`}}><td style={{padding:8}}>{row.recognition_date}</td><td style={{padding:8}}>{row.order_reference}<br/><span style={{color:med}}>{row.customer_name}</span></td><td style={{padding:8}}>{row.product_name_snapshot||row.order_product_name}</td><td style={{padding:8}}>{Number(row.total_meter).toLocaleString("id-ID")}</td><td style={{padding:8}}>{rp(row.revenue_total)}</td><td style={{padding:8}}>{rp(row.total_hpp)}</td><td style={{padding:8,color:Number(row.margin_total)<0?"#B91C1C":green,fontWeight:700}}>{rp(row.margin_total)}</td><td style={{padding:8,color:row.status==="blocked"?"#B91C1C":green,fontWeight:700}}>{row.status==="blocked"?"Tahun terkunci":"Dibukukan"}</td></tr>)}</tbody></table></div>}</div>
    <p style={{margin:"12px 0 0",fontSize:9,color:med,lineHeight:1.5}}>Jurnal hanya membukukan modal bahan (Debit HPP 5101, Kredit Persediaan 1301). Biaya pewarnaan, karyawan, produksi, dan jalan tetap berasal dari menu Keuangan agar tidak tercatat dua kali. Membatalkan tanda Dikirim tidak menghapus jurnal; koreksi harus dilakukan oleh bagian keuangan.</p>
  </section>;
}
