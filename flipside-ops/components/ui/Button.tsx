import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-700 disabled:bg-brand-300",
  secondary:
    "bg-accent-500 text-brand-900 hover:bg-accent-600 disabled:bg-accent-100",
  ghost:
    "bg-transparent text-brand-700 hover:bg-brand-50 disabled:text-muted",
  outline:
    "bg-surface text-brand-700 border border-border-soft hover:bg-brand-50",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 disabled:bg-danger-50 disabled:text-danger-500",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
});
