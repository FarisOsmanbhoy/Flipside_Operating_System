import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";

export async function GET() {
  const session = await getSession();
  const notifications = await getNotifications(session.id);
  return NextResponse.json({ notifications });
}
