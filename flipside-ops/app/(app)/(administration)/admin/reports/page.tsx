import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";

export default function ReportsStubPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        actions={<Pill tone="warning">Coming soon</Pill>}
      />
      <Card>
        <EmptyState
          title="Reports module is on the roadmap"
          description="Saved queries, scheduled exports, and an overview of activity across clients, tasks, and staff."
        />
      </Card>
    </>
  );
}
