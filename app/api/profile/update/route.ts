import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const { userId, updates } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 1. Jika mengubah username, cek limit 30 hari
        if (updates.username) {
            const { data: currentUser, error: fetchError } = await supabase
                .from("app_users")
                .select("username, last_username_change")
                .eq("id", userId)
                .single();

            if (fetchError || !currentUser) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            // Hanya validasi jika username benar-benar berubah
            if (currentUser.username !== updates.username.toLowerCase()) {
                if (currentUser.last_username_change) {
                    const lastChange = new Date(currentUser.last_username_change);
                    const now = new Date();
                    const diffDays = (now.getTime() - lastChange.getTime()) / (1000 * 3600 * 24);

                    if (diffDays < 30) {
                        return NextResponse.json({ 
                            error: `Username hanya bisa diganti 1x sebulan. Sisa: ${Math.ceil(30 - diffDays)} hari lagi.` 
                        }, { status: 429 });
                    }
                }
                
                // Update timestamp jika username berubah
                updates.last_username_change = new Date().toISOString();
                updates.username = updates.username.toLowerCase().trim();
            }
        }

        // 2. Update data di database
        const { data: updatedData, error: updateError } = await supabase
            .from("app_users")
            .update(updates)
            .eq("id", userId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            user: {
                id: updatedData.id,
                name: updatedData.name,
                username: updatedData.username,
                role: updatedData.role,
                avatar: updatedData.avatar
            } 
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
