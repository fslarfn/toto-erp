"use client";
// ============================================================
// Ruang Tim — chat + papan tugas dalam satu alur pesan.
// Desain: 3 kolom (filter+tim | feed+composer | tugas berjalan),
// stack di mobile. Identitas CV Toto: cream/coklat, heading Lora.
// Data: lib/ruang-tim.ts (Supabase realtime, tabel messages).
// ============================================================
import { useState, useMemo, useRef, useEffect } from "react";
import { Lora } from "next/font/google";
import {
    Send, ListTodo, Megaphone, Info, Clock,
    CheckCircle2, Circle, Flame, MessageSquare,
} from "lucide-react";
import {
    useRuangTim, type RuangTimMessage, type MessageType, type TaskPriority,
} from "@/lib/ruang-tim";

const lora = Lora({ subsets: ["latin"], weight: ["500", "600"] });

// ——— Brand tokens (CV Toto) ———
const C = {
    cream: "#F6F1E9",
    paper: "#FCFAF5",
    ink: "#33281D",
    brown: "#6B5842",
    line: "#E4DACB",
    accent: "#8A5A2B", // HANYA untuk sinyal/aksi (tombol, tugas)
    pin: "#5A4632",    // pengumuman
};
const serif = lora.style.fontFamily;

const TYPES: Record<MessageType, { label: string; icon: typeof Info; tint: string; ink: string }> = {
    info:       { label: "Info",       icon: Info,     tint: "#EFE7DA", ink: "#6B5842" },
    tugas:      { label: "Tugas",      icon: ListTodo, tint: "#F3E7D5", ink: "#8A5A2B" },
    pengumuman: { label: "Pengumuman", icon: Megaphone, tint: "#E9E2D4", ink: "#5A4632" },
};

// Warna avatar deterministik per user (palet selaras brand).
const AVATAR_COLORS = ["#7A5C3A", "#4E6B57", "#8A5A6B", "#5A6B8A", "#8A6B4E", "#6B4E8A"];
function avatarColor(id: string | null | undefined): string {
    if (!id) return AVATAR_COLORS[0];
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ id, name, size = 34 }: { id: string | null; name: string; size?: number }) {
    return (
        <div aria-hidden style={{
            width: size, height: size, borderRadius: "50%", background: avatarColor(id),
            color: "#fff", display: "grid", placeItems: "center",
            fontFamily: serif, fontSize: size * 0.42, flexShrink: 0, letterSpacing: 0.3,
        }}>
            {(name || "?").charAt(0).toUpperCase()}
        </div>
    );
}

function TypeChip({ type }: { type: MessageType }) {
    const t = TYPES[type];
    const Icon = t.icon;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: t.tint, color: t.ink, fontSize: 11,
            fontWeight: 600, padding: "3px 9px", borderRadius: 999, letterSpacing: 0.2,
        }}>
            <Icon size={12} /> {t.label}
        </span>
    );
}

