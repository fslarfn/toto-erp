"use client";
import { useCashForecast } from "../../hooks/useCockpit";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from "recharts";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { AlertCircle } from "lucide-react";

const formatRp = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
};

export default function CashForecastCard() {
  const { data, error, isLoading } = useCashForecast();
  const MIN_SAFE_BALANCE = 50000000; // Default or from cockpit_settings

  if (isLoading) return (
    <div className="card animate-pulse" style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="text-slate-400 text-sm">Memuat Proyeksi...</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}>
      <div className="p-6 text-red-600 text-sm">Gagal memuat proyeksi.</div>
    </div>
  );

  const lastPoint = data?.[data.length - 1];
  const isSafe = (data?.every(p => p.saldo_proyeksi >= MIN_SAFE_BALANCE)) ?? true;
  const isCritical = (data?.some(p => p.saldo_proyeksi < 0)) ?? false;

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100/50 shadow-lg shadow-amber-900/[0.02] transition-all duration-300 hover:shadow-amber-900/[0.05]">
      <div className="p-6 pb-2">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest block mb-1">
              Proyeksi Kas 14 Hari
            </span>
            <div className="text-2xl md:text-3xl font-black text-[#3C2F2F] tracking-tighter leading-none">
              {lastPoint ? formatRp(lastPoint.saldo_proyeksi) : 'Rp 0'}
            </div>
          </div>
          {!isSafe && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-black tracking-widest uppercase border ${isCritical ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
              <AlertCircle size={10} strokeWidth={3} />
              {isCritical ? "Critical" : "Reserve Low"}
            </div>
          )}
        </div>
      </div>
      <div className="p-6 pt-2" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D97706" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#D97706" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(139, 94, 60, 0.05)" />
            <XAxis 
              dataKey="date" 
              fontSize={9} 
              fontWeight={900}
              tickLine={false} 
              axisLine={false}
              tick={{ fill: 'rgba(139, 94, 60, 0.3)' }}
              tickFormatter={(str) => format(new Date(str), "dd/MM")}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              formatter={(value: any) => [formatRp(Number(value || 0)), "Estimasi"]}
              labelFormatter={(label) => format(new Date(label), "d MMM yyyy", { locale: id })}
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid rgba(251, 191, 36, 0.1)', 
                boxShadow: '0 8px 16px rgba(139, 94, 60, 0.05)',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              labelStyle={{ color: '#8B5E3C', marginBottom: '2px', fontSize: '9px', textTransform: 'uppercase' }}
            />
            <Area 
              type="monotone" 
              dataKey="saldo_proyeksi" 
              stroke="#D97706" 
              fillOpacity={1} 
              fill="url(#colorSaldo)" 
              strokeWidth={2.5}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
