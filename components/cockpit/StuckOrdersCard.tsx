"use client";
import { useStuckOrders } from "../../hooks/useCockpit";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

export default function StuckOrdersCard() {
  const { data, error, isLoading } = useStuckOrders();
  const router = useRouter();

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm animate-pulse flex flex-col justify-center items-center h-[280px]">
      <div className="text-slate-400 text-sm">Memuat Data Order...</div>
    </div>
  );

  if (error) return (
    <div className="bg-white rounded-2xl border border-[#fee2e2] p-5 shadow-sm flex items-center justify-center h-[280px]">
      <div className="text-red-600 text-sm">Gagal memuat data.</div>
    </div>
  );

  const totalStuck = data?.length || 0;

  return (
    <article className="bg-white rounded-2xl border border-[#E8DCCF] p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
      <div className="flex items-start justify-between" style={{ marginBottom: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EDE0D4] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-[#A67B5B]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#8B6B52] uppercase leading-tight">
              Order Mandek
            </h3>
            <div className="text-[11px] text-[#8B6B52] mt-0.5 font-medium">Pesanan &gt;7 hari tanpa progres</div>
          </div>
        </div>
        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
          {totalStuck}
        </span>
      </div>

      <div className="text-3xl md:text-[32px] font-extrabold tracking-tight text-[#3E2C23] leading-none mb-1">
        {totalStuck} <span className="text-lg font-medium opacity-40">Order</span>
      </div>

      <div className="mt-auto space-y-2 pt-4" style={{ borderTop: '1px solid #F1E7DA', marginTop: '1.5rem' }}>
        {data && data.length > 0 ? (
          data.slice(0, 3).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#F1E7DA]" style={{ background: '#FBF4EA' }}>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black opacity-30 uppercase tracking-tighter mb-0.5">#{o.no_invoice || "???"}</div>
                <div className="text-[11px] font-extrabold text-[#3E2C23] truncate uppercase leading-tight">{o.customer_name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-black text-rose-600 uppercase leading-none mb-1">{o.age_days} Hari</div>
                <div className="text-[9px] font-bold text-[#8B6B52] uppercase tracking-tighter opacity-70">{o.status.replace("_", " ")}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-xs text-[#8B6B52] italic font-medium">Tidak ada order mandek</div>
        )}

        <button 
          onClick={() => router.push("/dashboard/status-barang")}
          className="w-full pt-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#A67B5B] hover:text-[#8D684C] transition-colors text-center"
        >
          Lihat Semua &rarr;
        </button>
      </div>
    </article>
  );
}
