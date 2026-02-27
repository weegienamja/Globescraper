type Props = {
  title: string;
  chips: string[];
  variant?: "default" | "accent";
};

export function Chips({ title, chips, variant = "default" }: Props) {
  if (chips.length === 0) return null;

  return (
    <div className="profile-section">
      <h2 className="profile-section__title">{title}</h2>
      <div className="chip-row">
        {chips.map((chip) => (
          <span key={chip} className={`chip ${variant === "accent" ? "chip--accent" : ""}`}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
