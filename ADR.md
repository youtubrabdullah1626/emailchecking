# Architecture Decision Records (ADR)

This document tracks all important architectural decisions made during the UI Modernization project.

---

## ADR 1: Selective Strangler Fig Migration
**Date**: 2026-07-31
**Context / Problem**: The `emailsystem` app uses an existing legacy component library (`ui-legacy`). Renaming the entire folder and replacing everything simultaneously risks introducing massive, unpredictable regressions across a production-grade SaaS application, especially since the backend is strictly frozen.
**Available Options**:
1. **Full Rewrite**: Delete `ui-legacy` and rewrite all pages to use `@/components/ui`.
2. **Selective Strangler Fig (Chosen)**: Keep both folders. Analyze every component. Directly swap 100% compatible components. Create adapters for partially compatible ones. Defer complex, high-risk refactors (e.g., Modals, Toasts) to dedicated phases.
3. **No Migration**: Keep using `ui-legacy`.
**Why Option 2 was chosen**: Minimizes regression risk. Allows phased, gated validation. Follows the Strangler Fig pattern for safe enterprise modernization without breaking backend contracts.
**Consequences**: Requires maintaining two UI folders temporarily. Requires a final "Legacy Cleanup" phase (Phase 8.5) to remove the technical debt once fully migrated.

---

## ADR 2: Layout Primitives Promotion
**Date**: 2026-07-31
**Context / Problem**: The legacy app heavily relies on custom `Container`, `Grid`, `Flex`, and `Stack` layout wrapper components. The new `designidea` system does not provide equivalents, relying entirely on raw Tailwind classes for layout.
**Available Options**:
1. **Remove Layouts**: Refactor all pages to use raw Tailwind (`<div className="flex...">`).
2. **Promote Layouts (Chosen)**: Extract `Container`, `Grid`, `Flex`, and `Stack` into a first-class `src/components/layout/` directory. Modernize their implementation using Tailwind tokens and `cn()`.
**Why Option 2 was chosen**: Preserves developer velocity and semantic readability of pages. Eliminates massive layout regressions that would occur from trying to hand-replace every flexbox/grid layout across 12 pages simultaneously.
**Consequences**: The layout primitives become a permanent part of the new architecture. Pages must be bulk-updated to import from `@/components/layout`.

### 8. Final Deprecation of \ui-legacy\ and Consolidation to Tailwind
**Date**: 2024-07-31
**Context**: With the successful migration of all Next.js application routes to the new design system, we were left with a directory of redundant, highly coupled components (\ui-legacy\) and a massive amount of CSS token debt in \globals.css\.
**Decision**: 
- We will fully delete \src/components/ui-legacy\.
- We will remove all mapping files for deprecated tokens (e.g. \globals.legacy.css\ and the lower half of \globals.css\).
- We will enforce the use of standard Tailwind v4 primitives and Radix-based components via ESLint rules (run via \--fix\).
**Consequences**:
- **Positive**: Bundle size is drastically reduced; maintainability improves (single source of truth for styles). The "Out of Memory" build errors we were seeing are mitigated due to a significantly smaller compilation footprint.
- **Negative**: No further "fallback" options exist for older UI layouts; any future pages MUST conform strictly to the new system.
- **Status**: **Implemented** in Phase 8.5/Phase 9.
