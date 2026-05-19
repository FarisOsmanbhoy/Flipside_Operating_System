import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/brand/logo.jpg"
            alt="FlipSide Specialties"
            width={120}
            height={120}
            className="rounded-md mb-3"
            priority
          />
          <p className="text-sm text-muted">FlipSide Ops</p>
        </div>
        <div className="bg-surface border border-border-soft rounded-[var(--radius-card)] shadow-sm p-6">
          {children}
        </div>
        <p className="text-xs text-muted text-center mt-6">
          Internal system. Authorised staff only.
        </p>
      </div>
    </div>
  );
}
