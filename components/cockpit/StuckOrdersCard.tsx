"use client";
import { useStuckOrders } from "../../hooks/useCockpit";
import { Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function StuckOrdersCard() {
  const { data, error, isLoading } = useStuckOrders();

  if (isLoading) return (
    <div className="card animate-pulse" style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="text-slate-400 text-sm">Memuat Data Order...</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}>
      <div className="p-6 text-red-600 text-sm">Gagal memuat data order mandek.</div>
    </div>
  );

  const totalStuck = data?.length || 0;

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100/50 shadow-lg shadow-amber-900/[0.02] transition-all duration-300 hover:shadow-amber-900/[0.05]">
      <div className="p-6 pb-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest">
            Order Mandek {">"}7d
          </span>
          {totalStuck > 0 && (
            <div className="px-2 py-0.5 bg-rose-500 rounded-md shadow-md shadow-rose-500/10">
              <span className="text-[8px] font-black text-white uppercase tracking-widest">{totalStuck} Critical</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-6 pt-3 space-y-4">
        {data && data.length > 0 ? (
          <>
            <div className="space-y-2">
              {data.slice(0, 4).map((order) => (
                <div key={order.id} className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/40 border border-transparent hover:border-amber-100/40 hover:bg-white/80 transition-all duration-300 group">
                  <div className="flex justify-between items-start">
                    <span className="text-[12px] font-bold text-[#3C2F2F] group-hover:text-amber-700 transition-colors tracking-tight truncate">
                      {order.no_invoice || 'Unrecorded Inv'}
                    </span>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100/50">
                      <Clock size={8} strokeWidth={3} />
                      <span className="text-[9px] font-black uppercase">{order.age_days}d</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-amber-900/20 uppercase tracking-widest truncate max-w-[120px]">
                      {order.customer_name}
                    </span>
                    <span className="text-[8px] font-black text-amber-800/60 uppercase tracking-widest px-1.5 bg-amber-50 rounded border border-amber-100/30">
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <Link 
              href="/dashboard/status-barang" 
              className="group flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-amber-600/5 border border-amber-100/50 text-[10px] font-black text-amber-800 uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all duration-300"
            >
              Analyze Batch
              <ExternalLink size={10} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </>
        ) : (
          <div className="text-center py-8 text-[#8B5E3C]/30 italic text-[11px] font-bold">
            Semua order berjalan lancar!
          </div>
        )}
      </div>
    </div>
  );
}
