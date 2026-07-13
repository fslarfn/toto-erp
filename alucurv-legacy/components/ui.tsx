"use client";

import React from "react";

// ------------------------------------------------------------
// Komponen UI bersama untuk seluruh modul ERP
// ------------------------------------------------------------

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-alu-muted">{desc}</p>}
      </div>
      {action && <div className="no-print">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-alu-line bg-alu-surface p-5 shadow-[0_1px_2px_rgba(33,37,44,0.05)] ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = "ink" }: { label: string; value: string; sub?: string; tone?: "ink" | "green" | "red" | "steel" }) {
  const tones = {
    ink: "text-alu-ink",
    green: "text-green",
    red: "text-red",
    steel: "text-steel",
  };
  return (
    <div className="arch border border-alu-line bg-alu-surface px-5 pb-4 pt-7 text-center shadow-[0_1px_2px_rgba(33,37,44,0.05)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-alu-muted">{label}</div>
      <div className={`tnum mt-1 text-xl font-bold ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-alu-muted">{sub}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", type = "button", className = "" }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "subtle";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-steel text-white hover:bg-[#264e75]",
    ghost: "border border-alu-line bg-white text-alu-ink hover:bg-alu-bg",
    subtle: "bg-steel-soft text-steel hover:bg-[#dbe8f4]",
    danger: "bg-red-soft text-red hover:bg-[#f5d9d6]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" | "red" | "steel" }) {
  const tones = {
    gray: "bg-alu-bg text-alu-muted",
    green: "bg-green-soft text-green",
    amber: "bg-amber-soft text-amber",
    red: "bg-red-soft text-red",
    steel: "bg-steel-soft text-steel",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

// ---------- Form ----------
export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-alu-muted">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-alu-line bg-white px-3 py-2 text-sm outline-none focus:border-steel focus:ring-2 focus:ring-steel/20";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

// ---------- Modal ----------
export function Modal({ open, title, onClose, children, wide = false }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-alu-ink/40 p-4 pt-12" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded-md px-2 py-1 text-alu-muted hover:bg-alu-bg">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Tabel ----------
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-alu-line bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-alu-line bg-alu-bg/60 text-left">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-alu-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-alu-line">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ cols, text = "Belum ada data. Klik tombol tambah untuk mulai mencatat." }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-alu-muted">{text}</td>
    </tr>
  );
}

export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex justify-end gap-1.5 no-print">
      {onEdit && (
        <button onClick={onEdit} className="rounded-md px-2 py-1 text-xs font-semibold text-steel hover:bg-steel-soft">Ubah</button>
      )}
      {onDelete && (
        <button
          onClick={() => { if (confirm("Hapus data ini?")) onDelete(); }}
          className="rounded-md px-2 py-1 text-xs font-semibold text-red hover:bg-red-soft"
        >
          Hapus
        </button>
      )}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-alu-line bg-white p-1 no-print">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            active === t ? "bg-alu-ink text-white" : "text-alu-muted hover:bg-alu-bg"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
