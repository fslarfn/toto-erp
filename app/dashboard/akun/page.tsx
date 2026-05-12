"use client";
import { useState, useRef } from "react";
import { useAuth, getRoleDisplay } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import { 
    User, Lock, Camera, Save, 
    CheckCircle2, AlertCircle, Loader2,
    Shield, Key, UserCircle
} from "lucide-react";

export default function AkunPage() {
    const { user, updateUserData } = useAuth();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form states
    const [name, setName] = useState(user?.name || "");
    const [username, setUsername] = useState(user?.username || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        setMessage(null);

        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(filePath);

            const photoUrl = urlData.publicUrl;

            // 3. Update Profile in DB
            const res = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    userId: user.id, 
                    updates: { avatar: photoUrl } 
                })
            });

            const data = await res.json();
            if (data.success) {
                updateUserData(data.user);
                setMessage({ type: "success", text: "Foto profil berhasil diperbarui!" });
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Gagal upload foto." });
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setMessage(null);

        try {
            // Validasi password jika diisi
            if (newPassword) {
                if (!currentPassword) throw new Error("Masukkan password lama terlebih dahulu.");
                if (newPassword !== confirmPassword) throw new Error("Konfirmasi password tidak cocok.");
            }

            // 1. Update profil (nama, username)
            const updates: Record<string, string> = { name };
            if (username.toLowerCase() !== user.username.toLowerCase()) {
                updates.username = username;
            }

            const res = await fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            updateUserData(data.user);

            // 2. Ganti password jika diisi (endpoint terpisah dengan hashing)
            if (newPassword) {
                const pwRes = await fetch("/api/auth/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ currentPassword, newPassword }),
                });
                const pwData = await pwRes.json();
                if (!pwData.success) throw new Error(pwData.error);
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setMessage({ type: "success", text: "Profil berhasil diperbarui!" });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Gagal memperbarui profil." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-content">
            {/* Standard Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title-h1">Akun Saya</h1>
                    <p className="page-subtitle">Kelola informasi profil dan keamanan akun Anda</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                <div className="lg:col-span-1">
                    <div className="card text-center p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                        <div className="relative inline-block mb-8">
                            <div 
                                className="w-36 h-36 rounded-3xl mx-auto overflow-hidden border-4 border-white shadow-xl flex items-center justify-center bg-slate-50 transition-transform hover:scale-105 duration-500"
                            >
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={72} className="text-slate-200" />
                                )}
                            </div>
                            
                            {/* Hidden File Input */}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handlePhotoUpload} 
                                className="hidden" 
                                accept="image/*" 
                            />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{user?.name}</h2>
                            <div className="inline-flex px-3 py-1 rounded-full bg-[#5C4033]/5 border border-[#5C4033]/10">
                                <span className="text-[10px] font-bold text-[#5C4033] uppercase tracking-widest">
                                    {getRoleDisplay(user)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col gap-3">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="btn btn-secondary w-full flex items-center justify-center gap-3 py-4 shadow-sm hover:shadow-md transition-all font-bold text-[11px] tracking-wider"
                            >
                                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}
                                {uploading ? "SEDANG UPLOAD..." : "GANTI FOTO PROFIL"}
                            </button>
                            <p className="text-[10px] text-slate-400 italic">Maksimal 2MB (JPG/PNG)</p>
                        </div>

                        <div className="mt-12 pt-10 border-t border-slate-50 text-left space-y-6">
                            <div className="flex justify-between items-center group/info px-1">
                                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Username</span>
                                <span className="text-sm font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/50">@{user?.username}</span>
                            </div>
                            <div className="flex justify-between items-center group/info px-1">
                                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">ID Pegawai</span>
                                <span className="font-mono text-xs font-semibold text-slate-400">#{user?.id?.slice(0, 8).toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="card shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100/50">
                        <div className="card-body p-10">
                            {message && (
                                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
                                    message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                                }`}>
                                    {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                    <span className="text-sm font-bold uppercase tracking-tight">{message.text}</span>
                                </div>
                            )}

                            <form onSubmit={handleUpdateProfile} className="space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="form-label text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Nama Lengkap</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)}
                                            className="form-input focus:ring-4 focus:ring-[#5C4033]/5 transition-all"
                                            placeholder="Masukkan nama lengkap"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="form-label text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Username</label>
                                        <input 
                                            type="text" 
                                            value={username} 
                                            onChange={e => setUsername(e.target.value)}
                                            className="form-input focus:ring-4 focus:ring-[#5C4033]/5 transition-all"
                                            placeholder="Ganti username login"
                                            required
                                        />
                                        <p className="text-[10px] text-primary italic font-medium px-1">Username hanya dapat diganti 1x sebulan</p>
                                    </div>
                                </div>

                                <div className="pt-10 border-t border-slate-50">
                                    <h3 className="text-[12px] font-black text-slate-800 mb-8 flex items-center gap-3 tracking-widest">
                                        <div className="p-2 rounded-lg bg-[#5C4033]/5 text-[#5C4033]">
                                            <Lock size={16} />
                                        </div>
                                        KEAMANAN AKUN (GANTI PASSWORD)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-3">
                                            <label className="form-label text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Password Lama</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={e => setCurrentPassword(e.target.value)}
                                                className="form-input focus:ring-4 focus:ring-[#5C4033]/5 transition-all"
                                                placeholder="Wajib diisi jika ganti password"
                                                autoComplete="current-password"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="form-label text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Password Baru</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="form-input focus:ring-4 focus:ring-[#5C4033]/5 transition-all"
                                                placeholder="Kosongkan jika tidak diganti"
                                                autoComplete="new-password"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="form-label text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Konfirmasi Password</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                className="form-input focus:ring-4 focus:ring-[#5C4033]/5 transition-all"
                                                placeholder="Masukkan ulang password baru"
                                                autoComplete="new-password"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-12 flex flex-col md:flex-row md:items-center justify-between gap-8 border-t border-slate-50 mt-20">
                                    <button 
                                        disabled={saving}
                                        type="submit"
                                        className="btn btn-primary w-full md:w-auto px-12 py-5 shadow-xl flex items-center justify-center gap-4 font-bold uppercase text-[11px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {saving ? "Menyimpan..." : "SIMPAN PERUBAHAN"}
                                    </button>

                                    <div className="flex items-center gap-3 opacity-30 hover:opacity-100 transition-opacity">
                                        <Shield size={18} className="text-slate-400" />
                                        <p className="text-[11px] text-slate-500 font-medium italic">Data dilindungi enkripsi SSL 256-bit</p>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
