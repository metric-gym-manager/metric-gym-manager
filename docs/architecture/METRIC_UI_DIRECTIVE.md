# METRIC — WORKSPACE UI REDESIGN DIRECTIVE

## 0. MANDATE

This is a **visual correction**, not an architectural rewrite and not an open design brief.

The architecture, component hierarchy, token architecture, single-implementation rules, and the five-layer dependency model (Layer 1 → 5) are authoritative and remain intact. `design_system.md` remains authoritative.

The problem being solved is **visual composition and token direction**. Nothing else.

You are not applying your design preferences. You are making the existing system conform to a fixed product identity. Where this directive and your own aesthetic instinct disagree, the directive wins.

**Governing sentence — the actual job:**
**Do not make the existing SaaS UI prettier. Change the visual grammar of the application.**

## 0.1 GOVERNING CONSTRAINTS

Four hard constraints subordinate every other rule in this document. Every decision must satisfy all four.

- **A. STRUCTURAL** — maximum one visual containment layer. See §5.3.
- **B. FUNCTIONAL** — visual redesign only; product functionality remains unchanged. See §4.10.
- **C. AESTHETIC** — dark operational control system; not dark-mode SaaS, not Bloomberg cosplay. See §5.10.
- **D. VERIFICATION** — inspect rendered composition, not tokens/components/code alone. See §9.2.

---

## 1. CURRENT STATE (WHAT IS)

- **Workspace is light; marketing/auth/legal are dark.** This is a brand discontinuity. The app looks like a different product than its own marketing site.
- **Nested-container grammar.** Recurring `page → card → card → tile → badge` and `card-within-card`, `tile-within-card` composition.
- **Floating stat cards.** KPIs presented as four isolated rounded cards.
- **Decorative containment.** Cards used as the default wrapper for every section, chart, table, form group, and metric.
- **Soft visual language.** Large radius, drop shadows, decorative pills, oversized badges, generous padding, low information density.
- **Net effect:** reads as a generic small-business / shadcn SaaS dashboard.

The light workspace is currently defined in the architecture as the App Workspace identity (`[data-theme='light']`). That is a brand decision, not a theme detail, and it is the direct source of the disconnect.

---

## 2. TARGET STATE (WHAT IT MUST BECOME)

A **dark-first operational control system**.

Reference territory: professional operational software, Bloomberg Terminal, enterprise monitoring, financial terminals, aviation/industrial control interfaces, high-end developer infrastructure.

Extract the principles, do not copy the aesthetic:
high information density, strong hierarchy, dark surfaces, hard structural boundaries, precise typography, restrained colour, compact controls, data-first presentation, minimal decoration, persistent system state.

The interface must communicate, before any marketing copy is read:
**PRECISION. CONTROL. DENSITY. AUTHORITY. OPERATIONAL IMPORTANCE. DATA. RELIABILITY. TECHNICAL SERIOUSNESS.**

Positioning claim the UI must make believable:
**"THIS IS THE SOFTWARE THAT RUNS THE BUSINESS."**

Not:
**"THIS IS A NICE DASHBOARD FOR A SMALL BUSINESS."**

---

## 3. PRODUCT IDENTITY (FIXED — NEVER RENEGOTIATE)

Metric is an operational control system for serious gyms.

It is **not** a generic SaaS dashboard, a CRM template, a startup analytics dashboard, a collection of attractive cards, or a consumer app.

Explicitly do **not** produce: a Bloomberg parody, a trading-terminal pastiche, neon/cyberpunk styling, or added visual noise. The corrective move is always structural, never decorative.

---

## 4. ANTI-DRIFT PROTOCOL (READ BEFORE AND DURING EXECUTION)

This section governs how the work is performed. It exists because a long multi-phase visual task predictably degrades: the model substitutes its own taste, reintroduces the banned grammar, invents abstractions, and declares success early. Prevent this.

**4.1 You are correcting, not composing.** Every decision traces back to Section 2/3. If a change is justified only by "it looks nicer," reject it.

**4.2 Re-read Sections 2 and 3 at the start of every phase.** Drift is gradual. Re-anchoring is the countermeasure.

