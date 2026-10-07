import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Stepper } from "../src/components/stepper";

/**
 * HeroUI Pro's Stepper: the rail of a multi-step flow. Business registration
 * is the reference use; its steps are the wizard's own.
 */
const STEPS = [
  { title: "You", description: "Your name and ID" },
  { title: "Business", description: "TIN and licence" },
  { title: "Documents", description: "Upload once" },
  { title: "Review and pay", description: "Sign and pay the fee" },
];

const meta = {
  title: "Pro/Stepper",
  component: Stepper,
} satisfies Meta;

// A compound component whose children ARE the story, so these stories take no
// args and say so (the Card story uses the same idiom).
export default meta;
type Story = StoryObj;

function Registration({ orientation }: { orientation?: "horizontal" | "vertical" }) {
  const [step, setStep] = useState(1);
  return (
    <Stepper currentStep={step} onStepChange={setStep} orientation={orientation}>
      {STEPS.map((s) => (
        <Stepper.Step key={s.title}>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>{s.title}</Stepper.Title>
            <Stepper.Description>{s.description}</Stepper.Description>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      ))}
    </Stepper>
  );
}

/** The registration rail, second step in progress. */
export const RegistrationRail: Story = {
  render: () => (
    <div className="max-w-wide">
      <Registration />
    </div>
  ),
};

/** On a phone the rail runs down the side. */
export const Vertical: Story = {
  render: () => (
    <div className="max-w-tile">
      <Registration orientation="vertical" />
    </div>
  ),
};
