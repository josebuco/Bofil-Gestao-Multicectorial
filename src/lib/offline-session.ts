const KEY = "bofil_offline_session";

export type OfflineSession = {
  userId: string;
  email: string | null;
};

export function saveOfflineSession(user: { id: string; email?: string | null }) {
  if (typeof window === "undefined") return;
  const session: OfflineSession = { userId: user.id, email: user.email ?? null };
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function readOfflineSession(): OfflineSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<OfflineSession> | null;
    if (!value || typeof value.userId !== "string" || !value.userId) return null;
    return { userId: value.userId, email: typeof value.email === "string" ? value.email : null };
  } catch {
    return null;
  }
}

export function clearOfflineSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}