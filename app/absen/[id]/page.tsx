"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useKaryawan } from "@/lib/karyawan-store";
import { useAbsensi } from "@/lib/absensi-store";
import { pushNotify } from "@/lib/notify";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   HALAMAN ABSEN KARYAWAN — /absen/[id]
   Mendukung absen MASUK dan absen PULANG
   Jam masuk: 08:00 WIB. Lewat = telat.
================================================================ */

const JAM_MASUK_BATAS = 8;
const MENIT_MASUK_BATAS = 0;

function padZero(n: number) { return n.toString().padStart(2, "0"); }

function getWIBNow() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 7 * 3600000);
}

function formatTanggal(d: Date) {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function toISODate(d: Date) {
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export default function AbsenPage() {
    const params = useParams();
    const karyawanId = Number(params.id);
    const { karyawan } = useKaryawan();
    const { addAbsensi, updateAbsensiPulang, getAbsensiHariIni, sudahAbsenMasuk, sudahAbsenPulang } = useAbsensi();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [clock, setClock] = useState(getWIBNow());
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [captured, setCaptured] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [resultType, setResultType] = useState<"masuk" | "pulang">("masuk");
    const [result, setResult] = useState<{ telat: boolean; selisih: number; jam: string; totalKerja?: string; overtimeHours?: number } | null>(null);

    const emp = karyawan.find(k => k.id === karyawanId);
    const today = toISODate(clock);
    const hasMasuk = sudahAbsenMasuk(karyawanId, today);
    const hasPulang = sudahAbsenPulang(karyawanId, today);
    const recordHariIni = getAbsensiHariIni(karyawanId, today);

    const mode: "masuk" | "pulang" | "done" =
        !hasMasuk ? "masuk" :
            !hasPulang ? "pulang" :
                "done";

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(getWIBNow()), 1000);
        return () => clearInterval(t);
    }, []);

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCameraReady(true);
            setCameraError("");
        } catch {
            setCameraError("Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan.");
        }
    }, []);

    useEffect(() => {
        if (mode !== "done" && !submitted && emp) {
            startCamera();
        }
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, [mode, submitted, emp, startCamera]);

    // Capture + resize ke max 720px, quality 0.75
    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        const MAX = 720;
        const ratio = Math.min(MAX / video.videoWidth, MAX / video.videoHeight, 1);
        canvas.width = Math.round(video.videoWidth * ratio);
        canvas.height = Math.round(video.videoHeight * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        setCaptured(dataUrl);
        streamRef.current?.getTracks().forEach(t => t.stop());
    };

    // Upload canvas ke Supabase Storage, fallback ke base64 jika gagal
    const uploadFoto = async (tanggal: string, type: "masuk" | "keluar"): Promise<string> => {
        const canvas = canvasRef.current;
        if (!canvas) return captured ?? "";
        return new Promise<string>((resolve) => {
            canvas.toBlob(async (blob) => {
                if (!blob) { resolve(captured ?? ""); return; }
                const path = `${karyawanId}/${tanggal}_${type}.jpg`;
                const { error } = await supabase.storage
                    .from("absensi-foto")
                    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
                if (error) { resolve(captured ?? ""); return; }
                const { data } = supabase.storage.from("absensi-foto").getPublicUrl(path);
                resolve(data.publicUrl);
            }, "image/jpeg", 0.75);
        });
    };

    const LATE_EXEMPT = ["yuni", "faisal", "vira"];

    // Submit Masuk
    const submitMasuk = async () => {
        if (!captured || !emp) return;
        setUploading(true);
        const now = getWIBNow();
        const tanggal = toISODate(now);
        const jamStr = `${padZero(now.getHours())}:${padZero(now.getMinutes())}:${padZero(now.getSeconds())}`;
        const totalMinNow = now.getHours() * 60 + now.getMinutes();
        const totalMinBatas = JAM_MASUK_BATAS * 60 + MENIT_MASUK_BATAS;
        const isLateExempt = LATE_EXEMPT.some(name => emp.nama.toLowerCase().includes(name));
        const isTelat = !isLateExempt && totalMinNow > totalMinBatas;
        const selisih = isTelat ? totalMinNow - totalMinBatas : 0;

        const fotoUrl = await uploadFoto(tanggal, "masuk");
        setUploading(false);

        addAbsensi({
            karyawan_id: karyawanId,
            nama_karyawan: emp.nama,
            tanggal,
            jam_masuk: jamStr,
            jam_keluar: "",
            foto_masuk_base64: fotoUrl,
            foto_keluar_base64: "",
            is_telat: isTelat,
            selisih_menit: selisih,
            total_jam_kerja: "",
            catatan: "",
            overtime_hours: 0,
            status_kehadiran: "hadir",
        });

        if (isTelat) {
            pushNotify({
                notificationType: "absensi_terlambat",
                title: "Karyawan Terlambat Absen",
                body: `${emp.nama} terlambat ${selisih} menit (masuk: ${jamStr} WIB)`,
                url: "/dashboard/absensi",
            });
        }

        setResult({ telat: isTelat, selisih, jam: jamStr });
        setResultType("masuk");
        setSubmitted(true);
    };

    // Submit Pulang
    const submitPulang = async () => {
        if (!captured || !emp) return;
        setUploading(true);
        const now = getWIBNow();
        const jamStr = `${padZero(now.getHours())}:${padZero(now.getMinutes())}:${padZero(now.getSeconds())}`;

        const keluarHour = now.getHours();
        const overtimeHours = keluarHour >= 20 ? 1 : 0;

        const fotoUrl = await uploadFoto(today, "keluar");
        setUploading(false);

        updateAbsensiPulang(karyawanId, today, jamStr, fotoUrl, overtimeHours);

        if (recordHariIni) {
            const [hm, mm] = recordHariIni.jam_masuk.split(":").map(Number);
            const totalMinMasuk = hm * 60 + mm;
            const totalMinKeluar = now.getHours() * 60 + now.getMinutes();
            const diffMin = Math.max(0, totalMinKeluar - totalMinMasuk);
            const jam = Math.floor(diffMin / 60);
            const min = diffMin % 60;
            setResult({ telat: false, selisih: 0, jam: jamStr, totalKerja: `${jam} jam ${min} menit`, overtimeHours });
        } else {
            setResult({ telat: false, selisih: 0, jam: jamStr, overtimeHours });
        }
        setResultType("pulang");
        setSubmitted(true);
    };

    const retake = () => {
        setCaptured(null);
        startCamera();
    };

    // ──────── NOT FOUND ────────
    if (!emp) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
                    <h2 style={{ color: "#DC2626", margin: 0 }}>Karyawan tidak ditemukan</h2>
                    <p style={{ color: "#888", marginTop: 8 }}>ID karyawan <b>{karyawanId}</b> tidak terdaftar.</p>
                </div>
            </div>
        );
    }

    // ──────── ALL DONE ────────
    if (mode === "done" && !submitted) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                    <h2 style={{ color: "#15803D", margin: 0 }}>Absensi Lengkap!</h2>
                    <p style={{ color: "#888", marginTop: 8, textAlign: "center" as const }}>
                        <b>{emp.nama}</b> sudah absen masuk dan pulang hari ini.
                    </p>
                    {recordHariIni && (
                        <div style={{ ...styles.infoBox, marginTop: 16 }}>
                            <InfoRow label="Jam Masuk" value={recordHariIni.jam_masuk + " WIB"} />
                            <InfoRow label="Jam Keluar" value={recordHariIni.jam_keluar + " WIB"} />
                            <InfoRow label="Total Kerja" value={recordHariIni.total_jam_kerja || "-"} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ──────── SUCCESS ────────
    if (submitted && result) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>
                        {resultType === "masuk" ? (result.telat ? "⏰" : "✅") : "🏠"}
                    </div>
                    <h2 style={{
                        color: resultType === "masuk" && result.telat ? "#DC2626" : "#15803D",
                        margin: 0, marginBottom: 8,
                    }}>
                        {resultType === "masuk"
                            ? (result.telat ? "Absen Masuk — TELAT!" : "Absen Masuk Berhasil!")
                            : "Absen Pulang Berhasil!"}
                    </h2>
                    {resultType === "masuk" && result.telat && (
                        <div style={styles.alertTelat}>
                            ⚠️ Anda terlambat <b>{result.selisih} menit</b> dari batas jam 08:00 WIB
                        </div>
                    )}
                    <div style={{ marginTop: 16, textAlign: "left" as const, width: "100%" }}>
                        <InfoRow label="Nama" value={emp.nama} />
                        <InfoRow label="Tanggal" value={formatTanggal(clock)} />
                        <InfoRow label={resultType === "masuk" ? "Jam Masuk" : "Jam Keluar"} value={result.jam + " WIB"} />
                        {resultType === "masuk" && (
                            <InfoRow label="Status" value={result.telat ? `🔴 Telat ${result.selisih} menit` : "🟢 Tepat Waktu"} />
                        )}
                        {resultType === "pulang" && result.totalKerja && (
                            <InfoRow label="Total Jam Kerja" value={`⏱️ ${result.totalKerja}`} />
                        )}
                        {resultType === "pulang" && result.overtimeHours != null && result.overtimeHours > 0 && (
                            <InfoRow label="Lembur" value={`🌙 ${result.overtimeHours} hari kerja`} />
                        )}
                    </div>
                    {captured && <img src={captured} alt="Selfie" style={styles.previewImg} />}
                </div>
            </div>
        );
    }

    // ──────── CAMERA & ABSEN FORM ────────
    const isMasuk = mode === "masuk";
    const themeColor = isMasuk ? { primary: "#3B82F6", dark: "#1D4ED8" } : { primary: "#F59E0B", dark: "#D97706" };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Header */}
                <div style={{ textAlign: "center" as const, marginBottom: 20 }}>
                    <div style={{ ...styles.logo, background: `linear-gradient(135deg, ${themeColor.primary}, ${themeColor.dark})` }}>
                        {isMasuk ? "📋" : "🏠"}
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", margin: "8px 0 4px" }}>
                        {isMasuk ? "Absen Masuk" : "Absen Pulang"}
                    </h1>
                    <p style={{ color: "#64748B", fontSize: 13, margin: 0, fontWeight: 600 }}>CV TOTO ALUMINIUM MANUFACTURE</p>
                </div>

                {/* Employee info */}
                <div style={styles.infoBox}>
                    <InfoRow label="Nama" value={emp.nama} />
                    <InfoRow label="Jabatan" value={emp.jabatan} />
                    <InfoRow label="Tanggal" value={formatTanggal(clock)} />
                    {!isMasuk && recordHariIni && (
                        <InfoRow label="Jam Masuk" value={recordHariIni.jam_masuk + " WIB"} />
                    )}
                </div>

                {/* Live clock */}
                <div style={styles.clockBox}>
                    <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>
                        Jam Saat Ini (WIB)
                    </div>
                    {(() => {
                        const isLateExemptClock = LATE_EXEMPT.some(n => emp.nama.toLowerCase().includes(n));
                        const isLateNow = !isLateExemptClock && (clock.getHours() * 60 + clock.getMinutes()) > (JAM_MASUK_BATAS * 60 + MENIT_MASUK_BATAS);
                        return (
                            <>
                                <div style={{
                                    fontSize: 36, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                                    color: isMasuk ? (isLateNow ? "#DC2626" : "#15803D") : themeColor.dark,
                                }}>
                                    {padZero(clock.getHours())}:{padZero(clock.getMinutes())}:{padZero(clock.getSeconds())}
                                </div>
                                {isMasuk && isLateNow && (
                                    <div style={{ color: "#DC2626", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                                        ⚠️ Sudah melewati batas jam 08:00 WIB
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Camera */}
                {!captured ? (
                    <div style={styles.cameraBox}>
                        {cameraError ? (
                            <div style={{ padding: 32, textAlign: "center" as const, color: "#DC2626" }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>📵</div>
                                <p style={{ fontSize: 14 }}>{cameraError}</p>
                                <button onClick={startCamera} style={styles.retakeBtn}>Coba Lagi</button>
                            </div>
                        ) : (
                            <>
                                <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
                                {!cameraReady && (
                                    <div style={styles.cameraLoading}>
                                        <div>Membuka kamera...</div>
                                    </div>
                                )}
                            </>
                        )}
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                        {cameraReady && !cameraError && (
                            <button onClick={capturePhoto} style={{
                                ...styles.captureBtn,
                                background: `linear-gradient(135deg, ${themeColor.primary}, ${themeColor.dark})`,
                            }}>
                                📸 Ambil Foto
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={styles.cameraBox}>
                        <img src={captured} alt="Preview" style={styles.previewImgFull} />
                        <div style={{ display: "flex", gap: 12, padding: 16, justifyContent: "center" }}>
                            <button onClick={retake} disabled={uploading} style={{ ...styles.retakeBtn, opacity: uploading ? 0.5 : 1 }}>
                                🔄 Ulangi
                            </button>
                            <button
                                onClick={isMasuk ? submitMasuk : submitPulang}
                                disabled={uploading}
                                style={{
                                    ...styles.submitBtn,
                                    background: uploading
                                        ? "#94A3B8"
                                        : isMasuk
                                            ? "linear-gradient(135deg, #22C55E, #15803D)"
                                            : "linear-gradient(135deg, #F59E0B, #D97706)",
                                    cursor: uploading ? "wait" : "pointer",
                                }}
                            >
                                {uploading ? "⏳ Menyimpan..." : isMasuk ? "✅ Absen Masuk" : "🏠 Absen Pulang"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ color: "#64748B", fontSize: 14 }}>{label}</span>
            <span style={{ color: "#1E293B", fontSize: 14, fontWeight: 600 }}>{value}</span>
        </div>
    );
}

/* ──────── STYLES ──────── */
const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: "100dvh", display: "flex", alignItems: "flex-start", justifyContent: "center",
        background: "linear-gradient(160deg, #1a2744 0%, #0f172a 60%, #0c1523 100%)",
        padding: "16px 12px 32px", fontFamily: "'Inter', -apple-system, sans-serif",
    },
    card: {
        width: "100%", maxWidth: 460, background: "white", borderRadius: 24, padding: "24px 20px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", alignItems: "center",
        marginTop: 12,
    },
    logo: {
        width: 60, height: 60, borderRadius: 18,
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 30,
    },
    infoBox: { width: "100%", background: "#F8FAFC", borderRadius: 14, padding: "14px 16px", marginBottom: 16 },
    clockBox: { width: "100%", textAlign: "center" as const, padding: "10px 0", marginBottom: 14 },
    cameraBox: { width: "100%", borderRadius: 18, overflow: "hidden", background: "#000", position: "relative" },
    video: { width: "100%", display: "block", transform: "scaleX(-1)" },
    cameraLoading: {
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)",
        color: "white", gap: 12, fontSize: 15,
    },
    captureBtn: {
        width: "100%", padding: "16px 0", color: "white", border: "none",
        fontSize: 17, fontWeight: 700, cursor: "pointer", letterSpacing: "0.2px",
    },
    submitBtn: {
        flex: 1, padding: "14px 20px", color: "white", border: "none",
        borderRadius: 14, fontSize: 15, fontWeight: 700,
    },
    retakeBtn: {
        flex: 1, padding: "14px 20px", background: "#F1F5F9", color: "#475569",
        border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer",
    },
    previewImgFull: { width: "100%", display: "block" },
    previewImg: { width: "100%", maxWidth: 300, borderRadius: 14, marginTop: 16, border: "3px solid #E2E8F0" },
    alertTelat: {
        background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14,
        padding: "14px 16px", color: "#991B1B", fontSize: 14, width: "100%",
        textAlign: "center" as const, marginTop: 8,
    },
};
