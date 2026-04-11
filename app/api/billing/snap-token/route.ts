import { NextResponse } from "next/server";
import { midtrans, BILLING_CONFIG } from "@/lib/midtrans";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const { username } = await req.json();

        // Hanya Manajemen yang boleh membuat transaksi
        const allowedUsers = ["faisal", "vira", "toto", "fauzi", "yuni"];
        if (!allowedUsers.includes(username)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 1. Cek apakah ini pembayaran pertama atau bulanan
        const { data: config } = await supabase
            .from("app_config")
            .select("is_setup_completed")
            .eq("id", 1)
            .single();

        const isInitial = !config?.is_setup_completed;
        const amount = isInitial 
            ? BILLING_CONFIG.INITIAL_SETUP_PRICE 
            : BILLING_CONFIG.MONTHLY_PRICE;
        
        const orderId = `BILL-${Date.now()}`;

        // 2. Buat Transaksi di Midtrans
        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: amount,
            },
            credit_card: {
                secure: true,
            },
            customer_details: {
                first_name: "CV TOTO",
                last_name: "Aluminium",
                email: "farifin814@gmail.com", // Email Owner dari dashboard Midtrans
            },
            item_details: [
                {
                    id: isInitial ? "INITIAL_SETUP" : "MONTHLY_SUB",
                    price: amount,
                    quantity: 1,
                    name: isInitial 
                        ? "Setup Biaya Server + 2 Bln Langganan" 
                        : "Perpanjangan Langganan 30 Hari",
                }
            ]
        };

        const transaction = await midtrans.createTransaction(parameter);

        // 3. Simpan log transaksi ke DB dengan status pending
        await supabase.from("billing_history").insert({
            order_id: orderId,
            amount: amount,
            payment_type: isInitial ? "initial" : "monthly",
            status: "pending"
        });

        return NextResponse.json({
            token: transaction.token,
            redirect_url: transaction.redirect_url,
            orderId
        });

    } catch (error: any) {
        console.error("Midtrans Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
