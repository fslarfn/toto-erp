import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;

        // 1. Verifikasi Signature Key (Keamanan)
        // Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
        const serverKey = process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-TEST-KEY-PASTE-HERE";
        const combinedString = order_id + status_code + gross_amount + serverKey;
        const hash = crypto.createHash("sha512").update(combinedString).digest("hex");

        if (hash !== signature_key) {
            return NextResponse.json({ error: "Invalid Signature" }, { status: 403 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 2. Update status pembayaran di billing_history
        await supabase
            .from("billing_history")
            .update({
                status: transaction_status,
                settlement_time: body.settlement_time || null,
                raw_response: body
            })
            .eq("order_id", order_id);

        // 3. Jika status 'settlement' atau 'capture' (Lunas), update masa aktif lisensi
        if (transaction_status === "settlement" || transaction_status === "capture") {
            const { data: hist } = await supabase
                .from("billing_history")
                .select("payment_type")
                .eq("order_id", order_id)
                .single();

            const { data: config } = await supabase
                .from("app_config")
                .select("license_expired_at, is_setup_completed")
                .eq("id", 1)
                .single();

            let currentExpiry = config?.license_expired_at ? new Date(config.license_expired_at) : new Date();
            // Jika lisensi sudah mati, mulai dari hari ini. Jika belum mati, tambah dari sisa masa aktif.
            const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
            
            let newExpiry = new Date(baseDate);
            let isSetupCompleted = config?.is_setup_completed;

            if (hist?.payment_type === "initial") {
                newExpiry.setDate(newExpiry.getDate() + 60); // 2 Bulan
                isSetupCompleted = true;
            } else {
                newExpiry.setDate(newExpiry.getDate() + 30); // 1 Bulan
            }

            await supabase
                .from("app_config")
                .update({
                    license_expired_at: newExpiry.toISOString(),
                    is_setup_completed: isSetupCompleted,
                    updated_at: new Date().toISOString()
                })
                .eq("id", 1);
        }

        return NextResponse.json({ message: "OK" });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
