import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";

export default function SuggestionsStubPage() {
  return (
    <>
      <PageHeader
        title="Suggestions & Feedback"
        actions={<Pill tone="warning">Coming soon</Pill>}
      />
      <Card>
        <EmptyState
          title="Suggestions inbox is on the roadmap"
          description="A lightweight feedback channel for staff to submit ideas and ratings without leaving the ops tool."
        />
      </Card>
    </>
  );
}
