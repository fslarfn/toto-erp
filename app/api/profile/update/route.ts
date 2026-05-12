import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Field yang boleh diupdate oleh user sendiri
const ALLOWED_FIELDS = new Set(["name", "avatar", "username", "last_username_change"]);

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    // userId dari session header (bukan dari body — mencegah IDOR)
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { updates } = await req.json();
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Updates tidak valid" }, { status: 400 });
    }

    // Whitelist: hanya izinkan field yang aman
    const safeUpdates: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED_FIELDS.has(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: "Tidak ada field valid untuk diupdate" }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    if (safeUpdates.username) {
      const { data: currentUser, error: fetchError } = await supabase
        .from("app_users")
        .select("username, last_username_change")
        .eq("id", userId)
        .single();

      if (fetchError || !currentUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (currentUser.username !== String(safeUpdates.username).toLowerCase()) {
        if (currentUser.last_username_change) {
          const lastChange = new Date(currentUser.last_username_change);
          const diffDays =
            (Date.now() - lastChange.getTime()) / (1000 * 3600 * 24);

          if (diffDays < 30) {
            return NextResponse.json(
              {
                error: `Username hanya bisa diganti 1x sebulan. Sisa: ${Math.ceil(30 - diffDays)} hari lagi.`,
              },
              { status: 429 }
            );
          }
        }
        safeUpdates.last_username_change = new Date().toISOString();
        safeUpdates.username = String(safeUpdates.username).toLowerCase().trim();
      }
    }

    const { data: updatedData, error: updateError } = await supabase
      .from("app_users")
      .update(safeUpdates)
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
        avatar: updatedData.avatar,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
