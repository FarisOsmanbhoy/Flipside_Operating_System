"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to tasks + notices changes and refresh the current route when
 * something changes. Cheap polling alternative; spec §11 says use realtime
 * sparingly — only the dashboard widgets.
 */
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
