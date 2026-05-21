import Image from "next/image";
import { Card } from "@/components/ui/Card";

export function BrandCard() {
  return (
    <Card className="p-5 flex items-center justify-center">
      <Image
        src="/brand/logo.jpg"
        alt="FlipSide"
        width={180}
        height={60}
        className="object-contain h-12 w-auto"
        priority
      />
    </Card>
  );
}