**4.3 Container discipline is the core discipline.** A container exists only when it has a structural purpose. The default is **no container**. Before wrapping anything in a Card, state the structural reason. If you cannot, put the content directly on the page.

**4.4 No new abstractions.** Do not create another design system, token file, Card component, DataTable, radius system, or feature-specific visual primitive (`RevenueCard`, `MemberCard`, `DashboardCard`, etc.). Use existing primitives and composites. The architecture already provides the mechanisms; the task is to use them differently.

**4.5 No hardcoding.** No hardcoded colours, spacing, radius, or typography. If a needed value is absent: add the semantic token → synchronize `tokens.ts`, `globals.css`, `tailwind.config.ts` → consume the token. Never bypass the token system.

**4.6 Preserve the layer model.** Maintain Layer 1 → 2 → 3 → 4 → 5 dependencies. Do not touch the architecture because you disagree with it.

**4.7 Do not confuse mechanism with outcome.** "Dark," "tokens compile," "components consume tokens," "tests pass," "supports both themes" — none of these is completion. Completion is a **material change in perceived product category**.

**4.8 Drift signatures — self-check for these and revert:**

- new component names appearing that wrap single metrics or sections
- cards reappearing as default wrappers after removal
- gradients, shadows, glow, or blur creeping back in
- radius increasing toward "everything is a rounded rectangle"
- layouts optimizing for visual symmetry instead of operational comprehension
- badges/pills returning as the default status treatment
- padding expanding, density decreasing

**4.9 Work the phases in order (Section 8). Do not stop after token changes. Do not stop after the workspace is dark.**

**4.10 Functional preservation.** This is a visual redesign. **Do not change:** business logic, database behavior, API contracts, routes, permissions, authentication, form-submission behavior, data fetching, validation logic, feature functionality, navigation architecture, existing user workflows. **May change:** layout, spacing, hierarchy, surface treatment, typography, colour, density, component composition, visual states. Do not remove functionality because it is visually inconvenient. Functional behavior remains equivalent unless a change is strictly required to implement the visual system. Simplifying the UI does not mean simplifying the product.

---

## 5. DESIGN DECISIONS (SPECIFICS)

### 5.1 Tokens — dark-first, intentionally designed (not an inverted light theme)

Retune semantic relationships so the system reads as designed-for-dark from the start:

- `surface-base` = near-black
- `surface-card` = slightly elevated dark surface
- `surface-panel` = dark operational panel
- `surface-input` = dark input surface
- `ink` = high-contrast light text
- `ink-secondary` = restrained grey
- `ink-muted` = subdued grey
- `borders` = visible but restrained dark hairlines
- `success` = operational green · `warning` = amber · `error/danger` = red · `accent` = restrained blue/indigo

Do not simply invert the light theme. The result must not look like "dark mode was added."

### 5.2 Containment hierarchy

```
LEVEL 0  Application canvas
LEVEL 1  Major page sections
LEVEL 2  Data surfaces / tables / charts / operational regions
LEVEL 3  Individual controls and data points
```

Do not draw a container around every level.

```
BAD                                  GOOD
┌─────────────────────────────┐      REVENUE                    LKR 486,500
│ REVENUE                     │      ──────────────────────────────────────
│ ┌─────────────────────────┐ │      Revenue / trailing 8 months
│ │ ┌────────┐ ┌──────────┐ │ │
│ │ │Revenue │ │ Growth   │ │ │                 chart
│ │ └────────┘ └──────────┘ │ │
│ │        chart            │ │      ──────────────────────────────────────
│ └─────────────────────────┘ │      COLLECTION RATE                  94.2%
└─────────────────────────────┘      OVERDUE EXPOSURE           LKR 92,000
                                      EXPIRING THIS WEEK                  23
```

Information should feel integrated into one operational surface, not piled into boxes.

### 5.3 Container nesting — HARD LIMIT

Operational UI has a **maximum visual containment depth of ONE**.

A bordered or background surface may contain content, but it must **not** contain another bordered/background surface — unless the inner surface is an unavoidable interactive primitive (dropdown, modal, popover, input).

Default composition:

```
Page → Section → Content
Page → Section → Table / Chart / Form / Data
```

Banned:

