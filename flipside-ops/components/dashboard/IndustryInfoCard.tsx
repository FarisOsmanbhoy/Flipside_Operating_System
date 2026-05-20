import { Newspaper } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export function IndustryInfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper size={16} className="text-brand-700" />
          Industry info
        </CardTitle>
        <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
          Live feed
        </span>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-muted">
          Aviation industry headlines and notices will surface here as the
          ingestion pipeline comes online.
        </p>
        <button
          type="button"
          disabled
          className="text-xs font-medium text-brand-700 disabled:text-muted disabled:cursor-not-allowed"
        >
          Read more →
        </button>
      </CardBody>
    </Card>
  );
}
