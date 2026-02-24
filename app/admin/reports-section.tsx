import { prisma } from "@/lib/prisma";
import { AdminReportActions } from "./admin-report-actions";

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment",
  SCAM: "Scam",
  OTHER: "Other",
};

export async function ReportsSection() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      reporter: {
        select: { name: true, email: true },
      },
    },
  });

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">Recent Reports</h2>
      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reporter</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="admin__td-date">{fmtDate(r.createdAt)}</td>
                <td>
                  <strong>{r.reporter.name || "—"}</strong>
                  <br />
                  <span className="admin__sub-text">{r.reporter.email}</span>
                </td>
                <td>
                  <span className="admin__badge">{r.targetType}</span>
                </td>
                <td>
                  <span className={`admin__badge admin__badge--${r.reason === "HARASSMENT" || r.reason === "SCAM" ? "warn" : "user"}`}>
                    {REASON_LABELS[r.reason] ?? r.reason}
                  </span>
                </td>
                <td className="admin__sub-text" style={{ maxWidth: 200 }}>
                  {r.details ? (r.details.length > 80 ? r.details.slice(0, 80) + "…" : r.details) : "—"}
                </td>
                <td>
                  <AdminReportActions
                    reportId={r.id}
                    targetType={r.targetType as "USER" | "MEETUP"}
                    targetId={r.targetId}
                  />
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state__icon">🛡️</div>
                    <p className="empty-state__title">No reports</p>
                    <p className="empty-state__text">Community reports will appear here.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
