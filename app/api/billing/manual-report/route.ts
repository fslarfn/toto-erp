import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const { username, amount, reference_number, notes } = await req.json();

        if (!username || !amount || !reference_number) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase
            .from("billing_manual_confirmations")
            .insert({
                username,
                amount: Number(amount),
                reference_number,
                notes,
                status: "pending"
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ message: "Report submitted successfully", data });
    } catch (error: any) {
        console.error("Manual report error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
