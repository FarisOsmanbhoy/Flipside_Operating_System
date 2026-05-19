import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function MePage() {
  const profile = await getSession();
  redirect(`/staff/${profile.id}`);
}
