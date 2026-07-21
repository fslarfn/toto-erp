"use client";
import { useCockpitAging } from "../../hooks/useCockpit";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

const formatRpShort = (val: number) => {
  if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)}M`;
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`;
  return `Rp ${val.toLocaleString("id-ID")}`;
};

export default function AgingCard() {
  const { data, error, isLoading } = useCockpitAging();
  const router = useRouter();

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm animate-pulse flex flex-col justify-center items-center h-[280px]">
      <div className="text-slate-400 text-sm">Memuat Aging...</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#fee2e2] p-5 shadow-sm flex items-center justify-center h-[280px]">
      <div className="text-red-600 text-sm">Gagal memuat aging.</div>
    </div>
  );

  const totalOutstanding = data?.reduce((sum, item) => sum + item.outstanding, 0) || 0;

  // Prepare data for chart - ensure all buckets exist
  const buckets: ('0-30' | '31-60' | '61-90' | '>90')[] = ['0-30', '31-60', '61-90', '>90'];
  const chartData = buckets.map(b => ({
    name: b,
    value: data?.find(d => d.bucket === b)?.outstanding || 0
  }));

  const labelMap = { '0-30': '0–30 hari', '31-60': '31–60 hari', '61-90': '61–90 hari', '>90': '>90 hari' };
  const colorMap = { '0-30': 'bg-[#15803D]', '31-60': 'bg-[#CA8A04]', '61-90': 'bg-[#C2410C]', '>90': 'bg-[#B91C1C]' };

  return (
    <article className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
      <div className="flex items-start justify-between" style={{ marginBottom: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE0D4] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#A67B5B]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#8B5E34] uppercase leading-tight">
              Piutang Aging
            </h3>
            <div className="text-[11px] text-[#8B5E34] mt-0.5 font-medium">Total piutang belum lunas</div>
          </div>
        </div>
        <span className="text-[10px] font-bold text-[#8B5E34] bg-[#F5EBDD] px-2 py-0.5 rounded-md border border-[#E8DCCF]">
          {data?.filter(d => d.outstanding > 0).length ?? 0} bucket
        </span>
      </div>

      <div className="text-3xl md:text-[32px] font-extrabold tracking-tight text-[#5C4033] leading-none mb-1 tabular-nums">
        {formatRpShort(totalOutstanding)}
      </div>

      <div className="mt-auto space-y-3.5 pt-4" style={{ borderTop: '1px solid #F1E7DA', marginTop: '1.5rem' }}>
        {chartData.map((b) => {
          const pct = totalOutstanding > 0 ? (b.value / totalOutstanding) * 100 : 0;
          return (
            <div key={b.name} className="cursor-pointer group" onClick={() => router.push(`/dashboard/tagihan?bucket=${b.name}`)}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#8B5E34] font-bold uppercase tracking-tight">{labelMap[b.name]}</span>
                <span className="text-[#5C4033] font-extrabold">{formatRpShort(b.value)}</span>
              </div>
              <div className="h-2 bg-[#F1E7DA] rounded-full overflow-hidden">
                <div className={`h-full ${colorMap[b.name]} rounded-full transition-all duration-700 group-hover:brightness-95`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
