"use client";
import { useState, useEffect, useCallback } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { DEFAULT_PREFS, PushSetupError, PREF_LABELS, type NotificationPrefKey } from "@/lib/push-notifications";

interface Props { isOpen: boolean; onClose: () => void; }

const CATEGORIES: {
  label: string;
  color: string;
  items: { key: NotificationPrefKey; label: string; desc: string; icon: React.ReactNode }[];
}[] = [
  {
    label: "Pesanan & Keuangan",
    color: "#1565C0",
    items: [
      { key: "pesanan_baru", label: "Pesanan Baru", desc: "Saat customer menambah pesanan baru", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg> },
      { key: "status_bayar", label: "Status Pembayaran", desc: "Saat status bayar pesanan berubah", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 15h4"/></svg> },
      { key: "tagihan_jatuh_tempo", label: "Tagihan Jatuh Tempo", desc: "Tagihan mendekati atau melewati due date", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4M10 16h4"/></svg> },
      { key: "kasbon", label: "Pengajuan Kasbon", desc: "Karyawan mengajukan kasbon baru", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg> },
    ],
  },
  {
    label: "Produksi",
    color: "#E65100",
    items: [
      { key: "status_produksi", label: "Status Produksi", desc: "Saat status produksi pesanan diperbarui", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 002 2h16a2 2 0 002-2V8l-7 5V8l-7 5V4a2 2 0 00-2-2H4a2 2 0 00-2 2z"/></svg> },
      { key: "pesanan_stuck", label: "Pesanan Stuck", desc: "Pesanan >48 jam belum ada progres", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg> },
      { key: "stok_minimum", label: "Stok Minimum", desc: "Bahan baku mendekati batas minimum", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M12 22V12M2 7l10 5 10-5"/></svg> },
    ],
  },
  {
    label: "SDM",
    color: "#6A1B9A",
    items: [
      { key: "absensi_terlambat", label: "Absensi Terlambat", desc: "Karyawan absen melebihi jam masuk", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><circle cx="18" cy="5" r="2"/><path d="M18 7v2l1.5 1.5"/></svg> },
      { key: "chat", label: "Pesan Chat Tim", desc: "Saat ada pesan baru di chat internal", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
    ],
  },
];

const TYPE_COLOR: Record<string, string> = {
  pesanan_baru: "#1565C0", status_bayar: "#1565C0",
  tagihan_jatuh_tempo: "#1565C0", kasbon: "#1565C0",
  status_produksi: "#E65100", pesanan_stuck: "#E65100", stok_minimum: "#E65100",
  absensi_terlambat: "#6A1B9A", chat: "#6A1B9A",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function Toggle({ on, onChange, disabled = false, size = "md" }: {
  on: boolean; onChange: () => void; disabled?: boolean; size?: "sm" | "md";
}) {
  const w = size === "md" ? 44 : 36;
  const h = size === "md" ? 24 : 20;
  const d = size === "md" ? 18 : 14;
  const offset = 3;
  const travel = w - d - offset * 2;
  return (
    <button onClick={onChange} disabled={disabled} aria-pressed={on} style={{
      position: "relative", width: w, height: h, borderRadius: h,
      background: on ? "var(--primary, #A67B5B)" : "#D1D5DB",
      border: "none", cursor: disabled ? "default" : "pointer",
      transition: "background 0.25s", flexShrink: 0, opacity: disabled ? 0.5 : 1,
      boxShadow: on ? "0 0 0 3px rgba(166,123,91,0.2)" : "none",
    }}>
      <span style={{
        position: "absolute", top: offset, left: offset,
        width: d, height: d, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        transform: on ? `translateX(${travel}px)` : "translateX(0)",
        transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
        display: "block",
      }} />
    </button>
  );
}

export default function NotificationSettings({ isOpen, onClose }: Props) {
  const { status, prefs, isSubscribed, subscribe, unsubscribe, savePrefs } = usePushNotifications();
  const { items, readIds, loading: histLoading, unreadCount, markRead, markAllRead, refetch } = useNotificationHistory();

  const [activeTab, setActiveTab] = useState<"riwayat" | "pengaturan">("riwayat");
  const [localPrefs, setLocalPrefs] = useState(prefs);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [migrationSql, setMigrationSql] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setLocalPrefs(prefs); }, [prefs]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) { setToast(null); setMigrationSql(null); setCopied(false); refetch(); }
  }, [isOpen, refetch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleToggleSubscribe = async () => {
    setSaving(true); setToast(null); setMigrationSql(null);
    try {
      if (isSubscribed) {
        await unsubscribe();
        setToast({ text: "Notifikasi dinonaktifkan untuk perangkat ini.", ok: true });
      } else {
        const ok = await subscribe();
        if (ok) {
          setToast({ text: "Notifikasi berhasil diaktifkan!", ok: true });
        } else {
          const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
          setToast({ text: perm === "denied" ? "Izin ditolak browser. Buka Pengaturan → izinkan notifikasi → muat ulang." : "Izin notifikasi tidak diberikan.", ok: false });
        }
      }
    } catch (err: unknown) {
      if (err instanceof PushSetupError) {
        setMigrationSql(err.sql);
        setToast({ text: "Tabel database belum dibuat. Salin & jalankan SQL di bawah, lalu coba lagi.", ok: false });
      } else {
        setToast({ text: err instanceof Error ? err.message : "Terjadi kesalahan.", ok: false });
      }
    }
    setSaving(false);
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try { await savePrefs(localPrefs); setToast({ text: "Preferensi tersimpan.", ok: true }); }
    catch { setToast({ text: "Gagal menyimpan preferensi.", ok: false }); }
    setSaving(false);
  };

  const handleCopySql = async () => {
    if (!migrationSql) return;
    try { await navigator.clipboard.writeText(migrationSql); } catch { }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTabChange = (tab: "riwayat" | "pengaturan") => {
    setActiveTab(tab);
    if (tab === "riwayat") {
      refetch();
      if (unreadCount > 0) markAllRead(items.map(i => i.id));
    }
  };

  const prefsChanged = JSON.stringify(localPrefs) !== JSON.stringify(prefs);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
        transition: "opacity 0.25s",
      }} onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col" style={{
        width: "min(420px, 100vw)", background: "#FAFAFA",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
      }}>

        {/* Header gradient */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ background: "linear-gradient(135deg, #3B1F0F 0%, #A67B5B 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm text-white leading-tight">Notifikasi Push</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Pengaturan perangkat ini</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex-shrink-0 flex" style={{ borderBottom: "1px solid #F0F0F0", background: "white" }}>
          {(["riwayat", "pengaturan"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors"
              style={{
                borderBottom: activeTab === tab ? "2px solid #A67B5B" : "2px solid transparent",
                color: activeTab === tab ? "#A67B5B" : "#9E9E9E",
                background: "transparent",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {tab === "riwayat" ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Riwayat
                  {tab === "riwayat" && unreadCount > 0 && (
                    <span style={{
                      background: "#EF4444", color: "white", borderRadius: 99,
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18,
                      textAlign: "center", lineHeight: "16px",
                    }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                  Pengaturan
                </>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ TAB: RIWAYAT ══ */}
          {activeTab === "riwayat" && (
            <div style={{ padding: "0 0 8px" }}>
              {histLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 rounded-full border-[3px] animate-spin"
                    style={{ borderColor: "#A67B5B", borderTopColor: "transparent" }} />
                  <span className="text-xs" style={{ color: "#999" }}>Memuat riwayat…</span>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                  <div style={{ fontSize: 40, opacity: 0.25 }}>🔔</div>
                  <div className="font-semibold text-sm" style={{ color: "#9E9E9E" }}>Belum ada notifikasi</div>
                  <div className="text-xs leading-relaxed" style={{ color: "#BDBDBD" }}>
                    Notifikasi akan muncul di sini saat ada pesanan baru, update produksi, atau event lainnya.
                  </div>
                </div>
              ) : (
                <>
                  {/* Toolbar tandai dibaca */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #F5F5F5" }}>
                    <span className="text-xs font-semibold" style={{ color: "#9E9E9E" }}>
                      {items.length} notifikasi{unreadCount > 0 ? ` · ${unreadCount} belum dibaca` : ""}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead(items.map(i => i.id))}
                        className="text-xs font-semibold"
                        style={{ color: "#A67B5B", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                      >
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div>
                    {items.map((item) => {
                      const isUnread = !readIds.has(item.id);
                      const color = TYPE_COLOR[item.notification_type] ?? "#757575";
                      return (
                        <div
                          key={item.id}
                          onClick={() => markRead(item.id)}
                          style={{
                            display: "flex", gap: 12, padding: "12px 16px",
                            borderBottom: "1px solid #F5F5F5",
                            background: isUnread ? "#FFFBF7" : "white",
                            cursor: "pointer",
                            borderLeft: isUnread ? `3px solid ${color}` : "3px solid transparent",
                            transition: "background 0.15s",
                          }}
                        >
                          {/* Ikon */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `${color}14`, color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                            </svg>
                          </div>

                          {/* Konten */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: isUnread ? 700 : 500,
                              color: isUnread ? "#1A1A1A" : "#555",
                              lineHeight: "1.3", marginBottom: 3,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {item.title}
                            </div>
                            <div style={{
                              fontSize: 11.5, color: "#999", lineHeight: "1.4",
                              overflow: "hidden", textOverflow: "ellipsis",
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                            }}>
                              {item.body}
                            </div>
                            <div style={{ fontSize: 10.5, color: "#BDBDBD", marginTop: 4 }}>
                              {timeAgo(item.created_at)}
                            </div>
                          </div>

                          {/* Dot unread */}
                          {isUnread && (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0, marginTop: 4 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ TAB: PENGATURAN ══ */}
          {activeTab === "pengaturan" && (
            <div style={{ padding: "20px 20px 8px" }}>

              {status === "loading" && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-10 h-10 rounded-full border-[3px] animate-spin" style={{ borderColor: "#A67B5B", borderTopColor: "transparent" }} />
                  <span className="text-sm font-medium" style={{ color: "#999" }}>Memeriksa status…</span>
                </div>
              )}

              {status === "unsupported" && (
                <div className="rounded-2xl p-4 flex gap-3" style={{ background: "#FFF8E1", border: "1px solid #FFE082" }}>
                  <div className="text-xl flex-shrink-0">⚠️</div>
                  <div>
                    <div className="font-semibold text-sm mb-0.5" style={{ color: "#F57F17" }}>Browser Tidak Didukung</div>
                    <div className="text-xs leading-relaxed" style={{ color: "#795548" }}>
                      Gunakan <strong>Chrome / Edge</strong> di Android atau <strong>Safari 16.4+</strong> di iOS.
                    </div>
                  </div>
                </div>
              )}

              {status === "denied" && (
                <div className="rounded-2xl p-4 flex gap-3" style={{ background: "#FFF3F3", border: "1px solid #FFCDD2" }}>
                  <div className="text-xl flex-shrink-0">🚫</div>
                  <div>
                    <div className="font-semibold text-sm mb-0.5" style={{ color: "#C62828" }}>Izin Notifikasi Ditolak</div>
                    <div className="text-xs leading-relaxed" style={{ color: "#795548" }}>
                      Buka <strong>Pengaturan browser</strong> → cari situs ini → ubah izin notifikasi menjadi <em>Izinkan</em> → muat ulang halaman.
                    </div>
                  </div>
                </div>
              )}

              {(status === "default" || status === "subscribed") && (
                <div className="rounded-2xl p-4 flex items-center gap-4 mb-5" style={{
                  background: isSubscribed ? "linear-gradient(135deg, #E8F5E9 0%, #F1F8E9 100%)" : "linear-gradient(135deg, #F5F5F5 0%, #FAFAFA 100%)",
                  border: isSubscribed ? "1.5px solid #A5D6A7" : "1.5px solid #E0E0E0",
                }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isSubscribed ? "#4CAF50" : "#BDBDBD" }}>
                    {isSubscribed ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13.73 21a2 2 0 01-3.46 0"/><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: "#1A1A1A" }}>
                      {isSubscribed ? "Notifikasi Aktif" : "Aktifkan Notifikasi"}
                    </div>
                    <div className="text-xs mt-0.5 leading-snug" style={{ color: "#666" }}>
                      {isSubscribed ? "Perangkat ini terdaftar & siap menerima notifikasi." : "Ketuk untuk mengizinkan notifikasi di perangkat ini."}
                    </div>
                  </div>
                  {saving ? (
                    <div className="w-11 h-6 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "#A67B5B", borderTopColor: "transparent" }} />
                    </div>
                  ) : (
                    <Toggle on={isSubscribed} onChange={handleToggleSubscribe} />
                  )}
                </div>
              )}

              {toast && (
                <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-2.5 text-sm" style={{
                  background: toast.ok ? "#E8F5E9" : "#FFF8E1",
                  border: `1px solid ${toast.ok ? "#A5D6A7" : "#FFE082"}`,
                  color: toast.ok ? "#2E7D32" : "#F57F17",
                }}>
                  <span className="flex-shrink-0 text-base">{toast.ok ? "✓" : "⚠"}</span>
                  <span>{toast.text}</span>
                </div>
              )}

              {migrationSql && (
                <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid #E0E0E0" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#F5F5F5" }}>
                    <span className="text-xs font-semibold" style={{ color: "#555" }}>Supabase Dashboard → SQL Editor</span>
                    <button onClick={handleCopySql} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: copied ? "#4CAF50" : "#3B1F0F", color: "white" }}>
                      {copied ? "✓ Tersalin!" : "Salin SQL"}
                    </button>
                  </div>
                  <pre className="text-xs p-4 overflow-x-auto select-all" style={{ background: "#1E1E1E", color: "#CE9178", margin: 0, maxHeight: 180 }}>
                    {migrationSql}
                  </pre>
                  <div className="px-4 py-2 text-xs" style={{ background: "#FAFAFA", color: "#999" }}>
                    Setelah berhasil, klik toggle di atas sekali lagi.
                  </div>
                </div>
              )}

              {isSubscribed && (
                <div className="space-y-5 pb-2">
                  {CATEGORIES.map((cat) => (
                    <div key={cat.label}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span>
                      </div>
                      <div className="space-y-2">
                        {cat.items.map(({ key, label, desc, icon }) => (
                          <div key={key}
                            className="flex items-center gap-3 rounded-2xl px-3.5 py-3 cursor-pointer"
                            style={{
                              background: localPrefs[key] ? "white" : "#F9F9F9",
                              border: localPrefs[key] ? "1.5px solid rgba(166,123,91,0.25)" : "1.5px solid #F0F0F0",
                              boxShadow: localPrefs[key] ? "0 1px 6px rgba(0,0,0,0.06)" : "none",
                            }}
                            onClick={() => setLocalPrefs(p => ({ ...p, [key]: !p[key] }))}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: localPrefs[key] ? `${cat.color}18` : "#F0F0F0", color: localPrefs[key] ? cat.color : "#BDBDBD" }}>
                              <div style={{ width: 18, height: 18 }}>{icon}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold leading-tight" style={{ color: localPrefs[key] ? "#1A1A1A" : "#9E9E9E" }}>{label}</div>
                              <div className="text-xs mt-0.5 leading-snug" style={{ color: "#BDBDBD" }}>{desc}</div>
                            </div>
                            <Toggle on={localPrefs[key]} onChange={() => setLocalPrefs(p => ({ ...p, [key]: !p[key] }))} size="sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {prefsChanged && (
                    <button onClick={handleSavePrefs} disabled={saving}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #3B1F0F 0%, #A67B5B 100%)", boxShadow: "0 4px 14px rgba(166,123,91,0.4)" }}>
                      {saving ? "Menyimpan…" : "Simpan Preferensi"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 text-xs"
          style={{ borderTop: "1px solid #F0F0F0", color: "#BDBDBD", background: "#FAFAFA" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Bekerja saat app ditutup · Android Chrome · iOS Safari 16.4+</span>
        </div>
      </div>
    </>
  );
}
