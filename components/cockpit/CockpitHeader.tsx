"use client";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { mutate } from "swr";

export default function CockpitHeader() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Mutate all SWR keys used in cockpit components
    await Promise.all([
      mutate('cockpit-balance'),
      mutate('cockpit-aging'),
      mutate('cockpit-cash-forecast'),
      mutate('cockpit-top-debtors'),
      mutate('cockpit-stuck-orders'),
      mutate('cockpit-profit-stats'),
    ]);
    setLastUpdated(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#3E2C23]">
          Executive Cockpit
        </h1>
        <p className="text-sm md:text-base text-[#8B6B52] mt-2 font-medium leading-relaxed">
          Analisis kesehatan finansial & pergerakan operasional CV TOTO secara real-time.
        </p>
      </div>
      <div className="flex items-center gap-3 bg-white/50 p-2 pr-2.5 rounded-2xl border border-[#E8DCCF] backdrop-blur-sm self-start md:self-center">
        <div className="px-3">
          <div className="text-[10px] font-bold text-[#8B6B52] uppercase tracking-widest">Update Terakhir</div>
          <div className="text-xs font-black text-[#3E2C23]">{format(lastUpdated, "HH:mm:ss")}</div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-xl bg-[#A67B5B] hover:bg-[#8D684C] text-white text-xs font-black uppercase tracking-widest px-5 py-2.5 shadow-md shadow-[#A67B5B]/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}
