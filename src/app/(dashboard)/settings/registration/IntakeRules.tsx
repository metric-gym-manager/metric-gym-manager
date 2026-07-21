'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Panel, PanelHead } from '@/components/workspace/primitives';

/**
 * Intake rules — DESIGN-ONLY (feature gap). The App Workspace design exposes
 * "auto-approve registrations" and a "default plan on sign-up" for the QR
 * self-registration flow. Neither is backed by a persisted gym setting today
 * (self-registrations currently land unverified and are approved via
 * POST /api/members/[id]/verify). These controls are dead-code frontend so the
 * design is complete; wiring them requires new settings columns + an endpoint.
 * See docs/architecture/feature-gaps-app-workspace.md.
 */
export default function IntakeRules() {
  const [autoApprove, setAutoApprove] = useState(false);

  return (
    <Panel style={{ overflow: 'hidden' }}>
      <PanelHead label="Intake rules" />
      <div className="mws-row">
        <div>
          <div className="mws-row-title">Auto-approve registrations</div>
          <div className="mws-row-sub">Skip manual review — new sign-ups go straight to active</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoApprove}
          aria-label="Auto-approve registrations"
          onClick={() => setAutoApprove((v) => !v)}
          className={cn('mws-toggle', autoApprove && 'mws-toggle-on')}
        >
          <span className="mws-toggle-knob" />
        </button>
      </div>
      <div className="mws-row">
        <div>
          <div className="mws-row-title">Default plan on sign-up</div>
          <div className="mws-row-sub">Pre-selected when a member self-registers</div>
        </div>
        <select className="mws-select" style={{ width: 200 }} defaultValue="monthly" disabled>
          <option value="monthly">Monthly</option>
          <option value="3-months">3 Months</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--mws-b1)' }}>
        <span className="mws-mono" style={{ fontSize: 11, color: 'var(--mws-t3)' }}>
          PREVIEW · NOT YET SAVED — INTAKE AUTOMATION IS ON THE ROADMAP
        </span>
      </div>
    </Panel>
  );
}
