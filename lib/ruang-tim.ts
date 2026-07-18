"use client";
// ============================================================
// lib/ruang-tim.ts — data layer "Ruang Tim"
// Chat + papan tugas dalam satu alur pesan (tabel: messages).
//
//  - Fetch awal: anggota tim (app_users) + pesan urut created_at asc.
//  - Realtime: INSERT/UPDATE langsung tambal state tanpa refetch.
//  - sendMessage: optimistic; tipe 'tugas' membawa assignee/deadline/
//    prioritas; memicu notifikasi panel 🔔 via pushNotify —
//    tugas → tertarget ke assignee, info/pengumuman → semua user lain.
//  - toggleDone: hanya author ATAU assignee (ditegakkan di sini,
//    karena app memakai auth custom — bukan RLS Supabase Auth).
// ============================================================
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth";
import { pushNotify } from "@/lib/notify";

export type MessageType = "info" | "tugas" | "pengumuman";
export type TaskPriority = "sedang" | "tinggi";

export interface RuangTimMessage {
    id: string;
    created_at: string;
    author_id: string | null;
    type: MessageType;
    body: string;
    assignee_id: string | null;
    due_text: string | null;
    priority: TaskPriority | null;
    done: boolean;
}

export interface TeamMember {
    id: string;
    name: string;
    role: string;
    avatar?: string | null;
}

export interface SendMessageInput {
    type: MessageType;
    body: string;
    assignee_id?: string | null;
    due_text?: string | null;
    priority?: TaskPriority | null;
}

const MSG_COLS = "id, created_at, author_id, type, body, assignee_id, due_text, priority, done";

export function useRuangTim() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<RuangTimMessage[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // ref supaya handler realtime selalu lihat user terbaru tanpa re-subscribe
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // ── Fetch awal: anggota tim + seluruh pesan (paged, bebas cap 1000) ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                // Anggota tim via API server — SELECT app_users dari browser
                // diblokir RLS (lihat app/api/team/route.ts).
                const fetchTeam = async (): Promise<TeamMember[]> => {
                    const res = await fetch("/api/team", { cache: "no-store" });
                    if (!res.ok) throw new Error("Gagal memuat daftar tim.");
                    const json = (await res.json()) as { data: TeamMember[] };
                    return json.data ?? [];
                };
                const [users, msgs] = await Promise.all([
                    fetchTeam(),
                    (async () => {
                        const all: RuangTimMessage[] = [];
                        let from = 0;
                        while (true) {
                            const { data, error: mErr } = await supabase
                                .from("messages")
                                .select(MSG_COLS)
                                .order("created_at", { ascending: true })
                                .range(from, from + 999);
                            if (mErr) throw mErr;
                            if (data && data.length) {
                                all.push(...(data as RuangTimMessage[]));
                                if (data.length < 1000) break;
                                from += 1000;
                            } else break;
                            if (from >= 50000) break; // pengaman
                        }
                        return all;
                    })(),
                ]);
                if (!cancelled) {
                    setMembers(users);
                    setMessages(msgs);
                    setError(null);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
                if (!cancelled) {
                    setError(/relation .*messages.* does not exist|schema cache/i.test(msg)
                        ? "Tabel 'messages' belum ada — jalankan migrasi supabase/migrations/20260718_ruang_tim.sql di Supabase."
                        : msg);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ── Realtime: pesan baru & update status ──
    useEffect(() => {
        const channel = supabase
            .channel("ruang_tim_live")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
                const n = payload.new as RuangTimMessage;
                setMessages((prev) => (prev.some((m) => m.id === n.id) ? prev : [...prev, n]));
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
                const n = payload.new as RuangTimMessage;
                setMessages((prev) => prev.map((m) => (m.id === n.id ? { ...m, ...n } : m)));
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const memberName = useCallback(
        (id: string | null | undefined) => members.find((m) => m.id === id)?.name ?? "—",
        [members]
    );

    // ── Kirim pesan (optimistic + notifikasi panel) ──
    const sendMessage = useCallback(async (input: SendMessageInput): Promise<string | null> => {
        const me = userRef.current;
        const body = input.body.trim();
        if (!me) return "Sesi tidak ditemukan — silakan login ulang.";
        if (!body) return "Pesan kosong.";
        if (input.type === "tugas" && !input.assignee_id) return "Pilih penerima tugas dulu.";

        const row: RuangTimMessage = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            author_id: me.id,
            type: input.type,
            body,
            assignee_id: input.type === "tugas" ? (input.assignee_id ?? null) : null,
            due_text: input.type === "tugas" ? (input.due_text?.trim() || null) : null,
            priority: input.type === "tugas" ? (input.priority ?? "sedang") : null,
            done: false,
        };

        // Optimistic (realtime akan meng-echo; INSERT handler dedup by id)
        setMessages((prev) => [...prev, row]);
        const { error: insErr } = await supabase.from("messages").insert(row);
        if (insErr) {
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
            return insErr.message;
        }

        // 🔔 Notifikasi panel: tugas → assignee saja; lainnya → semua user lain.
        const preview = body.length > 100 ? body.slice(0, 97) + "…" : body;
        if (row.type === "tugas" && row.assignee_id && row.assignee_id !== me.id) {
            pushNotify({
                notificationType: "ruang_tim_tugas",
                title: `📋 Tugas baru dari ${me.name}`,
                body: preview + (row.due_text ? ` (deadline: ${row.due_text})` : ""),
                url: "/dashboard/ruang-tim",
                targetUserIds: [row.assignee_id],
                severity: row.priority === "tinggi" ? "warning" : "info",
            });
        } else if (row.type !== "tugas") {
            const others = members.map((m) => m.id).filter((id) => id !== me.id);
            pushNotify({
                notificationType: row.type === "pengumuman" ? "ruang_tim_pengumuman" : "ruang_tim",
                title: row.type === "pengumuman" ? `📣 Pengumuman dari ${me.name}` : `💬 ${me.name}`,
                body: preview,
                url: "/dashboard/ruang-tim",
                targetUserIds: others.length > 0 ? others : undefined,
                severity: row.type === "pengumuman" ? "warning" : "info",
            });
        }
        return null;
    }, [members]);

    // ── Toggle selesai (hanya author atau assignee) ──
    const toggleDone = useCallback(async (msg: RuangTimMessage): Promise<string | null> => {
        const me = userRef.current;
        if (!me) return "Sesi tidak ditemukan.";
        if (msg.author_id !== me.id && msg.assignee_id !== me.id) {
            return "Hanya pemberi atau penerima tugas yang bisa mengubah status.";
        }
        const next = !msg.done;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, done: next } : m)));
        const { error: updErr } = await supabase.from("messages").update({ done: next }).eq("id", msg.id);
        if (updErr) {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, done: !next } : m)));
            return updErr.message;
        }
        // Kabari pemberi tugas saat assignee menyelesaikan.
        if (next && msg.author_id && msg.author_id !== me.id) {
            pushNotify({
                notificationType: "ruang_tim_tugas",
                title: `✅ Tugas selesai oleh ${me.name}`,
                body: msg.body.length > 100 ? msg.body.slice(0, 97) + "…" : msg.body,
                url: "/dashboard/ruang-tim",
                targetUserIds: [msg.author_id],
            });
        }
        return null;
    }, []);

    return { messages, members, loading, error, sendMessage, toggleDone, memberName, me: user };
}
