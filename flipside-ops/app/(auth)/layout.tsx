import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-canvas to-accent-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/brand/logo.jpg"
            alt="FlipSide Specialties"
            width={96}
            height={96}
            className="rounded-md mb-2"
            priority
          />
          <p className="text-base font-display font-semibold text-brand-700">
            FlipSide Ops
          </p>
        </div>
        <div className="bg-surface border border-brand-100 rounded-[var(--radius-card)] shadow-[var(--shadow-elevated)] p-6">
          {children}
        </div>
        <p className="text-xs text-muted text-center mt-6">
          Internal system. Authorised staff only.
        </p>
      </div>
    </div>
  );
}
