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
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm animate-pulse flex flex-col justify-center items-center h-[240px]">
      <div className="text-slate-400 text-sm">Memuat Saldo...</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#fee2e2] p-5 shadow-sm flex items-center justify-center h-[240px]">
      <div className="text-red-600 text-sm">Gagal memuat saldo.</div>
    </div>
  );

  const { total_now, total_7d_ago, delta, accounts } = data!;
  const percentDelta = total_7d_ago > 0 ? (delta / total_7d_ago) * 100 : 0;

  return (
    <article className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
      <div className="flex items-start justify-between" style={{ marginBottom: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE0D4] flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-[#A67B5B]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#8B5E34] uppercase leading-tight">
              Total Kas & Bank
            </h3>
            <div className="text-[11px] text-[#8B5E34] mt-0.5 font-medium">vs 7 hari lalu</div>
          </div>
        </div>
        {delta !== 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${delta > 0 ? 'text-[#15803D] bg-[#DCFCE7]' : 'text-[#B91C1C] bg-[#FEF2F2]'} px-2.5 py-1 rounded-full border ${delta > 0 ? 'border-[#BBF7D0]' : 'border-[#FECACA]'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(percentDelta).toFixed(1)}%
          </span>
        )}
      </div>
      
      <div className="text-3xl md:text-[32px] font-extrabold tracking-tight text-[#5C4033] leading-none mb-1 tabular-nums">
        {formatRp(total_now)}
      </div>

      <div className="mt-auto pt-4 space-y-3" style={{ borderTop: '1px solid #F1E7DA', marginTop: '1.5rem' }}>
        {accounts.slice(0, 3).map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <div className="min-w-0">
              <div className="font-bold text-[#5C4033] truncate">{a.name}</div>
              <div className="text-[10px] text-[#8B5E34] uppercase tracking-wider font-semibold">{a.bank || 'Tunai'}</div>
            </div>
            <div className="font-bold text-[#5C4033] ml-4 shrink-0">{formatRp(a.balance)}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
