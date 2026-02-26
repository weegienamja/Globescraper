"use client";

/**
 * OptionCards: display 3 AI-generated template options for selection.
 */

interface TemplateOption {
  id: string;
  templateId: string;
  optimizedSubject: string;
  optimizedPreviewText: string;
  blocks: { type: string; fields: Record<string, unknown> }[];
  notes: { angle: string; whoItsFor: string; recommendedAudience: string };
}

interface Props {
  options: TemplateOption[];
  selectedId: string | null;
  onSelect: (option: TemplateOption) => void;
}

const templateLabels: Record<string, string> = {
  welcome_v1: "Welcome",
  news_alert_v1: "News Alert",
  weekly_digest_v1: "Weekly Digest",
  visa_update_v1: "Visa Update",
  new_places_v1: "New Places",
};

export function OptionCards({ options, selectedId, onSelect }: Props) {
  if (options.length === 0) return null;

  return (
    <div className="em-options">
      <h4 className="em-options__title">Choose a Content Option</h4>
      <div className="em-options__grid">
        {options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          const heroBlock = opt.blocks.find((b) => b.type === "hero");
          const ctaBlock = opt.blocks.find((b) => b.type === "cta");
          const headline = (heroBlock?.fields?.headline as string) || "";
          const intro = (heroBlock?.fields?.intro as string) || "";
          const ctaText = (ctaBlock?.fields?.ctaText as string) || "";

          return (
            <button
              key={opt.id}
              className={`em-option-card ${isSelected ? "em-option-card--selected" : ""}`}
              onClick={() => onSelect(opt)}
            >
              <div className="em-option-card__header">
                <span className="em-option-card__num">Option {idx + 1}</span>
                <span className="em-option-card__template">
                  {templateLabels[opt.templateId] || opt.templateId}
                </span>
              </div>
              <p className="em-option-card__subject">{opt.optimizedSubject}</p>
              {headline && (
                <p className="em-option-card__headline">{headline}</p>
              )}
              {intro && (
                <p className="em-option-card__intro">
                  {intro.length > 120 ? intro.slice(0, 120) + "..." : intro}
                </p>
              )}
              {ctaText && (
                <span className="em-option-card__cta">{ctaText}</span>
              )}
              <div className="em-option-card__notes">
                <span className="em-option-card__angle">
                  <strong>Angle:</strong> {opt.notes.angle}
                </span>
                <span className="em-option-card__who">
                  <strong>For:</strong> {opt.notes.whoItsFor}
                </span>
              </div>
              {isSelected && (
                <div className="em-option-card__check">&#10003;</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
