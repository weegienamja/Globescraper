import { RELOCATION_STAGES } from "@/lib/validations/community";

type Props = {
  currentStageIndex: number;
};

export function RelocationStepper({ currentStageIndex }: Props) {
  return (
    <div className="profile-section">
      <h2 className="profile-section__title">Relocation Journey</h2>
      <div className="stepper">
        <div className="stepper__track">
          {RELOCATION_STAGES.map((stage, i) => (
            <div
              key={stage.value}
              className={`stepper__step ${
                i < currentStageIndex
                  ? "stepper__step--completed"
                  : i === currentStageIndex
                    ? "stepper__step--active"
                    : "stepper__step--upcoming"
              }`}
            >
              <div className="stepper__dot" />
              {i < RELOCATION_STAGES.length - 1 && (
                <div
                  className={`stepper__line ${
                    i < currentStageIndex ? "stepper__line--filled" : ""
                  }`}
                />
              )}
              <span className="stepper__label">{stage.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
