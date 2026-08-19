# Silaer — Design System & Product Strategy Master Specification
**Standard:** Enterprise SaaS Product Standard • **Status:** Active Reference • **Design Architecture:** Tier-1 Commercial Product

---

## 01. Product Strategy & Commercial Positioning

### 1.1 Target Persona & Mental Model
* **The User:** B2B Founders, Heads of Growth, Enterprise SDRs, and Growth Engineers who operate revenue outbound.
* **Their Stakes:** Their primary email domains, IP reputation, customer relationships, and revenue pipeline.
* **The Core Frustration:** Existing tools (Apollo, Instantly, Lemlist) are cluttered, unpredictable, have silent rate-limit bans, and send awkward follow-ups after prospects have already replied.
* **What Silaer Delivers:** Total deterministic control. Cold email engineered with the precision of a high-frequency trading terminal.

### 1.2 The 3-Second Comprehension Rule
When an operator opens Silaer, they must answer three questions in under 3 seconds:
1. **System State:** Are my connected email inboxes healthy and actively sending?
2. **Action Required:** Did any prospect reply or require manual review today?
3. **Operational Velocity:** How many emails are queued, sent, and delivered today?

### 1.3 Target Emotion
**Unshakeable Trust, Calm Control, and Precision.** The product never uses hype language or frivolous visual distractions.

---

