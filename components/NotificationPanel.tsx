"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { NotificationRecord, NotificationCategory } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  notifications: NotificationRecord[];
  loading: boolean;
  markAsRead: (idOrIds: string | string[]) => void;
  markAllRead: () => void;
}

type TabKey = "semua" | NotificationCategory;

const TABS: { key: TabKey; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "keuangan", label: "Keuangan" },
  { key: "produksi", label: "Produksi" },
  { key: "stok", label: "Stok" },
];

// Pemetaan notification_type → kategori tab
const CATEGORY_OF: Record<string, NotificationCategory> = {
  piutang_jatuh_tempo: "keuangan",
  tagihan_jatuh_tempo: "keuangan",
  status_bayar: "keuangan",
  pesanan_baru: "keuangan",
  kasbon: "keuangan",
  produksi_selesai: "produksi",
  status_produksi: "produksi",
  pesanan_stuck: "produksi",
  absensi: "produksi",
  absensi_terlambat: "produksi",
  stok_minimum: "stok",
};

const SEVERITY_ICON: Record<string, string> = {
  danger: "🔴",
  warning: "🟡",
  info: "🔵",
};

const SEVERITY_COLOR: Record<string, string> = {
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 0) return "baru saja";
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function NotificationPanel({
  isOpen,
  onClose,
  onOpenSettings,
  notifications,
  loading,
  markAsRead,
  markAllRead,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("semua");

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    if (activeTab === "semua") return notifications;
    return notifications.filter((n) => CATEGORY_OF[n.notification_type] === activeTab);
  }, [notifications, activeTab]);

  const unreadCount = notifications.reduce((a, n) => (n.is_read ? a : a + 1), 0);

  const handleOpen = (n: NotificationRecord) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.url) {
      onClose();
      router.push(n.url);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop transparan untuk menutup saat klik di luar */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "transparent" }}
      />

      {/* Dropdown */}
      <div
        role="dialog"
        aria-label="Notifikasi"
        style={{
          position: "fixed",
          top: 64,
          right: 16,
          zIndex: 61,
          width: "min(380px, calc(100vw - 24px))",
          maxHeight: "min(560px, calc(100vh - 88px))",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 12px 48px rgba(0,0,0,0.20), 0 0 0 1px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "notifDrop 0.18s ease",
        }}
      >
        <style>{`@keyframes notifDrop { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px",
            background: "linear-gradient(135deg, #3B1F0F 0%, #A67B5B 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>Notifikasi</span>
            {unreadCount > 0 && (
              <span style={{
                background: "#EF4444", color: "white", borderRadius: 99,
                fontSize: 10, fontWeight: 700, padding: "1px 7px", lineHeight: "16px",
              }}>
                {unreadCount > 99 ? "99+" : unreadCount} baru
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={onOpenSettings}
              title="Pengaturan notifikasi"
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.15)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              title="Tutup"
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.15)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #F0F0F0", flexShrink: 0 }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: "10px 4px", fontSize: 12, fontWeight: 700,
                  background: "transparent", border: "none", cursor: "pointer",
                  color: active ? "#A67B5B" : "#9E9E9E",
                  borderBottom: active ? "2px solid #A67B5B" : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        {unreadCount > 0 && (
          <div style={{
            display: "flex", justifyContent: "flex-end",
            padding: "8px 14px 0", flexShrink: 0,
          }}>
            <button
              onClick={markAllRead}
              style={{
                fontSize: 11.5, fontWeight: 700, color: "#A67B5B",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              Tandai semua sudah dibaca
            </button>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 4px" }}>
          {loading && notifications.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 0" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "3px solid #A67B5B", borderTopColor: "transparent",
                animation: "spin 0.7s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ fontSize: 12, color: "#999" }}>Memuat…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "44px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 36, opacity: 0.25 }}>🔔</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9E9E9E" }}>Tidak ada notifikasi</div>
              <div style={{ fontSize: 11.5, color: "#BDBDBD", lineHeight: 1.5 }}>
                Notifikasi pada kategori ini akan muncul di sini.
              </div>
            </div>
          ) : (
            filtered.map((n) => {
              const color = SEVERITY_COLOR[n.severity] ?? "#3B82F6";
              return (
                <div
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  style={{
                    display: "flex", gap: 11, padding: "11px 14px",
                    borderBottom: "1px solid #F6F6F6",
                    background: n.is_read ? "white" : "#FFFBF7",
                    borderLeft: n.is_read ? "3px solid transparent" : `3px solid ${color}`,
                    cursor: n.url ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontSize: 16, lineHeight: "20px", flexShrink: 0 }}>
                    {SEVERITY_ICON[n.severity] ?? "🔵"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: n.is_read ? 600 : 800,
                      color: n.is_read ? "#555" : "#1A1A1A",
                      lineHeight: 1.3, marginBottom: 2,
                    }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{
                        fontSize: 11.5, color: "#888", lineHeight: 1.45,
                        whiteSpace: "pre-line",
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                      }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                      <span style={{ fontSize: 10.5, color: "#BDBDBD" }}>{timeAgo(n.created_at)}</span>
                      {n.url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpen(n); }}
                          style={{
                            fontSize: 11, fontWeight: 700, color: "#A67B5B",
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}
                        >
                          Lihat →
                        </button>
                      )}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
