# 🏛️ SILAER 10X: EXECUTIVE LEAD TELEMETRY & ACTIVITY AUDIT REPORT (6 PHASES)

## 🎯 Master Objective
Upgrade the Silaer Agency & Client Reporting System from abstract totals into an **executive-grade Lead Telemetry & Activity Audit Log**. Every report provides unquestionable proof of outreach activity (recipient, sending inbox, lead timezone, dispatched time, opened time, replied time, and live status) both on the web and via 1-click direct vector PDF download (`www.silaer.com`).

---

### 🔹 PHASE 1: Lead Telemetry Data Aggregation Schema & Engine
* **Status**: `[ ] Pending`
* **Purpose**: Query and aggregate fine-grained prospect journey telemetry (recipient, sender inbox, recipient timezone, step timestamps, open timestamps, reply timestamps) from Prisma models (`Prospect`, `Sequence`, `SequenceStep`, `TrackedEmail`).
* **Files Affected**:
  * `[MODIFY]` `src/lib/reports/types.ts` (Add `ReportLeadActivity` and update `ClientReportData`)
  * `[MODIFY]` `src/lib/reports/aggregator.ts` (Build lead telemetry query engine)
* **Strict Invariant Rules**:
  * Passwords, OAuth tokens, and internal database IDs are strictly excluded from output.
  * Correctly maps `first_opened_at`, `open_count`, and `replied_at` from `TrackedEmail` records.
  * Fallbacks gracefully if tracking pixels or sequence steps are pending.
* **Verification & Exit Gate 1**:
  * Unit tests pass in `src/lib/reports/__tests__/aggregator.test.ts` verifying all fields (`recipientEmail`, `senderInbox`, `leadTimezone`, `dispatchedAt`, `openedAt`, `repliedAt`, `status`).

---

### 🔹 PHASE 2: At-a-Glance Executive Hero Metric Ribbon
* **Status**: `[ ] Pending`
* **Purpose**: Provide a clean, minimal 3-card hero summary (Contacted Leads, Open Rate %, Confirmed Response Rate %) at the top of the report.
* **Files Affected**:
  * `[MODIFY]` `src/components/reports/ClientReportCard.tsx`
* **Strict Invariant Rules**:
  * Minimalist, monochrome/slate executive styling (no loud rainbow badges).
  * High-contrast typography with clear metric labels.
* **Verification & Exit Gate 2**:
  * Component renders clean hero metrics with zero layout shift or visual clutter.

---

### 🔹 PHASE 3: Interactive Web Lead Telemetry & Activity Audit Table
* **Status**: `[ ] Pending`
* **Purpose**: Render a high-trust, responsive activity audit table showing every lead's real-time journey.
* **Files Affected**:
  * `[NEW]` `src/components/reports/LeadActivityTable.tsx`
* **Strict Invariant Rules**:
  * Table columns:
    1. **Recipient**: Prospect email
    2. **Sending Inbox**: Inbox that dispatched the email
    3. **Lead Timezone**: Timezone (e.g. `America/New_York`)
    4. **Dispatched At**: Exact date & local timestamp
    5. **Opened At**: Exact open time + open count badge
    6. **Replied At**: Exact reply timestamp + response badge
    7. **Status**: `🟢 Replied` / `🟣 Opened` / `🔵 Delivered` / `⏱️ Scheduled`
  * Clean pagination or scroll for campaigns with many prospects.
* **Verification & Exit Gate 3**:
  * Verified table renders accurately in desktop, tablet, and mobile views.

---

### 🔹 PHASE 4: Direct Vector PDF Generator with Complete Audit Table
* **Status**: `[ ] Pending`
* **Purpose**: Generate crisp vector single-page / multi-page PDF documents with the complete telemetry table, clean Silaer branding, and `www.silaer.com` footer.
* **Files Affected**:
  * `[MODIFY]` `src/lib/reports/pdfGenerator.ts`
* **Strict Invariant Rules**:
  * Native `jsPDF` vector rendering (0 DOM dependencies, 0 CSS color bugs, 0 font corruption).
  * Instant execution (< 0.05s) with direct browser download on click.
  * Clean typography with no corrupted characters (`%ï` removed).
* **Verification & Exit Gate 4**:
  * Clicking "Download PDF" saves a clean, professionally formatted `.pdf` directly to Downloads folder.

---

### 🔹 PHASE 5: Web Executive Viewer Integration & Polish
* **Status**: `[ ] Pending`
* **Purpose**: Seamlessly integrate the audit table, hero ribbon, summary notes, and toolbar into `ExecutiveReportViewer.tsx`.
* **Files Affected**:
  * `[MODIFY]` `src/components/reports/ExecutiveReportViewer.tsx`
  * `[MODIFY]` `src/app/report/[token]/page.tsx`
* **Strict Invariant Rules**:
  * Floating top toolbar: `Copy Link` + `Download PDF`.
  * Document sheet: Silaer logo, clean title, hero ribbon, telemetry table, summary bullets, footer link `www.silaer.com`.
  * Public access: 0 auth redirects, 0 layout sidebars.
* **Verification & Exit Gate 5**:
  * Page loads instantly in incognito / external Chrome profiles with zero redirects.

---

### 🔹 PHASE 6: End-to-End Testing, TypeScript Compilation & Railway Push
* **Status**: `[ ] Pending`
* **Purpose**: Validate all automated test suites, verify TypeScript compiler, commit to git, and deploy to Railway production.
* **Files Affected**:
  * All affected files across Phases 1–5.
* **Strict Invariant Rules**:
  * `npx jest src/lib/reports/__tests__` $\to$ 100% green pass.
  * `npx tsc --noEmit` $\to$ Exit code 0 (zero errors).
  * Git commit and push to `main` with automatic Railway deployment.
* **Verification & Exit Gate 6**:
  * Verified live in production on `https://reachiq.up.railway.app/report/[token]`.

---

### 📌 Strict Execution Commitment
We will execute all 6 phases strictly in sequence, verifying each exit gate before moving to the next.
