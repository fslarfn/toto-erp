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
    // Mutate all cockpit keys
    await Promise.all([
      mutate('cockpit-balance'),
      mutate('cockpit-aging'),
      mutate('cockpit-cash-forecast'),
      mutate('cockpit-top-debtors'),
      mutate('cockpit-stuck-orders'),
      mutate('cockpit-profit-stats'),
    ]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-8 border-b border-amber-100/50 mb-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-1 bg-amber-600 rounded-full" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#3C2F2F]">
            Executive Cockpit
          </h1>
        </div>
        <p className="text-amber-800/60 text-sm font-medium ml-4">
          Visualisasi Real-time Kesehatan Finansial & Operasional CV TOTO
        </p>
      </div>
      
      <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-amber-100/30 shadow-sm">
        <div className="text-right px-2">
          <p className="text-[10px] uppercase font-bold text-amber-900/40 letter-spacing-1">Live Sync Status</p>
          <p className="text-sm font-bold text-amber-900/80">
            {format(lastUpdated, "HH:mm:ss", { locale: id })}
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="group relative p-3 bg-amber-600 h-10 w-10 flex items-center justify-center rounded-xl hover:bg-amber-700 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-amber-600/20"
          title="Refresh Data"
        >
          <RefreshCw className={`h-4 w-4 text-white ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>
    </div>
  );
}
