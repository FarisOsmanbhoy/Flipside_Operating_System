import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";

export default function TrainingStubPage() {
  return (
    <>
      <PageHeader
        title="Training"
        actions={<Pill tone="warning">Coming soon</Pill>}
      />
      <Card>
        <EmptyState
          title="Training module is on the roadmap"
          description="Training modules, completion tracking, and renewal reminders per staff member."
        />
      </Card>
    </>
  );
}
