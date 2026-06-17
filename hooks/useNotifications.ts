"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth";
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import type { NotificationRecord } from "@/types";

interface ApiResponse {
  data: NotificationRecord[];
  unread_count: number;
  grouped: Record<string, NotificationRecord[]>;
}

/**
 * Hook notifikasi real-time:
 * 1. Fetch awal dari /api/notifications (sudah di-scope per user di server).
 * 2. Subscribe ke Supabase Realtime channel 'notifications'.
 * 3. Append/replace tanpa refetch saat ada INSERT/UPDATE.
 * 4. Expose: notifications, unreadCount, markAsRead, markAllRead, refetch.
 */
export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  // ref agar handler realtime selalu lihat userId terbaru tanpa re-subscribe
  const userIdRef = useRef<string | null>(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const isForMe = useCallback((n: NotificationRecord) => {
    return n.target_user_id == null || n.target_user_id === userIdRef.current;
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as ApiResponse;
        setItems(json.data ?? []);
      }
    } catch {
      /* offline / tabel belum ada → biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch awal + realtime subscription
  useEffect(() => {
    refetch();

    const channel = supabase
      .channel("notifications_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: RealtimePostgresInsertPayload<NotificationRecord>) => {
          const n = payload.new;
          if (!isForMe(n)) return;
          setItems((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [n, ...prev].slice(0, 100);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload: RealtimePostgresUpdatePayload<NotificationRecord>) => {
          const n = payload.new;
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, ...n } : x)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, isForMe]);

  const markAsRead = useCallback(async (idOrIds: string | string[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    // optimistik
    setItems((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, is_read: true } : n)));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* abaikan; realtime/refetch berikutnya akan menyamakan */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true })));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      /* abaikan */
    }
  }, []);

  const unreadCount = items.reduce((acc, n) => (n.is_read ? acc : acc + 1), 0);

  return { notifications: items, unreadCount, loading, markAsRead, markAllRead, refetch };
}
