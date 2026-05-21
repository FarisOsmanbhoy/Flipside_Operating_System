"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { setAvatarUrl } from "@/app/(app)/(company)/staff/actions";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function AvatarUploader({
  userId,
  fullName,
  avatarUrl,
  canEdit,
}: {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  canEdit: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [currentUrl, setCurrentUrl] = useState(avatarUrl);
  const { push } = useToast();
  const router = useRouter();

  const onPick = () => fileRef.current?.click();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      push({ tone: "error", message: "Use a PNG, JPEG, or WebP image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      push({ tone: "error", message: "Image must be 2 MB or smaller." });
      return;
    }

    start(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (uploadErr) {
        push({ tone: "error", message: uploadErr.message });
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      try {
        await setAvatarUrl({ id: userId, avatar_url: publicUrl });
        setCurrentUrl(publicUrl);
        push({ tone: "success", message: "Profile picture updated." });
        router.refresh();
      } catch (err) {
        push({
          tone: "error",
          message: err instanceof Error ? err.message : "Failed to save.",
        });
      }
    });
  };

  return (
    <div className="relative">
      <Avatar name={fullName} src={currentUrl} size={96} />
      {canEdit && (
        <>
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-700 text-white shadow-md hover:bg-brand-800 disabled:opacity-60"
            aria-label="Change profile picture"
            title="Change profile picture"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(",")}
            onChange={onChange}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}
