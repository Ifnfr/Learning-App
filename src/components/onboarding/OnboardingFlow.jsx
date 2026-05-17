import { useState } from 'react';
import WelcomeStep from './WelcomeStep';
import ExamDateStep from './ExamDateStep';
import DiagnosticStep from './DiagnosticStep';
import StudyPlanPreview from './StudyPlanPreview';

const TOTAL_STEPS = 4;

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);

  function handleNext() {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }

  const steps = [
    <WelcomeStep key="welcome" onNext={handleNext} />,
    <ExamDateStep key="examdate" onNext={handleNext} />,
    <DiagnosticStep key="diagnostic" onNext={handleNext} />,
    <StudyPlanPreview key="studyplan" onNext={handleNext} />,
  ];

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{
              background: i === currentStep ? 'var(--gold)' : i < currentStep ? 'var(--gold-soft)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {steps[currentStep]}
      </div>
    </div>
  );
}
