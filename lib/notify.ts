"use client";

export function pushNotify(opts: {
  notificationType: string;
  title: string;
  body: string;
  url?: string;
  targetRoles?: string[];
  targetUserIds?: string[];
}): void {
  fetch("/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).catch(() => {});
}
