"use client";
import { useState, useEffect, useCallback } from "react";
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  saveSubscription,
  removeSubscription,
  updatePrefs,
  DEFAULT_PREFS,
  type NotificationPrefs,
} from "@/lib/push-notifications";
import { useAuth } from "@/lib/auth";

export type PushStatus = "unsupported" | "denied" | "default" | "subscribed" | "loading";

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  // Detect current state on mount
  useEffect(() => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;

    async function checkStatus() {
      try {
        // Timeout 3 detik agar UI tidak hang jika SW belum aktif
        const sub = await Promise.race([
          getCurrentSubscription(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000)),
        ]);

        if (cancelled) return;

        if (sub) {
          setStatus("subscribed");
          setCurrentEndpoint(sub.endpoint);
        } else {
          setStatus(Notification.permission === "denied" ? "denied" : "default");
        }
      } catch {
        if (!cancelled) setStatus("default");
      }
    }

    checkStatus();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setStatus("loading");
    try {
      const sub = await subscribeToPush();
      if (!sub) {
        setStatus(Notification.permission === "denied" ? "denied" : "default");
        return false;
      }
      await saveSubscription(user.id, sub, prefs);
      setCurrentEndpoint(sub.endpoint);
      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("[usePushNotifications] subscribe error:", err);
      setStatus("default");
      throw err; // rethrow agar komponen UI bisa menampilkan pesan yang tepat
    }
  }, [user, prefs]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return;
    setStatus("loading");
    try {
      if (currentEndpoint) {
        await removeSubscription(user.id, currentEndpoint);
      }
      await unsubscribeFromPush();
      setCurrentEndpoint(null);
      setStatus("default");
    } catch (err) {
      console.error("[usePushNotifications] unsubscribe error:", err);
      setStatus("subscribed");
    }
  }, [user, currentEndpoint]);

  const savePrefs = useCallback(
    async (newPrefs: NotificationPrefs): Promise<void> => {
      if (!user || !currentEndpoint) return;
      setPrefs(newPrefs);
      try {
        await updatePrefs(user.id, currentEndpoint, newPrefs);
      } catch (err) {
        console.error("[usePushNotifications] updatePrefs error:", err);
      }
    },
    [user, currentEndpoint]
  );

  return {
    status,
    prefs,
    isSubscribed: status === "subscribed",
    isSupported: status !== "unsupported",
    subscribe,
    unsubscribe,
    savePrefs,
  };
}