```
Page → Card → Card → MetricCard
Page → Card → ChartCard
Page → Card → TableCard → DataTable
Page → SettingsCard → SettingsRowCard
Page → DashboardSection → MetricCard
```

Before introducing a second visual boundary inside an existing boundary, prove the inner boundary is a genuinely independent surface. If it is not, remove it. This is the single most-enforced structural rule in the directive (Constraint A).

### 5.4 Cards — exceptions, not defaults

Keep the Card primitive. Change how it is used. Appropriate for: genuinely independent objects, dialogs, isolated configuration blocks, exceptional emphasis, content needing separation. **Not** appropriate for: every KPI, chart, table, section, dashboard module, form group, or piece of information.

### 5.5 KPIs — operational readouts, not floating cards

Replace the four-floating-StatCard pattern with a coherent information band separated by alignment, typography, whitespace, vertical dividers, and hairlines:

```
ACTIVE MEMBERS     REVENUE          OVERDUE              EXPIRING
312                LKR 486,500      14                   23
+9 TODAY           +3.2%            LKR 42,000 EXPOSURE   NEXT 7 DAYS
```

`MetricCard`/`StatCard` may remain, but their visual treatment must support this readout style.

### 5.6 Tables — first-class UI

Tables are a defining characteristic of Metric. Dense, precise, authoritative: compact rows, clear column alignment, strong header hierarchy, tabular/monospace numbers, restrained status indicators, visible row boundaries, sticky headers where appropriate. Avoid giant row padding, oversized badges, excessive avatars, decorative empty space. A table is an instrument for operating the business.

### 5.7 Status — signal, not decoration

Prefer `● ACTIVE` / `● EXPIRED` / `● PAID` (small dot + label) over pill badges. Colour communicates state and stays sparse:
GREEN = healthy/active/success · AMBER = attention/pending/approaching · RED = failure/overdue/critical · BLUE = interactive/selected/system accent.

### 5.8 Typography

Keep Geist / Geist Mono as an information hierarchy.

- **Geist:** page titles, entity names, normal interface text.
- **Geist Mono:** financial values, counts, IDs, timestamps, technical metadata, system status, tabular numbers.
- **Uppercase tracked labels** for system metadata: `MEMBERS`, `REVENUE`, `COLLECTION RATE`, `EXPIRY QUEUE`, `SYSTEM STATUS`, `LAST SYNC`, `TRANSACTIONS`.

Numbers carry authority. Derive hierarchy from precision, alignment, and contrast — not oversized type.

### 5.9 Density (controlled)

Target **controlled** density, not cramped. Compact rows, tighter vertical rhythm, efficient grids, reduced redundant padding, information-rich tables, integrated charts, compact toolbars. Whitespace separates conceptual groups; it does not exist because a card template has padding.

### 5.10 Density does NOT mean clutter

Do not imitate Bloomberg's literal density. Metric is not a financial terminal — use the principles, not the quantity. Every page must retain: a clear primary action, clear page identity, clear hierarchy, readable text, predictable navigation, and adequate breathing room between conceptual groups. Increase density by **removing redundant containers and wasted space**, not by filling every pixel with information. Target **high signal-to-noise**, not maximum information per pixel. The aesthetic is enterprise operational software with Bloomberg-level seriousness — not "Bloomberg for gyms" (Constraint C).

### 5.11 Visual hierarchy

Every screen has an obvious hierarchy:

```
1  PAGE IDENTITY
2  PRIMARY OPERATION / PRIMARY DATA
3  SECONDARY OPERATIONAL DATA
4  SUPPORTING INFORMATION
5  LOW-PRIORITY METADATA
```

Strong contrast only for levels 1–2. Normal contrast for level 3. Restrained contrast for levels 4–5. Do not give equal visual weight to every element; do not make every button, card, badge, number, or heading prominent. Hierarchy comes from position, scale, contrast, alignment, typography, whitespace, and structural boundaries — **not** from colour proliferation, shadows, rounded containers, decorative backgrounds, icons, or gradients.

### 5.12 Borders over shadows

Structure via background contrast, 1px hairlines, stronger section boundaries where needed, selected-state backgrounds, typography, spacing. No drop shadows, floating cards, blur, glassmorphism, gradients, or glowing borders. The interface is structurally assembled, not floating.

