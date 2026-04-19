"use client";
import { useCockpitBalance } from "../../hooks/useCockpit";
import { TrendingUp, TrendingDown, Minus, Wallet } from "lucide-react";

const formatRp = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
};

export default function BalanceCard() {
  const { data, error, isLoading } = useCockpitBalance();

  if (isLoading) return (
    <div className="card animate-pulse" style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="text-slate-400 text-sm">Memuat Saldo...</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}>
      <div className="p-6 text-red-600 text-sm">Gagal memuat data saldo.</div>
    </div>
  );

  const { total_now, total_7d_ago, delta, accounts } = data!;
  const percentDelta = total_7d_ago > 0 ? (delta / total_7d_ago) * 100 : 0;

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100/50 shadow-lg shadow-amber-900/[0.02] transition-all duration-300 hover:shadow-amber-900/[0.05]">
      {/* Decorative Gradient Blob */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-100/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest">
            Total Kas & Bank
          </span>
          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100/50">
            <Wallet size={14} className="text-amber-700" />
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-[#3C2F2F] tracking-tighter leading-none">
          {formatRp(total_now)}
        </h2>
      </div>
      
      <div className="p-6 pt-0">
        <div className="flex items-center gap-3 mb-6">
          {delta > 0 ? (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100/50 text-[10px] font-black uppercase">
              <TrendingUp size={12} strokeWidth={3} />
              +{percentDelta.toFixed(1)}%
            </span>
          ) : delta < 0 ? (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-100/50 text-[10px] font-black uppercase">
              <TrendingDown size={12} strokeWidth={3} />
              {percentDelta.toFixed(1)}%
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-100/50 text-[10px] font-black uppercase">
              <Minus size={12} strokeWidth={3} />
              Flat
            </span>
          )}
          <span className="text-[9px] font-black text-amber-900/20 uppercase tracking-widest">vs 7d ago</span>
        </div>

        <div className="space-y-3 pt-4 border-t border-amber-100/30">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between group">
              <div className="flex flex-col">
                <span className="text-[12px] font-bold text-[#3C2F2F] group-hover:text-amber-700 transition-colors tracking-tight">{acc.name}</span>
                <span className="text-[8px] font-black text-amber-900/30 uppercase tracking-widest">{acc.bank || 'Tunai'}</span>
              </div>
              <span className="text-[12px] font-black text-[#5C4033]">{formatRp(acc.balance)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
