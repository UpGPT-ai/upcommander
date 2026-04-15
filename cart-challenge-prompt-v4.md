# Cart Challenge — Prompt v4

## Challenge Day Flow

1. Receive coupon rules from the challenger
2. Paste them into Claude Code with the prompt below
3. Commander builds everything in parallel
4. Cart runs on localhost with working coupon logic

---

## THE PROMPT

```
Build a shopping cart inspired by Vistaprint's look and feel, with a working coupon/discount engine that implements the rules below. Deploy via Commander — decide how many workers the work needs, assign them yourself. Every Commander worker is an independent Claude Code instance that can spawn its own sub-agents for parallel work within their scope.

Stack: Vite + React + TypeScript + Tailwind CSS. Must run on localhost via `npm run dev`.

For styling, research Vistaprint's public SWAN design system at vista.design/swan and apply their real design tokens. Use Inter font. No product images — colored monogram circles.

The engine must be a pure TypeScript module with zero UI dependencies. Include an admin panel in the UI to add new coupon rules on the fly without code changes. Include a collapsible engine trace that shows every coupon evaluation step — what applied, what was blocked, and why.

Agent rules: follow agent-operations. Sonnet for code, Haiku for scanning. Workers write STATUS.json and SYNTHESIS.md to .claude-coord/. Dependent workers wait by monitoring STATUS.json.

Well-commented, self-documenting code throughout.

## Coupon Rules

Coupons belong to a stackGroup. Same group = conflict (highest priority wins). Different groups can stack. Each coupon has a priority number.

PERCENTAGE (stackGroup: "percent"):
- SAVE20 — 20% off everything, priority 10
- SPRING25 — 25% off business-cards only, priority 20
- WELCOME15 — 15% off everything, priority 5, single use
- VIP30 — 30% off everything, priority 50, valid Mar 20–31 2026
- EXPIRED10 — 10% off everything, priority 1, expired Feb 28 2026

FIXED (stackGroup: "fixed", stacks cross-group):
- FLAT10 — $10 off, min $50 spend, priority 10
- TAKE25OFF — $25 off, min $100, priority 20
- LOYALTYBONUS — $5 off, no min, priority 5

BOGO (stackGroup: "bogo", stacks cross-group):
- MUGBOGO — Buy 2 drinkware get 1 free, priority 10
- SHIRT241 — Buy 2 apparel get 1 free (cheapest free), priority 10
- CARDS10FREE — Buy 5+ business-cards get 2 free, priority 15

TIERED (stackGroup: "tiered", conflicts with percent):
- BULK — 5% off $100+, 10% off $200+, 15% off $300+, 20% off $500+, priority 30

SHIPPING (stackGroup: "shipping", stacks with everything):
- FREESHIP — Free $9.99 shipping on orders over $75, priority 10
- SHIPLESS — $4.99 off shipping, no min, priority 5

EXCLUSIONS:
- NOSIGNS — 20% off everything EXCEPT signage, stackGroup: "percent", priority 15
- PREMONLY — 40% off items with paper="premium" attribute only, stackGroup: "special", priority 100, stacks with everything

TIME-WINDOWED:
- LUNCHSALE — 12% off, stackGroup: "percent", priority 12, valid 11am–2pm only
- WEEKDAY20 — 20% off stationery, stackGroup: "percent", priority 18, Mon–Fri only
- FLASHSALE — 35% off everything, stackGroup: "percent", priority 99, today only (Mar 25 2026), 2pm–4pm
- FUTUREDEAL — $50 off orders over $200, stackGroup: "fixed", priority 25, valid Apr 1–30 2026 (not yet active)
```

---
