type Stat = { label: string; value: number };

type Props = {
  stats: Stat[];
};

export function StatCards({ stats }: Props) {
  return (
    <div className="profile-sidebar-card">
      <h3 className="profile-sidebar-card__title">Activity</h3>
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-grid__item">
            <span className="stat-grid__value">{s.value}</span>
            <span className="stat-grid__label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
