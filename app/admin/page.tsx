import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  noStore();
  let leads = [];
  try {
    leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  } catch (err) {
    console.error("[/admin] Prisma error:", err);
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Admin crashed</h1>
        <p><b>Error:</b> {String(err)}</p>
      </div>
    );
  }
  return (
    <div>
      <h1>Leads</h1>
      <p className="small">Newest first. Basic Auth protects this route.</p>
      {leads.length === 0 ? (
        <div className="card">No leads yet.</div>
      ) : (
        leads.map((l) => (
          <div key={l.id} className="card">
            <div className="small">{new Date(l.createdAt).toISOString()}</div>
            <div><strong>{l.email}</strong>{l.name ? ` — ${l.name}` : ""}</div>
            {l.source ? <div className="small">Source: {l.source}</div> : null}
            {l.message ? <p style={{ whiteSpace: "pre-wrap" }}>{l.message}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}
