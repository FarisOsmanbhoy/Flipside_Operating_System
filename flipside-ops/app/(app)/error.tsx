"use client";

import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-surface border border-danger-500/30 rounded-[var(--radius-card)] p-6 max-w-xl mx-auto">
      <h2 className="text-lg font-semibold text-danger-700">
        Something went wrong
      </h2>
      <p className="text-sm text-muted mt-1">{error.message}</p>
      {error.digest && (
        <p className="text-xs text-muted mt-2">Digest: {error.digest}</p>
      )}
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
