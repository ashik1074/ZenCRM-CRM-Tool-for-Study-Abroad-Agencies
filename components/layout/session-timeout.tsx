"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const MINUTES = Number(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES || 60);

/** Signs the user out after a period of inactivity (shared across tabs via localStorage). */
export function SessionTimeout() {
  const timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    const KEY = "crm:last-activity";
    const touch = () => localStorage.setItem(KEY, String(Date.now()));
    touch();
    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    timer.current = setInterval(async () => {
      const last = Number(localStorage.getItem(KEY) || Date.now());
      if (Date.now() - last > MINUTES * 60_000) {
        await createClient().auth.signOut();
        window.location.assign("/login?error=timeout");
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer.current);
    };
  }, []);
  return null;
}
