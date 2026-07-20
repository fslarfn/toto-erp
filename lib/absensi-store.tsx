"use client";
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

export type AbsensiRecord = {
    id: number;
    karyawan_id: number;
    nama_karyawan: string;
    tanggal: string;
    jam_masuk: string;
    jam_keluar: string;
    foto_masuk_base64: string;
    foto_keluar_base64: string;
    is_telat: boolean;
    selisih_menit: number;
    total_jam_kerja: string;
    catatan: string;
    overtime_hours: number;
    status_kehadiran: string;
};

export type IzinRecord = {
    id: number;
    karyawan_id: number;
    nama_karyawan: string;
    tanggal: string;
    jenis: string;
    keterangan: string;
    status: string;
    created_at: string;
};

type AbsensiCtx = {
    absensi: AbsensiRecord[];
    izin: IzinRecord[];
    loading: boolean;
    addAbsensi: (a: Omit<AbsensiRecord, "id">) => void;
    updateAbsensiPulang: (karyawan_id: number, tanggal: string, jam_keluar: string, foto_keluar_base64: string, overtime_hours?: number) => void;
    getAbsensiByDate: (tanggal: string) => AbsensiRecord[];
    getAbsensiByKaryawan: (karyawan_id: number) => AbsensiRecord[];
    getAbsensiHariIni: (karyawan_id: number, tanggal: string) => AbsensiRecord | undefined;
    sudahAbsenMasuk: (karyawan_id: number, tanggal: string) => boolean;
    sudahAbsenPulang: (karyawan_id: number, tanggal: string) => boolean;
    deleteAbsensi: (id: number) => void;
    /** Ambil foto base64 satu record on-demand (tidak ikut di-fetch di daftar). */
    getAbsensiFoto: (id: number) => Promise<{ masuk: string; keluar: string }>;
    refreshFromLS: () => void;
    addIzin: (i: Omit<IzinRecord, "id" | "created_at">) => void;
    deleteIzin: (id: number) => void;
    /** Dipanggil otomatis oleh useAbsensi — memulai fetch data saat pertama kali dipakai (lazy-load). */
    ensureLoaded: () => void;
};

function padZero(n: number) { return n.toString().padStart(2, "0"); }

function getTodayWIB() {
    const now = new Date();
    const wib = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
    return `${wib.getFullYear()}-${padZero(wib.getMonth() + 1)}-${padZero(wib.getDate())}`;
}

function getNinetyDaysAgo() {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function dbToAbsensi(r: Record<string, unknown>): AbsensiRecord {
    return {
        id: r.id as number,
        karyawan_id: r.karyawan_id as number,
        nama_karyawan: (r.nama_karyawan as string) || "",
        tanggal: (r.tanggal as string) || "",
        jam_masuk: (r.jam_masuk as string) || "",
        jam_keluar: (r.jam_keluar as string) || "",
        foto_masuk_base64: (r.foto_masuk_url as string) || "",
        foto_keluar_base64: (r.foto_keluar_url as string) || "",
        is_telat: !!r.is_telat,
        selisih_menit: (r.selisih_menit as number) || 0,
        total_jam_kerja: (r.total_jam_kerja as string) || "",
        catatan: (r.catatan as string) || "",
        overtime_hours: (r.overtime_hours as number) || 0,
        status_kehadiran: (r.status_kehadiran as string) || "hadir",
    };
}

function absensiToDb(a: Partial<AbsensiRecord>): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (a.karyawan_id !== undefined) d.karyawan_id = a.karyawan_id;
    if (a.nama_karyawan !== undefined) d.nama_karyawan = a.nama_karyawan;
    if (a.tanggal !== undefined) d.tanggal = a.tanggal;
    if (a.jam_masuk !== undefined) d.jam_masuk = a.jam_masuk;
    if (a.jam_keluar !== undefined) d.jam_keluar = a.jam_keluar;
    if (a.foto_masuk_base64 !== undefined) d.foto_masuk_url = a.foto_masuk_base64;
    if (a.foto_keluar_base64 !== undefined) d.foto_keluar_url = a.foto_keluar_base64;
    if (a.is_telat !== undefined) d.is_telat = a.is_telat;
    if (a.selisih_menit !== undefined) d.selisih_menit = a.selisih_menit;
    if (a.total_jam_kerja !== undefined) d.total_jam_kerja = a.total_jam_kerja;
    if (a.catatan !== undefined) d.catatan = a.catatan;
    if (a.overtime_hours !== undefined) d.overtime_hours = a.overtime_hours;
    if (a.status_kehadiran !== undefined) d.status_kehadiran = a.status_kehadiran;
    return d;
}

