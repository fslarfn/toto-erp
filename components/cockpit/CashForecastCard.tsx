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
import { AlertCircle, TrendingUp } from "lucide-react";

const formatRp = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
};

export default function CashForecastCard() {
  const { data, error, isLoading } = useCashForecast();
  const MIN_SAFE_BALANCE = 50000000;

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm animate-pulse flex items-center justify-center h-[320px] md:col-span-2">
      <div className="text-slate-400 text-sm">Memuat Proyeksi Kas...</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#fee2e2] p-5 shadow-sm flex items-center justify-center h-[320px] md:col-span-2">
      <div className="text-red-600 text-sm">Gagal memuat proyeksi.</div>
    </div>
  );

  const lastPoint = data?.[data.length - 1];
  const activePoint = lastPoint?.saldo_proyeksi || 0;
  const startPoint = data?.[0]?.saldo_proyeksi || 1;
  const growth = ((activePoint - startPoint) / startPoint) * 100;

  return (
    <article className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm hover:shadow-md transition flex flex-col h-full md:col-span-2">
      <div className="flex items-start justify-between" style={{ marginBottom: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE0D4] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-[#A67B5B]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#8B6B52] uppercase leading-tight">
              Proyeksi Kas 14 Hari
            </h3>
            <div className="text-[11px] text-[#8B6B52] mt-0.5 font-medium">Estimasi saldo akhir periode</div>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${growth >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-rose-700 bg-rose-50 border-rose-100'}`}>
          {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
        </span>
      </div>

      <div className="text-3xl md:text-[32px] font-extrabold tracking-tight text-[#3E2C23] leading-none mb-6">
        {formatRp(activePoint)}
      </div>

      <div className="mt-auto h-48 -mx-2 mb-[-8px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSaldoCockpit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A67B5B" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#A67B5B" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip 
              formatter={(value: any) => [formatRp(Number(value || 0)), "Saldo"]}
              labelFormatter={(label) => format(new Date(label), "d MMM yyyy", { locale: id })}
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid #E8DCCF', 
                fontSize: '11px',
                fontWeight: '700',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="saldo_proyeksi" 
              stroke="#A67B5B" 
              fillOpacity={1} 
              fill="url(#colorSaldoCockpit)" 
              strokeWidth={3}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
