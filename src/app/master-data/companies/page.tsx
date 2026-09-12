import { PageHeader } from "@/components/ui/page-header";
import { CompaniesTable } from "@/components/master-data/companies-table";

export default function CompaniesPage() {
  return (
    <div>
      <PageHeader
        title="Companies"
        description="The brands you claim against. Each settles separately, so bags and dispatches never mix companies."
      />
      <CompaniesTable />
    </div>
  );
}
