"use client";
import { useProfitStats } from "../../hooks/useCockpit";
import { Target } from "lucide-react";
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
    <div className="card animate-pulse" style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="text-slate-400 text-sm">Memuat Statistik Laba...</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}>
      <div className="p-6 text-red-600 text-sm">Gagal memuat statistik laba.</div>
    </div>
  );

  const { profit, target, income, expense } = data!;
  const progress = Math.min(Math.max((profit / target) * 100, 0), 100);
  
  const getProgressColor = () => {
    if (progress >= 90) return "#10b981"; // Emerald-500
    if (progress >= 60) return "#f59e0b"; // Amber-500
    return "#ef4444"; // Rose-500
  };

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100/50 shadow-lg shadow-amber-900/[0.02] transition-all duration-300 hover:shadow-amber-900/[0.05]">
      <div className="p-6 pb-2">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest">
            Laba Bulan Ini
          </span>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100/50">
              <Target size={14} className="text-amber-700" />
            </div>
            {user?.role === 'owner' && <SetTargetDialog currentTarget={target} />}
          </div>
        </div>
      </div>
      
      <div className="p-6 pt-0">
        <div className="mb-4">
          <h2 className={`text-2xl md:text-3xl font-black tracking-tighter leading-none ${profit >= 0 ? "text-[#3C2F2F]" : "text-rose-600"}`}>
            {formatRp(profit)}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-black text-amber-900/20 uppercase tracking-widest">Target</span>
            <span className="text-[10px] font-black text-amber-800/60 tracking-tight">{formatRp(target)}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black text-amber-900/20 uppercase tracking-widest">Progress</span>
            <span className="text-[11px] font-black" style={{ color: getProgressColor() }}>
              {progress.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-amber-900/5 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000"
              style={{ 
                width: `${progress}%`, 
                backgroundColor: getProgressColor(),
                boxShadow: `0 0 8px ${getProgressColor()}30`
              }} 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-amber-100/30">
          <div className="text-left">
            <p className="text-[9px] font-black text-amber-900/20 uppercase tracking-widest mb-1">Inflow</p>
            <p className="text-xs font-black text-emerald-600 tracking-tight">{formatRp(income)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-amber-900/20 uppercase tracking-widest mb-1">Outflow</p>
            <p className="text-xs font-black text-rose-500 tracking-tight">{formatRp(expense)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
