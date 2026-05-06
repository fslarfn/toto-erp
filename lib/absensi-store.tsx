"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
    jenis: string; // 'izin' | 'sakit' | 'cuti'
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
    refreshFromLS: () => void;
    addIzin: (i: Omit<IzinRecord, "id" | "created_at">) => void;
    deleteIzin: (id: number) => void;
};

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

const AbsensiContext = createContext<AbsensiCtx | null>(null);

export function AbsensiProvider({ children }: { children: ReactNode }) {
    const [absensi, setAbsensi] = useState<AbsensiRecord[]>([]);
    const [izin, setIzin] = useState<IzinRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Load from Supabase on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from("absensi")
                    .select("*")
                    .order("id", { ascending: false });

                if (!cancelled && data && !error) {
                    setAbsensi(data.map(dbToAbsensi));
                }

                // Load izin records
                const { data: izinData, error: izinErr } = await supabase
                    .from("izin_absensi")
                    .select("*")
                    .order("tanggal", { ascending: false });
                if (!cancelled && izinData && !izinErr) {
                    setIzin(izinData as IzinRecord[]);
                }

                // Migrate old localStorage data if exists
                if (typeof window !== "undefined") {
                    const lsRaw = localStorage.getItem("totobaru_absensi");
                    if (lsRaw) {
                        try {
                            const lsData = JSON.parse(lsRaw) as AbsensiRecord[];
                            if (lsData.length > 0 && (!data || data.length === 0)) {
                                for (let i = 0; i < lsData.length; i += 50) {
                                    const chunk = lsData.slice(i, i + 50).map(a => absensiToDb(a));
                                    await supabase.from("absensi").insert(chunk);
                                }
                                const { data: freshData } = await supabase
                                    .from("absensi")
                                    .select("*")
                                    .order("id", { ascending: false });
                                if (!cancelled && freshData) {
                                    setAbsensi(freshData.map(dbToAbsensi));
                                }
                                localStorage.removeItem("totobaru_absensi");
                            }
                        } catch { /* ignore */ }
                    }
                }
            } catch {
                // keep empty
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Realtime subscriptions
    useEffect(() => {
        const channel = supabase
            .channel("realtime_absensi_v2")
            .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setAbsensi(prev => [dbToAbsensi(n as Record<string, any>), ...prev]);
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
    }, []);

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
            const next = prev.map((a: AbsensiRecord) => {
                if (a.karyawan_id === karyawan_id && a.tanggal === tanggal && !a.jam_keluar) {
                    const [hm, mm] = a.jam_masuk.split(":").map(Number);
                    const [hk, mk] = jam_keluar.split(":").map(Number);
                    const totalMinMasuk = hm * 60 + mm;
                    const totalMinKeluar = hk * 60 + mk;
                    const diffMin = Math.max(0, totalMinKeluar - totalMinMasuk);
                    const jam = Math.floor(diffMin / 60);
                    const min = diffMin % 60;
                    const total_jam_kerja = `${jam}j ${min}m`;

                    const updated = { ...a, jam_keluar, foto_keluar_base64, total_jam_kerja, overtime_hours };
                    supabase.from("absensi").update({
                        jam_keluar,
                        foto_keluar_url: foto_keluar_base64,
                        total_jam_kerja,
                        overtime_hours,
                    }).eq("id", a.id).then();
                    return updated;
                }
                return a;
            });
            return next;
        });
    }, []);

    const getAbsensiByDate = useCallback((tanggal: string) =>
        absensi.filter(a => a.tanggal === tanggal), [absensi]);

    const getAbsensiByKaryawan = useCallback((karyawan_id: number) =>
        absensi.filter(a => a.karyawan_id === karyawan_id), [absensi]);

    const getAbsensiHariIni = useCallback((karyawan_id: number, tanggal: string) =>
        absensi.find(a => a.karyawan_id === karyawan_id && a.tanggal === tanggal), [absensi]);

    const sudahAbsenMasuk = useCallback((karyawan_id: number, tanggal: string) =>
        absensi.some(a => a.karyawan_id === karyawan_id && a.tanggal === tanggal), [absensi]);

    const sudahAbsenPulang = useCallback((karyawan_id: number, tanggal: string) =>
        absensi.some(a => a.karyawan_id === karyawan_id && a.tanggal === tanggal && !!a.jam_keluar), [absensi]);

    const deleteAbsensi = useCallback((id: number) => {
        setAbsensi(prev => prev.filter(a => a.id !== id));
        supabase.from("absensi").delete().eq("id", id).then();
    }, []);

    const refreshFromLS = useCallback(() => {
        (async () => {
            const { data } = await supabase.from("absensi").select("*").order("id", { ascending: false });
            if (data) setAbsensi(data.map(dbToAbsensi));
            const { data: izinData } = await supabase.from("izin_absensi").select("*").order("tanggal", { ascending: false });
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
                sudahAbsenMasuk, sudahAbsenPulang, deleteAbsensi, refreshFromLS,
                addIzin, deleteIzin,
            }}
        >
            {children}
        </AbsensiContext.Provider>
    );
}

export function useAbsensi() {
    const ctx = useContext(AbsensiContext);
    if (!ctx) throw new Error("useAbsensi must be used inside AbsensiProvider");
    return ctx;
}
