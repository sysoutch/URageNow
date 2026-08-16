import { renderDashboardScheduledAutomationPanel } from "./automationScheduledPanel.js";
import { renderDashboardJoinAutomationPanel } from "./automationJoinPanel.js";

interface DashboardAutomationViewInput {
  model3dInitialThreadExtraText: string;
  model3dDestinationExtraText: string;
}

export function renderDashboardAutomationView(input: DashboardAutomationViewInput): string {
  return `
      <section class="view" data-view-panel="automation">
        <article class="panel-card feature-card automation-overview-card">
          <div class="panel-heading">
            <div class="panel-kicker">Automation Control Room</div>
            <h3>Automations</h3>
            <div class="panel-subtitle">Manage recurring jobs, join follow-ups, and media posting workflows with the same posting options you use manually.</div>
          </div>
        </article>
        <div class="dashboard-tabs">
          <button class="ghost active" data-automation-panel="scheduled">Scheduled Posts</button>
          <button class="ghost" data-automation-panel="join" data-discord-only="true">Join Follow-Ups</button>
        </div>
${renderDashboardScheduledAutomationPanel(input)}
${renderDashboardJoinAutomationPanel()}
      </section>`;
}
