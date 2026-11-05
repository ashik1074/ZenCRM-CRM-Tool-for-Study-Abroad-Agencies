"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

let lastScheduledRun = 0;

export async function fetchNotifications(): Promise<{ items: NotificationRow[]; unread: number }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };
  const supabase = createClient();
  // Opportunistic generation of time-based notifications (deduplicated in SQL); at most every 10 minutes per server.
  if (Date.now() - lastScheduledRun > 10 * 60_000) {
    lastScheduledRun = Date.now();
    await supabase.rpc("generate_scheduled_notifications");
  }
  const [{ data }, { count }] = await Promise.all([
    supabase.from("notifications").select("id, type, title, body, link, is_read, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);
  return { items: (data ?? []) as NotificationRow[], unread: count ?? 0 };
}

export async function markNotificationsRead(ids?: string[]) {
  const supabase = createClient();
  const q = supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  await (ids?.length ? q.in("id", ids) : q);
}
