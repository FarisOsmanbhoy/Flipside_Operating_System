import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";

type Props = {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  departmentName: string | null;
};

export function ProfileCard({
  userId,
  fullName,
  email,
  avatarUrl,
  departmentName,
}: Props) {
  return (
    <Link
      href={`/staff/${userId}`}
      className="block group focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-[var(--radius-card)]"
    >
      <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
        <div
          className="relative h-32 bg-cover bg-center"
          style={{ backgroundImage: "url('/brand/door-background.png')" }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute left-1/2 -bottom-12 -translate-x-1/2">
            <Avatar
              name={fullName}
              src={avatarUrl}
              size={96}
              className="ring-4 ring-surface shadow-md"
            />
          </div>
        </div>
        <div className="pt-16 pb-5 px-4 text-center">
          <div className="text-base font-semibold truncate">
            {fullName ?? email}
          </div>
          <div className="text-xs text-muted truncate">{email}</div>
          <div className="mt-2 flex justify-center">
            <Pill tone={departmentName ? "brand" : "neutral"} dot>
              {departmentName ?? "No department"}
            </Pill>
          </div>
        </div>
      </Card>
    </Link>
  );
}
