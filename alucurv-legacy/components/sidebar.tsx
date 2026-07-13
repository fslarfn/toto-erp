"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV: { group: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    group: "Ringkasan",
    items: [{ href: "/", label: "Dashboard", icon: "◠" }],
  },
  {
    group: "Keuangan",
    items: [
      { href: "/keuangan", label: "Transaksi Kas", icon: "⇄" },
      { href: "/laporan", label: "Laporan Bulanan", icon: "▤" },
    ],
  },
  {
    group: "Penjualan",
    items: [
      { href: "/order", label: "Order", icon: "◷" },
      { href: "/invoice", label: "Invoice / Nota", icon: "❏" },
      { href: "/surat-jalan", label: "Surat Jalan", icon: "➟" },
      { href: "/hpp", label: "HPP Produk", icon: "∑" },
    ],
  },
  {
    group: "Produksi & Gudang",
    items: [
      { href: "/pengadaan", label: "Pengadaan Bahan", icon: "⬇" },
      { href: "/stok", label: "Stok Barang", icon: "▣" },
      { href: "/bending", label: "Bending CV Toto", icon: "◡" },
    ],
  },
  {
    group: "Karyawan",
    items: [{ href: "/karyawan", label: "Absensi, Gaji & Bon", icon: "◉" }],
  },
  {
    group: "Lainnya",
    items: [{ href: "/pengaturan", label: "Master & Pengaturan", icon: "⚙" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-6">
      {NAV.map((g) => (
        <div key={g.group} className="mt-5">
          <div className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{g.group}</div>
          <div className="mt-1.5 space-y-0.5">
            {g.items.map((it) => {
              const active = pathname === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "arch bg-white text-alu-ink"
                      : "rounded-lg text-white/70 hover:bg-alu-dark2 hover:text-white"
                  }`}
                >
                  <span className={`w-4 text-center ${active ? "text-steel" : "text-white/40"}`}>{it.icon}</span>
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Topbar mobile */}
      <div className="no-print sticky top-0 z-40 flex items-center justify-between bg-alu-dark px-4 py-3 text-white md:hidden">
        <div className="font-bold tracking-tight">ALUCURV <span className="text-white/50">ERP</span></div>
        <button onClick={() => setOpen(!open)} aria-label="Buka menu" className="rounded-md border border-white/20 px-3 py-1.5 text-sm">
          Menu
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-50 bg-alu-ink/50 md:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-alu-dark" onClick={(e) => e.stopPropagation()}>
            <Brand />
            {nav}
          </aside>
        </div>
      )}
      {/* Sidebar desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-alu-dark md:flex">
        <Brand />
        {nav}
        <div className="border-t border-white/10 px-6 py-4 text-[11px] leading-relaxed text-white/35">
          Data tersimpan di browser ini (mode demo).<br />Siap disambungkan ke Supabase.
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="px-6 pb-2 pt-7">
      {/* lengkungan kecil sebagai logo mark */}
      <div className="mb-2 h-5 w-10 rounded-t-full border-2 border-b-0 border-steel" aria-hidden />
      <div className="text-lg font-bold leading-none tracking-tight text-white">
        ALUCURV <span className="font-medium text-white/45">ERP</span>
      </div>
      <div className="mt-1 text-[11px] text-white/40">Jendela & pintu aluminium lengkung</div>
    </div>
  );
}