### 5.13 Radius

Reduce softness. Use the low end of the existing scale (`none` / `xs` / `sm`) for operational UI. Large rounded containers are exceptional. Do not create a new radius system.

### 5.14 Sidebar

Retheme the existing SideNav as system navigation: dark surface, subtle vertical boundary, compact nav, restrained selected state, small precise icons, strong active-state contrast. Selected item reads as a system state, not a large colourful pill.

### 5.15 Dashboard — operational cockpit

Redesign for comprehension, not symmetry. Approximate hierarchy: system/page identity → critical KPIs → revenue/operational trend → collection/expiry/reminder state → recent transactions/activity → secondary info. It must answer at a glance: active members, money in, outstanding, who is expiring, what needs attention, whether automated systems function, what happened recently.

### 5.16 Charts

Integrate into the information surface. Optional: section heading, metric value, comparison value, chart, axis/grid, concise legend — without a heavy ChartCard. Restrained: no rainbow palettes, decorative gradients, excessive gridlines, or gratuitous animation. The data is the visual.

### 5.17 Empty / low-data states

Empty states preserve the operational character of Metric. Do not use cartoon illustrations, oversized icons, giant centered cards, decorative graphics, or excessive vertical whitespace. Prefer: a concise system label, a short explanation, the relevant primary action, and compact composition inside the existing page structure. An empty operational system should look like an operational system with no current data — not a marketing landing page.

### 5.18 Forms / settings — sections and dividers, not nested cards

```
SETTINGS

GYM INFORMATION
────────────────────────────────────────
Gym name     Titan Fitness
Industry     Fitness
Phone        +94 ...

REGISTRATION
────────────────────────────────────────
...
```

Section headers, dividers, aligned labels and controls — professional configuration software, not nested form cards.

### 5.19 Buttons — action hierarchy

Primary: high-contrast solid. Secondary: structural contrast with border. Ghost: minimal. Destructive: red only for genuinely destructive actions. Not every action is prominent.

### 5.20 Responsive behaviour

The operational visual language must survive across viewport sizes. Desktop Metric and mobile Metric must feel like the same operating system.

Do not solve responsive layouts by stacking every element into cards, converting every row into a floating tile, adding containers solely to create mobile grouping, or dramatically increasing vertical spacing. Those reintroduce the banned grammar under cover of a breakpoint.

On smaller screens: preserve hierarchy, preserve data priority, preserve compactness where it stays readable, collapse secondary information before primary information, allow horizontal scrolling for genuinely tabular data, use drawers/sheets where appropriate, and simplify information presentation without changing its underlying hierarchy. Responsive adaptation preserves the same product identity.

### 5.21 Iconography

Icons are functional indicators, not decoration. Do not add an icon merely to make an element visually interesting.

Use icons for navigation, recognized actions, status, affordances, and information where the icon materially improves comprehension. Do not place an icon beside every heading, KPI, section, label, button, or piece of metadata. Prefer typography and alignment over iconography for hierarchy. Icons remain subordinate to the information they represent. "Serious enterprise UI" must not degrade into "a Lucide icon on everything."

---

## 6. EXPLICITLY BANNED

glassmorphism · excessive gradients · neon/cyberpunk · glow · giant rounded cards · floating card stacks · cards inside cards · tiles inside cards · decorative metric tiles · excessive pill controls · oversized icons · cartoon illustrations · decorative blobs · gratuitous shadows · excessive animation · rainbow charts · dashboard-template symmetry · "modern SaaS" decoration for its own sake.

The solution is never a visual effect. The solution is structural.

---

## 7. ARCHITECTURE CONSTRAINTS (UNCHANGED)

Do not: create another design system, token file, Card, or DataTable; create feature-specific visual primitives; bypass the component architecture; hardcode colours/spacing/radius/typography; restructure the project; introduce new abstractions to implement this direction.

Extend existing tokens and primitives. Missing value → add semantic token → sync `tokens.ts` + `globals.css` + `tailwind.config.ts` → consume. Preserve the Layer 1 → 5 dependency model.

---

## 8. EXECUTION ORDER

