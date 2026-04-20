"use client";
import { useTopDebtors } from "../../hooks/useCockpit";
import { Users } from "lucide-react";

const formatRpShort = (val: number) => {
  if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)}M`;
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`;
  return `Rp ${val.toLocaleString("id-ID")}`;
};

export default function TopDebtorsCard() {
  const { data, error, isLoading } = useTopDebtors();

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm animate-pulse flex flex-col justify-center items-center h-[280px]">
      <div className="text-slate-400 text-sm">Memuat Penghutang...</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#fee2e2] p-5 shadow-sm flex items-center justify-center h-[280px]">
      <div className="text-red-600 text-sm">Gagal memuat data.</div>
    </div>
  );

  const debtors = data?.slice(0, 5) || [];

  return (
    <article className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
      <div className="flex items-start justify-between" style={{ marginBottom: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE0D4] flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-[#A67B5B]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#8B6B52] uppercase leading-tight">
              Top 5 Penghutang
            </h3>
            <div className="text-[11px] text-[#8B6B52] mt-0.5 font-medium">Berdasarkan nominal piutang</div>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-4" style={{ borderTop: '1px solid #F1E7DA', marginTop: '1.5rem' }}>
        {debtors.length > 0 ? (
          debtors.map((debtor, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-black shadow-sm transition-transform group-hover:scale-110"
                   style={{ background: '#A67B5B' }}>
                {debtor.customer_name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#3E2C23] truncate uppercase leading-tight">{debtor.customer_name}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${debtor.oldest_days > 60 ? "text-rose-600" : (debtor.oldest_days > 30 ? "text-amber-600" : "text-emerald-600")}`}>
                  ● {debtor.oldest_days} hari
                </div>
              </div>
              <div className="text-sm font-black text-[#3E2C23] ml-2">{formatRpShort(debtor.total_outstanding)}</div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-[#8B6B52]/30 italic text-[11px] font-bold uppercase tracking-widest">
            Semua piutang teratasi!
          </div>
        )}
      </div>
    </article>
  );
}
