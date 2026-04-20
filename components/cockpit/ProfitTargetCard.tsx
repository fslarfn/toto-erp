"use client";
import { useProfitStats } from "../../hooks/useCockpit";
import { Target, TrendingUp } from "lucide-react";
import SetTargetDialog from "./SetTargetDialog";
import { useAuth } from "../../lib/auth";

const formatRp = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
};

export default function ProfitTargetCard() {
  const { data, error, isLoading } = useProfitStats();
  const { user } = useAuth();

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm animate-pulse flex flex-col justify-center items-center h-[280px]">
      <div className="text-slate-400 text-sm">Memuat Statistik Laba...</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#fee2e2] p-5 shadow-sm flex items-center justify-center h-[280px]">
      <div className="text-red-600 text-sm">Gagal memuat statistik.</div>
    </div>
  );

  const { profit, target, income, expense } = data!;
  const progress = Math.min(Math.max((profit / target) * 100, 0), 100);

  return (
    <article className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
      <div className="flex items-start justify-between" style={{ marginBottom: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE0D4] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-[#A67B5B]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#8B6B52] uppercase leading-tight">
              Laba Bulan Ini
            </h3>
            <div className="text-[11px] text-[#8B6B52] mt-0.5 font-medium">Target: {formatRp(target)}</div>
          </div>
        </div>
        {user?.role === 'owner' && (
          <SetTargetDialog currentTarget={target} />
        )}
      </div>

      <div className={`text-3xl md:text-[32px] font-extrabold tracking-tight leading-none mb-1 ${profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
        {formatRp(profit)}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] mb-1.5 uppercase font-bold tracking-tight">
          <span className="text-[#8B6B52]">Pencapaian Target</span>
          <span className={`${progress >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-[#F1E7DA] rounded-full overflow-hidden">
          <div 
            className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full transition-all duration-700`} 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-[#F1E7DA] grid grid-cols-2 gap-4 text-sm" style={{ marginTop: '1.5rem' }}>
        <div>
          <div className="text-[10px] text-[#8B6B52] uppercase font-bold tracking-wider mb-1">Inflow</div>
          <div className="font-extrabold text-emerald-700 text-base">{formatRp(income)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#8B6B52] uppercase font-bold tracking-wider mb-1">Outflow</div>
          <div className="font-extrabold text-rose-700 text-base">{formatRp(expense)}</div>
        </div>
      </div>
    </article>
  );
}
