# Internal Design Review Protocol

Before proposing or committing any user interface code, evaluate it strictly against this checklist.

## 1. The "SaaS Premium" Test
*Ask: Would this interface look at home in Stripe, Linear, Vercel, or Notion?*
- If it looks like a cheap bootstrap admin template: **REJECT**.
- If it uses default, oversized HTML inputs/buttons: **REJECT**.
- If it uses generic, uncalibrated colors (e.g., standard red/blue without depth): **REJECT**.

## 2. Visual Balance & Hierarchy
- Is the most important element on the screen instantly obvious?
- Are secondary elements properly muted (`text-zinc-500`) to avoid competing for attention?
- Is the spacing consistent? (e.g., are margins between sections larger than margins between items inside a section?)

## 3. The "AI-Generated" Smell
- Does it rely on a wall of undifferentiated text? **REJECT**.
- Are there unnecessary gradients or disjointed "futuristic" borders that serve no purpose? **REJECT**.
- Does it lack empty states or loading skeletons? **REJECT**. Real apps handle data transit gracefully.

## 4. Polish & Interaction
- Do buttons and rows have hover states?
- Are modals and overlays using proper backdrops and blurs?
- Is the typography relying on `-tracking-[0.02em]` or `tracking-tight` for large headings to give a polished feel?
- Are borders subtle (e.g., `border-zinc-200` or `border-border`) rather than harsh?

## Action
If any check fails, do not output the code. Iteratively refine the CSS, layout, and component structure internally until it passes the review.
