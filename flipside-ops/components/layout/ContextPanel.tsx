import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

type RootProps = HTMLAttributes<HTMLDivElement>;

export function ContextPanel({ className, ...rest }: RootProps) {
  return (
    <div
      className={cn("flex flex-col min-h-full bg-surface", className)}
      {...rest}
    />
  );
}

ContextPanel.Header = function ContextPanelHeader({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-border-soft flex items-start gap-3",
        className,
      )}
      {...rest}
    />
  );
};

ContextPanel.Body = function ContextPanelBody({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4 space-y-4 flex-1", className)} {...rest} />;
};

ContextPanel.Footer = function ContextPanelFooter({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-border-soft bg-surface-strong flex items-center justify-end gap-2",
        className,
      )}
      {...rest}
    />
  );
};

export function EmptyContextPanel({
  title = "Select a row to see details",
  description,
}: {
  title?: string;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 text-muted">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted max-w-[24ch]">{description}</p>
      )}
    </div>
  );
}
