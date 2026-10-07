import type { Meta, StoryObj } from "@storybook/react-vite";
import { BedDouble, CalendarCheck, LogOut, Wallet } from "lucide-react";
import { KPI, KPIGroup } from "../src/components/kpi";

/**
 * HeroUI Pro's KPI: one figure with its title, icon, trend and an optional
 * progress bar or sparkline; KPIGroup lays several out as one strip. The
 * operator app's Today strip is the reference use. Sample figures only.
 */
const meta = {
  title: "Pro/KPI",
  component: KPI,
} satisfies Meta;

// A compound component whose children ARE the story, so these stories take no
// args and say so (the Card story uses the same idiom).
export default meta;
type Story = StoryObj;

/** The Today strip an owner opens on: four figures, one glance. */
export const TodayStrip: Story = {
  render: () => (
    <div className="max-w-page">
      <KPIGroup>
        <KPI>
          <KPI.Header>
            <KPI.Icon status="success">
              <BedDouble aria-hidden />
            </KPI.Icon>
            <KPI.Title>Rooms filled tonight</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value maximumFractionDigits={0} style="percent" value={0.64} />
            <KPI.Trend trend="up">+8%</KPI.Trend>
          </KPI.Content>
          <KPI.Progress status="success" value={64} />
        </KPI>
        <KPIGroup.Separator />
        <KPI>
          <KPI.Header>
            <KPI.Icon>
              <CalendarCheck aria-hidden />
            </KPI.Icon>
            <KPI.Title>Arriving today</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={2} />
          </KPI.Content>
        </KPI>
        <KPIGroup.Separator />
        <KPI>
          <KPI.Header>
            <KPI.Icon status="warning">
              <LogOut aria-hidden />
            </KPI.Icon>
            <KPI.Title>Leaving today</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value value={6} />
          </KPI.Content>
        </KPI>
        <KPIGroup.Separator />
        <KPI>
          <KPI.Header>
            <KPI.Icon status="danger">
              <Wallet aria-hidden />
            </KPI.Icon>
            <KPI.Title>Owed at check out</KPI.Title>
          </KPI.Header>
          <KPI.Content>
            <KPI.Value currency="RWF" maximumFractionDigits={0} style="currency" value={1059060} />
          </KPI.Content>
        </KPI>
      </KPIGroup>
    </div>
  ),
};

/** A revenue card with its trend line: this month, per day. */
export const WithSparkline: Story = {
  render: () => (
    <div className="max-w-tile">
      <KPI>
        <KPI.Header>
          <KPI.Title>Room revenue this month</KPI.Title>
        </KPI.Header>
        <KPI.Content>
          <KPI.Value currency="RWF" maximumFractionDigits={0} notation="compact" style="currency" value={14820000} />
          <KPI.Trend trend="up">+12%</KPI.Trend>
        </KPI.Content>
        <KPI.Chart
          data={[320, 410, 380, 520, 610, 580, 690, 720, 650, 810].map((value, day) => ({ day, value }))}
          dataKey="value"
        />
      </KPI>
    </div>
  ),
};
