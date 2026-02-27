import { requireAdmin } from "@/lib/auth";
import { RentalPipelineDashboard } from "@/components/tools/RentalPipelineDashboard";

export const dynamic = "force-dynamic";

export default async function RentalsToolPage() {
  await requireAdmin();

  return <RentalPipelineDashboard />;
}
