import type { HTMLAttributes } from "react";
import { cn } from "@/lib/format";

type Tone =
  | "neutral"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  brand: "bg-brand-50 text-brand-700",
  accent: "bg-accent-50 text-accent-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-sky-50 text-sky-700",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Pill({ tone = "neutral", className, ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-[var(--radius-pill)] whitespace-nowrap",
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  );
}
