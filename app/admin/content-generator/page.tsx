import { requireAdmin } from "@/lib/auth";
import ContentGeneratorClient from "./content-generator-client";

export const dynamic = "force-dynamic";

export default async function ContentGeneratorPage() {
  await requireAdmin();

  return <ContentGeneratorClient />;
}
