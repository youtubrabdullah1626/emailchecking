# Reusable Component Patterns

Use these established patterns instead of reinventing layouts. They are derived from premium UI libraries like shadcn/ui, MagicUI, and OriginUI.

## 1. Dashboard Cards (Bento Grid)
- **Pattern:** A grid of distinct metric cards.
- **Structure:** 
  - Header: Left-aligned title (`text-sm font-medium`), right-aligned muted icon.
  - Content: Large primary metric (`text-3xl font-bold tracking-tight`), secondary subtext indicating delta (`+12% from last month` in green/red).
  - Background: Solid white/black or subtle gradient wash.

## 2. Command Palettes (Cmd+K)
- **Pattern:** Centralized search and action execution.
- **Structure:** Frosted glass overlay, centered dialog. Search input with no borders, separated from a scrollable list of categorized actions by a 1px line.

## 3. Data Tables
- **Pattern:** Clean, highly readable lists of records.
- **Structure:**
  - Sticky headers with muted text (`text-xs uppercase tracking-wider`).
  - Row hover effects (`hover:bg-zinc-50`).
  - Context menus (three dots `...`) aligned to the far right for row actions.
  - Pagination controls at the bottom.

## 4. Sidebars & Navigation
- **Pattern:** Vertical left sidebar for deep applications, or horizontal sticky navbar for simpler ones.
- **Structure (Sidebar):** Grouped links with section headers. Active state uses a subtle background (`bg-zinc-100`) and darker text. Inactive links are muted.
- **Structure (Navbar):** Logo left, central navigation links (or search), user avatar/settings right.

## 5. Analytics Widgets (Charts)
- **Pattern:** Visual data representation.
- **Structure:** Minimal grid lines. Curved line charts or smooth bar charts. Tooltips must be custom HTML, not default browser tooltips. Include a timeframe selector at the top right of the widget.

## 6. Empty States
- **Pattern:** What the user sees when there is no data.
- **Structure:** Centered layout inside a dashed or very light border area. A muted, beautifully designed icon, a clear heading, an explanatory sentence, and a primary Call-to-Action button to create the first item.

## 7. Dialogs & Modals
- **Pattern:** Focused interruption for critical actions (e.g., settings, destructive deletes).
- **Structure:** Dimmed backdrop (`bg-black/50 backdrop-blur-sm`). White/dark card centered. Header with title and description. Content area. Footer with "Cancel" (ghost) and "Confirm" (solid) buttons right-aligned.