function fmtTime(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function dayLabel(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
    if (diff === 0) return "Hari Ini";
    if (diff === 1) return "Kemarin";
    return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function RuangTimPage() {
    const { messages, members, loading, error, sendMessage, toggleDone, memberName, me } = useRuangTim();

    const [type, setType] = useState<MessageType>("info");
    const [text, setText] = useState("");
    const [to, setTo] = useState("");
    const [due, setDue] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("sedang");
    const [filter, setFilter] = useState<"semua" | "tugas" | "pengumuman">("semua");
    const [sending, setSending] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);

    const others = useMemo(() => members.filter((m) => m.id !== me?.id), [members, me?.id]);
    useEffect(() => {
        // default penerima tugas: anggota pertama selain saya
        if (!to && others.length > 0) setTo(others[0].id);
    }, [others, to]);

    const shown = useMemo(() => {
        if (filter === "tugas") return messages.filter((m) => m.type === "tugas");
        if (filter === "pengumuman") return messages.filter((m) => m.type === "pengumuman");
        return messages;
    }, [messages, filter]);

    const openTasks = useMemo(
        () => messages.filter((m) => m.type === "tugas" && !m.done),
        [messages]
    );

    // Auto-scroll ke pesan terbaru
    useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, [shown.length, loading]);

    const doSend = async () => {
        if (sending) return;
        setFormError(null);
        setSending(true);
        const err = await sendMessage({
            type, body: text,
            assignee_id: type === "tugas" ? to : null,
            due_text: type === "tugas" ? due : null,
            priority: type === "tugas" ? priority : null,
        });
        setSending(false);
        if (err) { setFormError(err); return; }
        setText(""); setDue("");
    };

    const canToggle = (m: RuangTimMessage) => !!me && (m.author_id === me.id || m.assignee_id === me.id);
    const handleToggle = async (m: RuangTimMessage) => {
        const err = await toggleDone(m);
        if (err) setFormError(err);
    };

    return (
        <div className="rt-root" style={{ flex: 1, overflow: "hidden", background: C.cream, color: C.ink, display: "flex", flexDirection: "column" }}>
            <style>{`
                .rt-grid { display: grid; grid-template-columns: 210px 1fr 268px; flex: 1; min-height: 0; }
                .rt-left { border-right: 1px solid ${C.line}; padding: 22px 16px; overflow-y: auto; }
                .rt-right { border-left: 1px solid ${C.line}; padding: 22px 18px; background: ${C.paper}; overflow-y: auto; }
                .rt-main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
                .rt-root button:focus-visible, .rt-root select:focus-visible,
                .rt-root textarea:focus-visible, .rt-root input:focus-visible {
                    outline: 2px solid ${C.accent}; outline-offset: 2px;
                }
                .rt-msg { animation: rtFade .25s ease; }
                @keyframes rtFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { .rt-msg { animation: none; } }
                @media (max-width: 980px) {
                    .rt-grid { grid-template-columns: 1fr; overflow-y: auto; }
                    .rt-left { border-right: none; border-bottom: 1px solid ${C.line}; padding: 14px 16px; }
                    .rt-left .rt-team { display: none; }
                    .rt-left nav { flex-direction: row !important; margin-top: 10px !important; }
                    .rt-right { border-left: none; border-top: 1px solid ${C.line}; }
                    .rt-main { min-height: 60vh; }
                }
            `}</style>

            <div className="rt-grid">
                {/* ——— Rail kiri: filter + tim ——— */}
                <aside className="rt-left">
                    <div style={{ fontFamily: serif, fontSize: 20, color: C.ink, letterSpacing: 0.2 }}>Toto</div>
                    <div style={{ display: "inline-block", fontSize: 11, color: C.brown, letterSpacing: 2, borderBottom: `2px solid ${C.accent}`, paddingBottom: 2, marginTop: 2 }}>
                        RUANG TIM
                    </div>

                    <nav style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 2 }}>
                        {([["semua", "Semua pesan"], ["tugas", "Tugas"], ["pengumuman", "Pengumuman"]] as const).map(([k, label]) => (
                            <button key={k} onClick={() => setFilter(k)}
                                style={{
                                    textAlign: "left", fontSize: 13.5, cursor: "pointer",
                                    padding: "8px 10px", borderRadius: 8, border: "none",
                                    background: filter === k ? "#EBE3D5" : "transparent",
                                    color: filter === k ? C.ink : C.brown, fontWeight: filter === k ? 600 : 400,
                                }}>
                                {label}
                            </button>
                        ))}
                    </nav>

                    <div className="rt-team">
                        <div style={{ marginTop: 28, fontSize: 11, letterSpacing: 1.5, color: "#B3A692" }}>TIM</div>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                            {members.map((m) => (
                                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <Avatar id={m.id} name={m.name} size={30} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {m.name}{m.id === me?.id ? " (saya)" : ""}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#A79B8A" }}>{m.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* ——— Kolom tengah: feed + composer ——— */}
                <main className="rt-main" style={{ background: C.cream }}>
                    <header style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
                        <h1 style={{ fontFamily: serif, fontSize: 22, margin: 0, color: C.ink, fontWeight: 600 }}>Ruang Tim</h1>
                        <p style={{ fontSize: 13, color: C.brown, margin: "4px 0 0" }}>
                            Kirim info, umumkan perubahan, atau tugaskan pekerjaan — semua dalam satu alur.
                        </p>
                    </header>

                    <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "6px 24px", minHeight: 0 }}>
                        {error && (
                            <div role="alert" style={{ margin: "16px 0", padding: "12px 14px", borderRadius: 10, background: "#FDECEC", border: "1px solid #F2C4C4", color: "#8A2B2B", fontSize: 13 }}>
                                {error}
                            </div>
                        )}
                        {loading && !error && (
                            <p style={{ fontSize: 13, color: C.brown, padding: "20px 4px" }}>Memuat pesan…</p>
                        )}
                        {!loading && !error && shown.length === 0 && (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.brown }}>
                                <MessageSquare size={44} strokeWidth={1} style={{ opacity: 0.35, marginBottom: 12 }} />
                                <p style={{ fontSize: 13.5, margin: 0 }}>
                                    {filter === "tugas" ? "Belum ada tugas. Pilih tipe Tugas di bawah untuk menugaskan pekerjaan."
                                        : filter === "pengumuman" ? "Belum ada pengumuman. Pilih tipe Pengumuman di bawah untuk mengumumkan."
                                        : "Belum ada pesan. Mulai koordinasi dengan tim di bawah."}
                                </p>
                            </div>
                        )}

                        {shown.map((m, i) => {
                            const prev = shown[i - 1];
                            const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                            const isTask = m.type === "tugas";
                            const isAnn = m.type === "pengumuman";
                            return (
                                <div key={m.id}>
                                    {newDay && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 4px" }}>
                                            <div style={{ height: 1, flex: 1, background: C.line }} />
                                            <span style={{ fontSize: 11, fontWeight: 600, color: "#B3A692", letterSpacing: 1.5, textTransform: "uppercase" }}>{dayLabel(m.created_at)}</span>
                                            <div style={{ height: 1, flex: 1, background: C.line }} />
                                        </div>
                                    )}
                                    <div className="rt-msg" style={{ display: "flex", gap: 12, padding: "14px 4px", borderBottom: `1px solid ${C.line}` }}>
                                        <Avatar id={m.author_id} name={memberName(m.author_id)} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                                                <span style={{ fontFamily: serif, fontSize: 15, color: C.ink, fontWeight: 600 }}>{memberName(m.author_id)}</span>
                                                <span style={{ fontSize: 11, color: "#A79B8A" }}>
                                                    {members.find((u) => u.id === m.author_id)?.role ?? ""}
                                                </span>
                                                <TypeChip type={m.type} />
                                                <span style={{ fontSize: 11, color: "#B3A692", marginLeft: "auto" }}>{fmtTime(m.created_at)}</span>
                                            </div>

                                            <div style={{
                                                background: isAnn ? "#EFE8DA" : C.paper,
                                                border: `1px solid ${isAnn ? "#D9CDB8" : C.line}`,
                                                borderLeft: isAnn ? `3px solid ${C.pin}` : `1px solid ${C.line}`,
                                                borderRadius: 10, padding: "11px 13px",
                                                fontSize: 14, lineHeight: 1.55, color: "#463829",
                                                whiteSpace: "pre-wrap", wordBreak: "break-word",
                                            }}>
                                                {m.body}

                                                {isTask && (
                                                    <div style={{
                                                        marginTop: 11, paddingTop: 11, borderTop: `1px dashed ${C.line}`,
                                                        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                                                    }}>
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.brown }}>
                                                            <Avatar id={m.assignee_id} name={memberName(m.assignee_id)} size={20} /> {memberName(m.assignee_id)}
                                                        </span>
                                                        {m.due_text && (
                                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: C.brown }}>
                                                                <Clock size={13} /> {m.due_text}
                                                            </span>
                                                        )}
                                                        {m.priority === "tinggi" && (
                                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#A44", fontWeight: 600 }}>
                                                                <Flame size={13} /> Prioritas tinggi
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => handleToggle(m)}
                                                            disabled={!canToggle(m)}
                                                            title={canToggle(m) ? undefined : "Hanya pemberi/penerima tugas yang bisa mengubah status"}
                                                            style={{
                                                                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
                                                                border: `1px solid ${m.done ? "#B7C9B7" : C.accent}`,
                                                                background: m.done ? "#EAF2EA" : "transparent",
                                                                color: m.done ? "#4E6B57" : C.accent,
                                                                fontSize: 12.5, fontWeight: 600,
                                                                padding: "5px 11px", borderRadius: 999,
                                                                cursor: canToggle(m) ? "pointer" : "not-allowed",
                                                                opacity: canToggle(m) ? 1 : 0.45,
                                                            }}>
                                                            {m.done ? <><CheckCircle2 size={14} /> Selesai</> : <><Circle size={14} /> Tandai selesai</>}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ——— Composer ——— */}
                    <div style={{ borderTop: `1px solid ${C.line}`, background: C.paper, padding: "14px 24px 18px", flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                            {(Object.keys(TYPES) as MessageType[]).map((k) => {
                                const t = TYPES[k]; const Icon = t.icon; const on = type === k;
                                return (
                                    <button key={k} onClick={() => setType(k)}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                                            fontSize: 12.5, fontWeight: 600, padding: "6px 12px",
                                            borderRadius: 999, border: `1px solid ${on ? t.ink : C.line}`,
                                            background: on ? t.tint : "transparent", color: on ? t.ink : C.brown,
                                        }}>
                                        <Icon size={13} /> {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        {type === "tugas" && (
                            <div style={{ display: "flex", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                                <select value={to} onChange={(e) => setTo(e.target.value)} style={selStyle} aria-label="Penerima tugas">
                                    {others.map((m) => (
                                        <option key={m.id} value={m.id}>Untuk: {m.name}</option>
                                    ))}
                                </select>
                                <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Deadline (mis. Kamis 16:00)" style={{ ...selStyle, width: 190 }} aria-label="Deadline" />
                                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} style={selStyle} aria-label="Prioritas">
                                    <option value="sedang">Prioritas sedang</option>
                                    <option value="tinggi">Prioritas tinggi</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                            <textarea
                                value={text} onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doSend(); }}
                                placeholder={
                                    type === "tugas" ? "Tulis tugas yang jelas: apa, untuk siapa, kapan…"
                                        : type === "pengumuman" ? "Tulis pengumuman untuk seluruh tim…"
                                        : "Bagikan info atau update…"
                                }
                                rows={2}
                                style={{
                                    flex: 1, resize: "none", fontSize: 14, lineHeight: 1.5, fontFamily: "inherit",
                                    padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`,
                                    background: "#fff", color: C.ink, outline: "none",
                                }}
                            />
                            <button onClick={doSend} disabled={sending || !text.trim()}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 7, cursor: sending || !text.trim() ? "not-allowed" : "pointer",
                                    background: C.accent, color: "#fff", border: "none",
                                    fontSize: 13.5, fontWeight: 600, padding: "11px 18px", borderRadius: 10,
                                    opacity: sending || !text.trim() ? 0.5 : 1,
                                }}>
                                <Send size={15} /> {sending ? "Mengirim…" : "Kirim"}
                            </button>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 7 }}>
                            <span style={{ fontSize: 11, color: "#B3A692" }}>⌘/Ctrl + Enter untuk kirim cepat</span>
                            {formError && <span role="alert" style={{ fontSize: 11.5, fontWeight: 600, color: "#A44" }}>{formError}</span>}
                        </div>
                    </div>
                </main>

                {/* ——— Kolom kanan: tugas berjalan ——— */}
                <aside className="rt-right">
                    <div style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>Tugas berjalan</div>
                    <div style={{ width: 30, height: 2, background: C.accent, margin: "7px 0 18px" }} />
                    {openTasks.length === 0 && (
                        <p style={{ fontSize: 13, color: C.brown, lineHeight: 1.5 }}>
                            Belum ada tugas terbuka. Kirim pesan bertipe <strong>Tugas</strong> untuk menambah.
                        </p>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                        {openTasks.map((t) => (
                            <div key={t.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 12px", background: "#fff" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                                    <Avatar id={t.assignee_id} name={memberName(t.assignee_id)} size={22} />
                                    <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>{memberName(t.assignee_id)}</span>
                                    {t.priority === "tinggi" && <Flame size={13} color="#A44" style={{ marginLeft: "auto" }} />}
                                </div>
                                <div style={{ fontSize: 12.5, color: "#5A4A3A", lineHeight: 1.45 }}>
                                    {t.body.length > 84 ? t.body.slice(0, 84) + "…" : t.body}
                                </div>
                                {t.due_text && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, fontSize: 11.5, color: C.brown }}>
                                        <Clock size={12} /> {t.due_text}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}

const selStyle: React.CSSProperties = {
    fontSize: 12.5, color: "#463829", padding: "7px 10px",
    borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", outline: "none",
};
