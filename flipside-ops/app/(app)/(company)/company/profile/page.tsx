import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";

export default function CompanyProfileStubPage() {
  return (
    <>
      <PageHeader
        title="Company Profile"
        actions={<Pill tone="warning">Coming soon</Pill>}
      />
      <Card>
        <EmptyState
          title="Company Profile is on the roadmap"
          description="This will hold company-wide details (legal name, addresses, certifications). Drop a request in feedback if you need it sooner."
        />
      </Card>
    </>
  );
}
