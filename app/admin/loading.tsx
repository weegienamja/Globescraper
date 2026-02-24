import { SkeletonCards, SkeletonTable } from "@/components/SkeletonLoader";

export default function LoadingAdmin() {
  return (
    <div className="admin">
      <div
        className="skeleton skeleton-heading"
        style={{ width: "40%", marginBottom: 28 }}
      />
      <SkeletonCards count={5} />
      <div style={{ marginTop: 32 }}>
        <div
          className="skeleton skeleton-heading"
          style={{ width: "30%", marginBottom: 12 }}
        />
        <SkeletonTable rows={5} cols={5} />
      </div>
      <div style={{ marginTop: 32 }}>
        <div
          className="skeleton skeleton-heading"
          style={{ width: "30%", marginBottom: 12 }}
        />
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  );
}
