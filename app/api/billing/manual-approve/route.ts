import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const { confirmationId, adminUsername } = await req.json();

        // 1. Otorisasi: Hanya Faisal yang boleh menyetujui
        if (adminUsername !== "faisal") {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 2. Ambil data konfirmasi
        const { data: confirmation, error: fetchErr } = await supabase
            .from("billing_manual_confirmations")
            .select("*")
            .eq("id", confirmationId)
            .single();

        if (fetchErr || !confirmation) throw new Error("Confirmation report not found");
        if (confirmation.status === "approved") throw new Error("Already approved");

        // 3. Ambil Konfigurasi Lisensi Saat Ini
        const { data: config, error: configErr } = await supabase
            .from("app_config")
            .select("*")
            .eq("id", 1)
            .single();

        if (configErr) throw configErr;

        // 4. Hitung Tanggal Expired Baru
        // Jika setup belum selesai (pembayaran pertama), tambah 60 hari. 
        // Jika sudah selesai, tambah 30 hari.
        const isInitial = !config.is_setup_completed;
        const daysToAdd = isInitial ? 60 : 30;
        
        let baseDate = new Date();
        const currentExpired = new Date(config.license_expired_at);
        
        // Jika expired date masih di masa depan, tambahkan dari tanggal expired tersebut
        if (currentExpired > baseDate) {
            baseDate = currentExpired;
        }

        const newExpiredAt = new Date(baseDate);
        newExpiredAt.setDate(newExpiredAt.getDate() + daysToAdd);

        // 5. UPDATE DATABASE (Transaction-like)
        
        // a. Update App Config
        await supabase
            .from("app_config")
            .update({
                license_expired_at: newExpiredAt.toISOString(),
                is_setup_completed: true, // Setelah pembayaran pertama manual pun dianggap selesai setup
                updated_at: new Date().toISOString()
            })
            .eq("id", 1);

        // b. Update Confirmation Status
        await supabase
            .from("billing_manual_confirmations")
            .update({
                status: "approved",
                approved_by: adminUsername,
                updated_at: new Date().toISOString()
            })
            .eq("id", confirmationId);

        // c. Insert ke Billing History agar muncul di tabel riwayat
        const orderId = `MANUAL-${Date.now()}`;
            await supabase
                .from("billing_history")
                .insert({
                    order_id: orderId,
                    amount: confirmation.amount,
                    payment_type: isInitial ? "initial" : "monthly",
                    status: "settlement",
                    payment_method: "MANUAL_TRANSFER",
                    gross_amount: confirmation.amount,
                    created_at: new Date().toISOString()
                });

        return NextResponse.json({ 
            message: "License activated successfully", 
            newExpiredAt: newExpiredAt.toISOString() 
        });

    } catch (error: any) {
        console.error("Manual approval error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
