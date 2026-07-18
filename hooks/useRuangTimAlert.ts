"use client";
// ============================================================
// useRuangTimAlert — sinyal pesan Ruang Tim untuk header app:
//  - unread: jumlah pesan baru sejak terakhir membuka /dashboard/ruang-tim
//    (badge di ikon 💬, disimpan per-browser via localStorage).
//  - toast: pop-up kecil + suara "ding" saat pesan baru dari orang lain
//    masuk ketika kita TIDAK sedang berada di halaman Ruang Tim
//    (menggantikan toast floating chat lama).
// ============================================================
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";
import type { RuangTimMessage, TeamMember } from "@/lib/ruang-tim";

const LS_KEY = "ruangTimLastRead";

function getLastRead(): string {
    try {
        return localStorage.getItem(LS_KEY) || "1970-01-01T00:00:00.000Z";
    } catch {
        return "1970-01-01T00:00:00.000Z";
    }
}
function setLastRead(iso: string) {
    try { localStorage.setItem(LS_KEY, iso); } catch { /* private mode */ }
}

function playDing() {
    try {
        type AudioCtor = typeof AudioContext;
        const Ctx: AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch { /* autoplay diblokir / tidak didukung */ }
}

export interface RuangTimToast {
    id: string;
    senderName: string;
    body: string;
    type: RuangTimMessage["type"];
}

export function useRuangTimAlert(currentUserId: string | null | undefined, pathname: string) {
    const [unread, setUnread] = useState(0);
    const [toast, setToast] = useState<RuangTimToast | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const membersRef = useRef<TeamMember[]>([]);
    const onPageRef = useRef(false);
    const userIdRef = useRef<string | null | undefined>(currentUserId);
    useEffect(() => { userIdRef.current = currentUserId; }, [currentUserId]);

    const onPage = pathname === "/dashboard/ruang-tim";
    useEffect(() => { onPageRef.current = onPage; }, [onPage]);

    const dismissToast = useCallback(() => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(null);
    }, []);

    // Nama pengirim untuk toast (daftar tim via API — app_users diblokir RLS di client).
    useEffect(() => {
        if (!currentUserId) return;
        let cancelled = false;
        fetch("/api/team", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((j: { data?: TeamMember[] }) => { if (!cancelled) membersRef.current = j.data ?? []; })
            .catch(() => { /* nama fallback "Tim" */ });
        return () => { cancelled = true; };
    }, [currentUserId]);

    // Masuk halaman Ruang Tim → semua dianggap terbaca.
    // Di luar halaman → hitung pesan sejak lastRead (bukan dari saya).
    useEffect(() => {
        if (!currentUserId) return;
        if (onPage) {
            setLastRead(new Date().toISOString());
            setUnread(0);
            return;
        }
        let cancelled = false;
        supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .gt("created_at", getLastRead())
            .neq("author_id", currentUserId)
            .then(({ count, error }) => {
                if (!cancelled && !error) setUnread(count ?? 0);
            });
        return () => { cancelled = true; };
    }, [currentUserId, onPage]);

    // Realtime: pesan baru → badge + toast + suara (kecuali sedang di halamannya).
    useEffect(() => {
        if (!currentUserId) return;
        const channel = supabase
            .channel("ruang_tim_alert")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
                const n = payload.new as RuangTimMessage;
                if (!n || n.author_id === userIdRef.current) return;
                if (onPageRef.current) {
                    // Sedang membaca → langsung dianggap terbaca.
                    setLastRead(new Date().toISOString());
                    return;
                }
                setUnread((c) => c + 1);
                playDing();
                const sender = membersRef.current.find((m) => m.id === n.author_id)?.name ?? "Tim";
                if (toastTimer.current) clearTimeout(toastTimer.current);
                setToast({ id: n.id, senderName: sender, body: n.body, type: n.type });
                toastTimer.current = setTimeout(() => setToast(null), 6000);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentUserId]);

    return { unread, toast, dismissToast };
}
