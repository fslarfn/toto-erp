"use client";
import { useTopDebtors } from "../../hooks/useCockpit";

const formatRp = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
};

export default function TopDebtorsCard() {
  const { data, error, isLoading } = useTopDebtors();

  if (isLoading) return (
    <div className="card animate-pulse" style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="text-slate-400 text-sm">Memuat Daftar Penghutang...</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}>
      <div className="p-6 text-red-600 text-sm">Gagal memuat daftar penghutang.</div>
    </div>
  );

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100/50 shadow-lg shadow-amber-900/[0.02] transition-all duration-300 hover:shadow-amber-900/[0.05]">
      <div className="p-6 pb-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest">
            Top 5 Penghutang
          </span>
          <span className="text-[8px] font-black text-amber-900/20 uppercase tracking-widest">
            By Total Piutang
          </span>
        </div>
      </div>
      <div className="p-6 pt-3 space-y-2">
        {data && data.length > 0 ? (
          data.map((debtor, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/40 border border-transparent hover:border-amber-100/40 hover:bg-white/80 transition-all duration-300 group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 min-w-[32px] rounded-lg bg-amber-600/90 flex items-center justify-center text-white text-[10px] font-black shadow-md shadow-amber-600/10 group-hover:scale-105 transition-transform">
                  {debtor.customer_name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-bold text-[#3C2F2F] truncate group-hover:text-amber-700 transition-colors tracking-tight">
                    {debtor.customer_name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-rose-500/50" />
                    <span className="text-[9px] text-rose-600/60 font-black uppercase tracking-widest">{debtor.oldest_days}d aging</span>
                  </div>
                </div>
              </div>
              <div className="text-right pl-3">
                <p className="text-xs font-black text-[#3C2F2F] tracking-tighter">{formatRp(debtor.total_outstanding)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-[#8B5E3C]/30 italic text-[11px] font-bold">
            Semua piutang teratasi!
          </div>
        )}
      </div>
    </div>
  );
}
