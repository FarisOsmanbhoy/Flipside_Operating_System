import { initials } from "@/lib/format";
import { cn } from "@/lib/format";

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };
  if (src) {
    return (
      // Using <img> not next/image because Storage hosts vary.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        style={dimension}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      style={dimension}
      className={cn(
        "rounded-full bg-brand-100 text-brand-700 font-semibold inline-flex items-center justify-center text-sm",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