// Kolom absensi TANPA foto base64 (hemat egress di fetch daftar/riwayat).
// Foto (foto_masuk_url/foto_keluar_url) diambil on-demand via getAbsensiFoto.
const ABSENSI_COLS = "id, karyawan_id, nama_karyawan, tanggal, jam_masuk, jam_keluar, is_telat, selisih_menit, total_jam_kerja, catatan, overtime_hours, status_kehadiran";

const AbsensiContext = createContext<AbsensiCtx | null>(null);

export function AbsensiProvider({ children }: { children: ReactNode }) {
    const [absensi, setAbsensi] = useState<AbsensiRecord[]>([]);
    const [izin, setIzin] = useState<IzinRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // ── PHASED LOAD (lazy) ───────────────────────────────────────
    // Fase 1: Hari ini saja → selesai dalam < 300ms → loading=false
    // Fase 2: 90 hari terakhir di background → dashboard punya data lengkap
    // Lazy-load: baru dimulai saat ada halaman yang memakai useAbsensi.
    const startedRef = useRef(false);
    const cancelledRef = useRef(false);
    const [started, setStarted] = useState(false);
    useEffect(() => {
        // Reset saat (re)mount — StrictMode dev menjalankan cleanup lalu setup ulang;
        // tanpa reset, ref tertinggal true dan hasil fetch dibuang selamanya.
        cancelledRef.current = false;
        return () => { cancelledRef.current = true; };
    }, []);

    const ensureLoaded = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        setStarted(true);
        const cancelled = () => cancelledRef.current;

        (async () => {
            const today = getTodayWIB();
            const cutoff = getNinetyDaysAgo();

            try {
                // ── FASE 1: Hanya data hari ini (fast path untuk /absen) ──
                const [{ data: todayAbs }, { data: todayIzin }] = await Promise.all([
                    supabase.from("absensi").select(ABSENSI_COLS).eq("tanggal", today),
                    supabase.from("izin_absensi").select("*").gte("tanggal", today),
                ]);

                if (!cancelled()) {
                    if (todayAbs) setAbsensi(todayAbs.map(dbToAbsensi));
                    if (todayIzin) setIzin(todayIzin as IzinRecord[]);
                    setLoading(false); // ← Unblock UI setelah data hari ini tiba
                }

                // ── FASE 2: 90 hari terakhir (background, untuk dashboard) ──
                const [{ data: histAbs }, { data: histIzin }] = await Promise.all([
                    supabase.from("absensi").select(ABSENSI_COLS).gte("tanggal", cutoff).order("tanggal", { ascending: false }),
                    supabase.from("izin_absensi").select("*").gte("tanggal", cutoff).order("tanggal", { ascending: false }),
                ]);

                if (!cancelled()) {
                    if (histAbs) setAbsensi(histAbs.map(dbToAbsensi));
                    if (histIzin) setIzin(histIzin as IzinRecord[]);
                }

                // ── FASE 3: Migrasi localStorage (jika ada data lama) ──
                if (typeof window !== "undefined") {
                    const lsRaw = localStorage.getItem("totobaru_absensi");
                    if (lsRaw) {
                        try {
                            const lsData = JSON.parse(lsRaw) as AbsensiRecord[];
                            if (lsData.length > 0 && (!histAbs || histAbs.length === 0)) {
                                for (let i = 0; i < lsData.length; i += 50) {
                                    await supabase.from("absensi").insert(lsData.slice(i, i + 50).map(a => absensiToDb(a)));
                                }
                                const { data: freshData } = await supabase
                                    .from("absensi").select(ABSENSI_COLS).gte("tanggal", cutoff).order("tanggal", { ascending: false });
                                if (!cancelled() && freshData) setAbsensi(freshData.map(dbToAbsensi));
                                localStorage.removeItem("totobaru_absensi");
                            }
                        } catch { /* ignore */ }
                    }
                }
            } catch {
                if (!cancelled()) setLoading(false);
            }
        })();
    }, []);

    // ── REALTIME (ikut lazy: baru connect setelah data mulai dimuat) ──
    useEffect(() => {
        if (!started) return;
        const channel = supabase
            .channel("realtime_absensi_v2")
            .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setAbsensi(prev => {
                        if (prev.find(x => x.id === (n as any).id)) return prev;
                        return [dbToAbsensi(n as Record<string, any>), ...prev];
                    });
                } else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<AbsensiRecord> = {};
                    if ("id" in row) mapped.id = row.id;
                    if ("karyawan_id" in row) mapped.karyawan_id = row.karyawan_id;
                    if ("nama_karyawan" in row) mapped.nama_karyawan = row.nama_karyawan;
                    if ("tanggal" in row) mapped.tanggal = row.tanggal;
                    if ("jam_masuk" in row) mapped.jam_masuk = row.jam_masuk;
                    if ("jam_keluar" in row) mapped.jam_keluar = row.jam_keluar;
                    if ("foto_masuk_url" in row) mapped.foto_masuk_base64 = row.foto_masuk_url;
                    if ("foto_keluar_url" in row) mapped.foto_keluar_base64 = row.foto_keluar_url;
                    if ("is_telat" in row) mapped.is_telat = !!row.is_telat;
                    if ("selisih_menit" in row) mapped.selisih_menit = row.selisih_menit;
                    if ("total_jam_kerja" in row) mapped.total_jam_kerja = row.total_jam_kerja;
                    if ("catatan" in row) mapped.catatan = row.catatan;
                    if ("overtime_hours" in row) mapped.overtime_hours = (row.overtime_hours as number) || 0;
                    if ("status_kehadiran" in row) mapped.status_kehadiran = (row.status_kehadiran as string) || "hadir";
                    setAbsensi(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                } else if (eventType === "DELETE") {
                    setAbsensi(prev => prev.filter(x => x.id !== (o as any).id));
                }
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "izin_absensi" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setIzin(prev => {
                        if (prev.find(x => x.id === (n as any).id)) return prev;
                        return [n as IzinRecord, ...prev];
                    });
                } else if (eventType === "UPDATE") {
                    setIzin(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...(n as IzinRecord) } : x));
                } else if (eventType === "DELETE") {
                    setIzin(prev => prev.filter(x => x.id !== (o as any).id));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [started]);

    // ── O(1) LOOKUP SETS ─────────────────────────────────────────
    // Menggantikan .some() O(n) per karyawan menjadi Set.has() O(1)
    const masukSet = useMemo(
        () => new Set(absensi.map(a => `${a.karyawan_id}_${a.tanggal}`)),
        [absensi]
    );
    const pulangSet = useMemo(
        () => new Set(absensi.filter(a => !!a.jam_keluar).map(a => `${a.karyawan_id}_${a.tanggal}`)),
        [absensi]
    );
    const absensiMap = useMemo(() => {
        const m = new Map<string, AbsensiRecord>();
        absensi.forEach(a => m.set(`${a.karyawan_id}_${a.tanggal}`, a));
        return m;
    }, [absensi]);

    // ── MUTATIONS ────────────────────────────────────────────────
    const addAbsensi = useCallback((a: Omit<AbsensiRecord, "id">) => {
        const tempId: number = Date.now();
        const newRec: AbsensiRecord = { ...a, id: tempId };
        setAbsensi(prev => [newRec, ...prev]);
        (async () => {
            const { data } = await supabase.from("absensi").insert(absensiToDb(a)).select().single();
            if (data) {
                setAbsensi(prev => prev.map(x => x.id === tempId ? dbToAbsensi(data as Record<string, any>) : x));
            }
        })();
    }, []);

    const updateAbsensiPulang = useCallback((
        karyawan_id: number,
        tanggal: string,
        jam_keluar: string,
        foto_keluar_base64: string,
        overtime_hours: number = 0,
    ) => {
        setAbsensi(prev => {
            return prev.map((a: AbsensiRecord) => {
                if (a.karyawan_id === karyawan_id && a.tanggal === tanggal && !a.jam_keluar) {
                    const [hm, mm] = a.jam_masuk.split(":").map(Number);
                    const [hk, mk] = jam_keluar.split(":").map(Number);
                    const diffMin = Math.max(0, hk * 60 + mk - (hm * 60 + mm));
                    const total_jam_kerja = `${Math.floor(diffMin / 60)}j ${diffMin % 60}m`;
                    const updated = { ...a, jam_keluar, foto_keluar_base64, total_jam_kerja, overtime_hours };
                    supabase.from("absensi").update({ jam_keluar, foto_keluar_url: foto_keluar_base64, total_jam_kerja, overtime_hours }).eq("id", a.id).then();
                    return updated;
                }
                return a;
            });
        });
    }, []);

    const getAbsensiByDate = useCallback((tanggal: string) =>
        absensi.filter(a => a.tanggal === tanggal), [absensi]);

    const getAbsensiByKaryawan = useCallback((karyawan_id: number) =>
        absensi.filter(a => a.karyawan_id === karyawan_id), [absensi]);

    const getAbsensiHariIni = useCallback((karyawan_id: number, tanggal: string) =>
        absensiMap.get(`${karyawan_id}_${tanggal}`), [absensiMap]);

    const sudahAbsenMasuk = useCallback((karyawan_id: number, tanggal: string) =>
        masukSet.has(`${karyawan_id}_${tanggal}`), [masukSet]);

    const sudahAbsenPulang = useCallback((karyawan_id: number, tanggal: string) =>
        pulangSet.has(`${karyawan_id}_${tanggal}`), [pulangSet]);

    const deleteAbsensi = useCallback((id: number) => {
        setAbsensi(prev => prev.filter(a => a.id !== id));
        supabase.from("absensi").delete().eq("id", id).then();
    }, []);

    const getAbsensiFoto = useCallback(async (id: number) => {
        const { data } = await supabase.from("absensi").select("foto_masuk_url, foto_keluar_url").eq("id", id).single();
        return {
            masuk: (data?.foto_masuk_url as string) || "",
            keluar: (data?.foto_keluar_url as string) || "",
        };
    }, []);

    const refreshFromLS = useCallback(() => {
        const cutoff = getNinetyDaysAgo();
        (async () => {
            const [{ data }, { data: izinData }] = await Promise.all([
                supabase.from("absensi").select(ABSENSI_COLS).gte("tanggal", cutoff).order("tanggal", { ascending: false }),
                supabase.from("izin_absensi").select("*").gte("tanggal", cutoff).order("tanggal", { ascending: false }),
            ]);
            if (data) setAbsensi(data.map(dbToAbsensi));
            if (izinData) setIzin(izinData as IzinRecord[]);
        })();
    }, []);

    const addIzin = useCallback((i: Omit<IzinRecord, "id" | "created_at">) => {
        supabase.from("izin_absensi").insert(i as any).then();
    }, []);

    const deleteIzin = useCallback((id: number) => {
        setIzin(prev => prev.filter(i => i.id !== id));
        supabase.from("izin_absensi").delete().eq("id", id).then();
    }, []);

    return (
        <AbsensiContext.Provider
            value={{
                absensi, izin, loading,
                addAbsensi, updateAbsensiPulang,
                getAbsensiByDate, getAbsensiByKaryawan, getAbsensiHariIni,
                sudahAbsenMasuk, sudahAbsenPulang, deleteAbsensi, getAbsensiFoto, refreshFromLS,
                addIzin, deleteIzin,
                ensureLoaded,
            }}
        >
            {children}
        </AbsensiContext.Provider>
    );
}

export function useAbsensi() {
    const ctx = useContext(AbsensiContext);
    // Halaman yang memakai hook ini otomatis memicu fetch pertama (lazy-load).
    // Effect dipanggil SEBELUM guard throw (rules-of-hooks: urutan hook wajib
    // konsisten antar-render), dengan dep stabil (ensureLoaded = useCallback).
    const ensureLoaded = ctx?.ensureLoaded;
    useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
    if (!ctx) throw new Error("useAbsensi must be used inside AbsensiProvider");
    return ctx;
}
