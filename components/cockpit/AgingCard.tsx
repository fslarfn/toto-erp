"use client";
import { useCockpitAging } from "../../hooks/useCockpit";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { useRouter } from "next/navigation";

const formatRpShort = (val: number) => {
  if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)}M`;
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`;
  return `Rp ${val.toLocaleString("id-ID")}`;
};

const COLORS = {
  '0-30': '#10b981',   // Emerald 500
  '31-60': '#f59e0b',  // Amber 500
  '61-90': '#f97316',  // Orange 500
  '>90': '#ef4444',    // Red 500
};

export default function AgingCard() {
  const { data, error, isLoading } = useCockpitAging();
  const router = useRouter();

  if (isLoading) return (
    <div className="card animate-pulse" style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="text-slate-400 text-sm">Memuat Aging...</div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ border: "1px solid #fee2e2", backgroundColor: "#fef2f2" }}>
      <div className="p-6 text-red-600 text-sm">Gagal memuat aging.</div>
    </div>
  );

  const totalOutstanding = data?.reduce((sum, item) => sum + item.outstanding, 0) || 0;

  // Prepare data for chart - ensure all buckets exist
  const buckets: ('0-30' | '31-60' | '61-90' | '>90')[] = ['0-30', '31-60', '61-90', '>90'];
  const chartData = buckets.map(b => ({
    name: b,
    value: data?.find(d => d.bucket === b)?.outstanding || 0
  }));

  const handleBarClick = (data: any) => {
    if (data && data.name) {
      router.push(`/dashboard/tagihan?bucket=${data.name}`);
    }
  };

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-amber-100/50 shadow-lg shadow-amber-900/[0.02] transition-all duration-300 hover:shadow-amber-900/[0.05]">
      <div className="p-6 pb-2">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="text-[10px] font-black text-amber-900/40 uppercase tracking-widest block mb-1">
              Piutang Aging
            </span>
            <div className="text-2xl md:text-3xl font-black text-[#3C2F2F] tracking-tighter leading-none">
              {formatRpShort(totalOutstanding)}
            </div>
          </div>
          <div className="px-2 py-1 bg-amber-50 rounded-md border border-amber-100/50">
            <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Global Scan</span>
          </div>
        </div>
      </div>
      <div className="p-6 pt-2" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            layout="vertical" 
            margin={{ left: -10, right: 30, top: 0, bottom: 0 }}
            onClick={(state: any) => {
              if (state && state.activePayload) handleBarClick(state.activePayload[0].payload);
            }}
          >
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              fontSize={10} 
              fontWeight={900}
              tickLine={false} 
              axisLine={false}
              width={50}
              tick={{ fill: '#8B5E3C', opacity: 0.6 }}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(251, 191, 36, 0.03)', radius: 4 }}
              formatter={(value: any) => [formatRpShort(Number(value || 0)), '']}
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid rgba(251, 191, 36, 0.2)', 
                boxShadow: '0 8px 16px rgba(139, 94, 60, 0.08)',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              labelStyle={{ color: '#8B5E3C', marginBottom: '2px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.name as keyof typeof COLORS]} 
                  className="cursor-pointer hover:filter hover:brightness-110 transition-all duration-300"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <div className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-[8px] font-black text-amber-900/20 uppercase tracking-widest text-center">
            Analyze Bucket Metrics
          </p>
        </div>
      </div>
    </div>
  );
}
