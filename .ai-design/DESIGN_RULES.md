# Permanent Design Rules

These rules dictate the visual intelligence for the AI operating as a Senior Product Designer. All generated UIs must adhere to these principles to achieve premium, SaaS-level aesthetics (e.g., Linear, Vercel, Stripe).

## 1. Composition & Dashboard Architecture
- **Max-Width Constraints:** Never let content bleed infinitely. Bound application layouts (max-w-7xl) and centralize them.
- **Visual Hierarchy:** Use clear primary (main content), secondary (sidebars/panels), and tertiary (footer/meta) zones.
- **Negative Space:** Elements must have breathing room. Use 8-point grid spacing (`gap-2`, `gap-4`, `gap-6`, `p-6`). Do not crowd cards or forms.

## 2. Typography Hierarchy
- **Font Stack:** Use modern sans-serif fonts (e.g., Inter, Geist, SF Pro).
- **Contrast:** Headings should be high contrast (`text-zinc-900` or `text-zinc-50` in dark mode). Body text should be muted (`text-zinc-500` or `text-zinc-400`).
- **Scale:** Distinguish titles (`text-2xl font-semibold tracking-tight`), subheadings (`text-sm font-medium`), and metadata (`text-xs text-muted-foreground`).

## 3. Card & Container Layouts
- **Premium Borders:** Use very subtle borders (`border border-zinc-200/50` or `border-zinc-800/50`).
- **Soft Shadows:** Avoid hard dropshadows. Use diffuse, layered shadows (e.g., `shadow-sm` or `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`).
- **Glassmorphism (Sparingly):** Use frosted glass (`backdrop-blur-md bg-white/60`) for sticky headers or command palettes, not everything.

## 4. Interaction & Animation Philosophy
- **Micro-interactions:** Hover states should be snappy but smooth. Use `transition-all duration-200 ease-out`.
- **Subtle Feedback:** Buttons should slightly lift or darken. Inputs should gain a subtle ring on focus (`focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2`).
- **Loading:** Prefer skeleton screens over spinning loaders. Skeletons should pulse softly.

## 5. Color Usage
- **Monochrome Foundation:** Build 90% of the UI in grayscale/zinc tones.
- **Strategic Accent:** Use a single, vibrant accent color (e.g., Vercel blue or Linear purple) strictly for primary actions, active states, or key data points.
- **Avoid:** Generic raw colors (pure `#FF0000` or `#00FF00`). Use curated, tailored HSL values.

## 6. Form Patterns
- **Alignment:** Stack labels above inputs by default.
- **Clarity:** Add helper text beneath complex fields. Always display inline validation errors in soft red (`text-red-500 text-sm`).

## 7. Accessibility Rules
- Ensure 4.5:1 contrast ratios.
- All interactive elements must have `focus-visible` states.
- Support screen readers via `aria-label` and `aria-hidden` on purely decorative elements (like SVG icons).