## 02. UX Architecture & Information Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                           SILAER UX ARCHITECTURE                            │
├───────────────────┬─────────────────────────────────────────────────────────┤
│ GLOBAL NAVIGATION │ [Sidebar: Logo → Dashboard → Prospects → Sequences      │
│ (Persistent Left) │  → Smart Import → Timeline → Replies → Admin Settings]  │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ EXECUTIVE COCKPIT │ [Header: Inbox Connection Status | Reputation Gauge |   │
│ (Top Global Bar)  │  Quick Add Prospect | Cmd+K Command Palette | User]     │
├───────────────────┴─────────────────────────────────────────────────────────┤
│ WORKSPACE CONTENT AREA (Max-Width 1280px / 7xl Bound)                       │
│                                                                             │
│  Level 1: Page Header + Primary Single Action                               │
│  Level 2: High-Signal Metrics (4 Key Indicators)                            │
│  Level 3: Operational Working Surface (Data Table / Sequence Flow / Logs)   │
└─────────────────────────────────────────────────────────────┘
```

### Primary User Journeys
1. **The Outreach Setup Flow:** Add Prospect → Set Manually Verified Timezone → Compose 1–4 Step Sequence → Review Schedule → Activate.
2. **The Autonomous Execution Loop:** Scheduler claims due step → Gmail OAuth dispatches → Immutable audit event logged → Inbox polled.
3. **The Intelligent Reply Halt Flow:** Prospect replies → Gemini classifies intent (`REAL_REPLY`, `OUT_OF_OFFICE`, etc.) → Sequence terminates immediately → User notified.

---

## 03. Design Tokens & Foundations

### 3.1 Spatial Scale (Strict 8-Point Grid)
Every margin, padding, and gap in the interface maps to this discrete scale:

| Token | Pixels | Use Case |
| :--- | :--- | :--- |
| `space-1` | 4px | Micro padding, badge internal spacing |
| `space-2` | 8px | Icon-to-text gap, input vertical padding |
| `space-3` | 12px | Compact item gaps, nested elements |
| `space-4` | 16px | Standard component padding, table cell padding |
| `space-6` | 24px | Card and panel padding, section separation |
| `space-8` | 32px | Major view headers, grid row gaps |
| `space-12`| 48px | Top-level view margins |

---

### 3.2 Surface Hierarchy System (Anti-Shadow Separation)

We do NOT place a heavy drop shadow on every element to separate it. We use **Surface Stepping**:

```
Level 0: Canvas Background (Light: #F8FAFC / Dark: #09090B)
  ↳ Level 1: Primary Surface (Cards, Tables, Panels - Light: #FFFFFF / Dark: #121215)
      ↳ Level 2: Secondary Inset (Form inputs, code blocks - Light: #F1F5F9 / Dark: #18181B)
          ↳ Level 3: Elevated Overlays (Dropdowns, Command Palette, Modals - Light: #FFFFFF / Dark: #1E1E24)
```

---

### 3.3 The Visible 1px Border Rule (Anti-Ghost Borders)
* **Standard Border:** 1px solid with visible, calibrated contrast (`border-zinc-200` in light mode, `border-zinc-800` in dark mode).
* **Interactive Border:** Transitions to `border-zinc-400` / `border-zinc-600` on hover.
* **Focus Ring:** 2px solid offset ring (`focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100`).
* **Rule:** NEVER use hyper-transparent borders (e.g. `border-white/5` or `border-black/5`) that disappear on calibrated monitors.

---

### 3.4 Typography Scale (Plus Jakarta Sans + Space Mono)

| Style Token | Font Family | Size / Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `Display` | Plus Jakarta Sans | 28px / 34px | 700 (Bold) | Top view title, auth header |
| `H1 / Section`| Plus Jakarta Sans | 20px / 26px | 600 (Semibold)| Section titles, modal headers |
| `H2 / Card` | Plus Jakarta Sans | 15px / 22px | 600 (Semibold)| Component titles, table headers |
| `Body` | Plus Jakarta Sans | 14px / 20px | 400 (Regular) | Primary readable content |
| `Small` | Plus Jakarta Sans | 12px / 16px | 500 (Medium)  | Helper text, metadata |
| `Mono-Data`| Space Mono | 12px / 16px | 400/700 (Mono) | Timestamps, emails, thread IDs |

---

### 3.5 Strategic Color Token Matrix

```
[ NEUTRAL BASE 90% ]
Light: Canvas #F8FAFC | Surface #FFFFFF | Text-Primary #0F172A | Text-Muted #64748B
Dark:  Canvas #09090B | Surface #121215 | Text-Primary #F8FAFC | Text-Muted #A1A1AA

[ SIGNAL ACCENTS 10% ]
• Emerald (Deliverability/Active): #16A34A (Light) / #22C55E (Dark)
• Indigo (System/Processing):     #4F46E5 (Light) / #6366F1 (Dark)
• Amber (Throttled/Warning):      #D97706 (Light) / #F59E0B (Dark)
• Rose (Failed/Cancelled):        #E11D48 (Light) / #F43F5E (Dark)
```

---

## 04. Component Standards & Anti-Card-Soup Policy

### 4.1 Anti-Card-Soup Rule (Rule 06 Enforcement)
Do NOT wrap every heading, search input, and filter inside separate nested rounded cards.

* **Incorrect (Card-Soup):**
  `Outer Card > Search Card > Filter Card > Table Card > Row Card`
* **Correct (Systemic Hierarchy):**
  Clean canvas surface → Top title with direct whitespace → Inline toolbar (Search + Filters on canvas) → Single structured Data Table container.

---

### 4.2 Master Component Rules

#### Buttons
* **Primary:** High-contrast solid (`bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900`), 8px radius, snappy hover (`active:scale-[0.98]`).
* **Secondary / Outline:** 1px border (`border-zinc-300 dark:border-zinc-700 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800`).
* **Ghost / Subdued:** Transparent background, `hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300`.
* **Destructive:** `bg-rose-600 text-white hover:bg-rose-700`.

#### Status Badges (Deterministic Pills)
* Status is never communicated by color alone; always paired with explicit text and an icon or pulse indicator.
* Format: `px-2 py-0.5 rounded-md text-[11px] font-semibold border`.
  - `ACTIVE`: `bg-emerald-500/10 text-emerald-600 border-emerald-500/20`
  - `PROCESSING`: `bg-indigo-500/10 text-indigo-600 border-indigo-500/20`
  - `FAILED`: `bg-rose-500/10 text-rose-600 border-rose-500/20`
  - `PAUSED`: `bg-amber-500/10 text-amber-600 border-amber-500/20`

#### Data Tables
* Sticky headers with `text-[11px] font-bold uppercase tracking-wider text-muted-foreground`.
* Row hover: `hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-100`.
* Fixed-width data (emails, dates) rendered in `Space Mono`.

---

## 05. Interaction, Motion & UX Psychology

### 5.1 Purposeful Motion (150ms–220ms)
* **Entrance Transitions:** Subtle opacity + 4px Y-translation (`duration: 0.18s, ease: "easeOut"`). No bouncing or rubber-banding.
* **Micro-Interactions:** Buttons depress on click (`active:scale-[0.98]`).
* **Loading States:** Skeleton loaders that softly pulse (`animate-pulse bg-zinc-200 dark:bg-zinc-800`), avoiding spinning wheel clutter on fast networks.

### 5.2 Momentum & Empty States
An empty state must **teach and unblock**:
```
┌─────────────────────────────────────────────────────────────┐
│                       [ Lucide Icon ]                       │
│                   No Active Sequences Found                 │
│                                                             │
│  Sequences allow you to schedule multi-step email outreach  │
│  that automatically halts when prospects reply.             │
│                                                             │
│                   [ + Create First Sequence ]               │
└─────────────────────────────────────────────────────────────┘
```

---

## 06. Design QA & "AI-Generated UI" Elimination Checklist

Before any view or component is committed, it is audited against the **15 AI-SaaS Anti-Patterns**:

| Anti-Pattern | Status | Silaer Enforcement |
| :--- | :---: | :--- |
| **Card inside card inside card** | ❌ BANNED | Replaced by whitespace, clean dividers, and table surfaces. |
| **Hyper-transparent ghost borders (`/5`)** | ❌ BANNED | Replaced with deliberate 1px calibrated borders (`/60` to `/100`). |
| **Unnecessary rainbow gradients** | ❌ BANNED | Replaced with solid monochrome surfaces and discrete emerald accents. |
| **Floating decorative blur orbs** | ❌ BANNED | Clean, flat, high-performance canvas backgrounds. |
| **Robotic error toasts ("Error 500")** | ❌ BANNED | Replaced with actionable human copy ("Gmail OAuth expired → Reconnect"). |
| **Senseless animation / bouncing** | ❌ BANNED | Replaced with 180ms utilitarian state transitions. |
| **Unreadable tiny gray text** | ❌ BANNED | Enforces WCAG AAA contrast (minimum 4.5:1 ratio on all labels). |
| **Excessive icon decorating** | ❌ BANNED | Icons only present when clarifying semantic meaning. |

---

## 07. Governance & Architectural Authority

This document defines the **Product & Design Standard** for Silaer. Every pull request, UI component, and layout refinement must adhere to this system to guarantee commercial credibility, visual serenity, and software longevity.