1. Audit current token values; identify every token contributing to the soft/generic appearance.
2. Retune semantic dark-workspace tokens.
3. Audit Card, MetricCard, StatCard, ChartCard, Badge, Button, SideNav, Table, DataTable.
4. Remove unnecessary visual containment from the composites.
5. Redesign dashboard composition around operational density.
6. Redesign tables and data surfaces.
7. Redesign settings/forms around section/divider structure.
8. Review every major workspace screen for consistency.
9. Run: `npm run type-check` · `npm run arch:check` · `npm run lint` · `npm test`
10. Visual QA + regression sweep; fix remaining generic-SaaS patterns.

Do not stop after token changes. Do not stop after the workspace is dark. Do not declare success on architectural conformance alone.

---

## 9. VERIFICATION

### 9.1 Visual QA standard (conceptual)

Inspect Dashboard, Members, Revenue, Fees, Announcements, Billing, Settings, Support **as one operating system**, not page by page. Test questions:

- Does the workspace immediately look like serious operational software?
- Does it belong to the same brand as the dark marketing site?
- Information-dense without chaos?
- Are cards structural exceptions, not default containers?
- Are tables and data first-class?
- Is colour a signal, not decoration?
- Does it feel precise rather than friendly?
- Does the dashboard feel like a control surface, not a card collection?
- Would it make sense for a multi-branch gym with thousands of members and substantial monthly revenue?
- Does anything still look like a generic shadcn/SaaS dashboard?

If the last answer is yes, keep refining.

### 9.2 Visual regression sweep (concrete — Constraint D)

Reading the QA questions and answering "yes" is not verification. Perform a repository-wide composition audit. Search for and inspect every use of:

- `Card`, `MetricCard`, `StatCard`, `ChartCard`, `Badge`
- rounded-container utilities
- shadow utilities
- gradient utilities
- excessive padding
- nested bordered surfaces
- nested background surfaces

Identify every occurrence where the old visual grammar remains. Changing a shared primitive does **not** automatically fix composition — a page can use the correct primitive while still composing it incorrectly. Audit the actual rendered composition of every major workspace screen, not merely the component styling.

### 9.3 AI-dashboard smell test (adversarial — run last)

Before declaring completion, inspect the UI specifically for the patterns generic AI-generated SaaS interfaces produce:

- four or six identical KPI cards across the top
- every section enclosed in a rounded rectangle
- icon + heading + description repeated everywhere
- excessive badges
- excessive avatars
- symmetrical dashboard grids
- equal-sized content modules
- unnecessary "Overview" cards
- large empty areas inside containers
- decorative statistics
- excessive blue as an accent
- repeated rounded buttons
- generic "modern SaaS" visual hierarchy

**The test:** if removing the branding and product name would make the interface indistinguishable from an AI-generated SaaS dashboard, the redesign has failed. The UI must carry a distinct Metric visual grammar.

---

## 10. DEFINITION OF DONE

Complete only when the **visual hierarchy has materially changed** and the perceived product category has moved:

FROM: generic modern SaaS dashboard
TO: premium dark operational control system.

Not complete merely because the app is dark, tokens compile, components consume tokens, tests pass, or both themes are technically supported.

---

## APPENDIX — CANONICAL WORKSPACE THEME (CORRECTION TO `design_system.md`)

The workspace theme assignment is a **brand decision**, not a theme-implementation detail. The current contract (`Workspace = light`, `Marketing/Auth/Legal = dark`) is a primary cause of the disconnect. Replace it with the following.

**The canonical Metric Workspace experience is DARK.** `data-theme="dark"` is the default workspace theme.

Light theme support may remain technically available for accessibility, user preference, or future requirements, but light is **not** the canonical visual identity of the workspace. Do not allow system or browser preference to silently render the default Metric Workspace in light. If a user-selectable light mode is retained, dark remains the product's visual default.

```
Workspace = dark-first operational environment (canonical: data-theme="dark")
Marketing = dark
Auth      = dark
Legal     = dark

Light     = supported theme variant, if retained —
            NOT the defining Metric Workspace identity.
```

Marketing, Auth, Legal, and Workspace therefore share one dark-first brand language.
