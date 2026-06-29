# Dietin — Design Guidelines

## Overview

Dietin is a mobile-first PWA (Progressive Web App) built with React, TypeScript, and Tailwind CSS using [shadcn/ui](https://ui.shadcn.com/) as the component library base. The visual language is **clean, minimal, and dark-first** with glassmorphism accents.

---

## Colors

### Brand Colors

| Token | Value | Description |
|-------|-------|-------------|
| `primary` | `hsl(190 100% 42%)` | Cyan / teal — main brand color |
| `secondary` | `hsl(0 100% 71%)` | Coral / red — accent color |
| `destructive` | `hsl(0 100% 67%)` | Error / danger actions |
| `ring` | `hsl(190 100% 42%)` | Focus ring (matches primary) |

### Semantic Tokens (CSS Variables)

| Token | Light | Description |
|-------|-------|-------------|
| `--background` | `hsl(0 0% 100%)` | Page background |
| `--foreground` | `hsl(0 0% 0%)` | Page text |
| `--muted` | `hsl(0 0% 0% / 0.1)` | Muted surface |
| `--muted-foreground` | `hsl(0 0% 0% / 0.7)` | Muted text |
| `--accent` | `hsl(0 0% 0% / 0.1)` | Accent surface |
| `--accent-foreground` | `hsl(0 0% 0%)` | Accent text |
| `--card` | `hsl(0 0% 0% / 0.1)` | Card background |
| `--border` | `hsl(0 0% 0% / 0.1)` | Default border |
| `--input` | `hsl(0 0% 0% / 0.1)` | Input background |
| `--popover` | `hsl(0 0% 100% / 0.95)` | Popover background |
| `--radius` | `1.75rem` | Base border radius |

### Dark Surface Palette (Tailwind custom)

| Token | Value | Usage |
|-------|-------|-------|
| `bg.DEFAULT` | `#0c0c0e` | Main dark background |
| `bg.card` | `#1E1E1E` | Dark card background |
| `bg.input` | `#1E1E1E` | Dark input background |
| `bg.hover` | `#2A2A2A` | Dark hover state |
| `text.DEFAULT` | `#FFFFFF` | White text (dark theme) |
| `text.muted` | `rgba(255,255,255,0.6)` | Muted text (dark theme) |
| `text.subtle` | `rgba(255,255,255,0.4)` | Subtle text (dark theme) |
| `text.inverted` | `#000000` | Inverted text |

### Gradient

```css
/* Animated brand gradient */
background: linear-gradient(-45deg, hsl(var(--primary)), hsl(var(--secondary)), #FFFFFF);
background-size: 400% 400%;
animation: gradient 15s ease infinite;
```

---

## Typography

### Font Stack

Primary: **SF Pro Display → Inter → Roboto → system-ui**

```css
font-family: 'SF Pro Display', Inter, Roboto, -apple-system,
  BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
```

### Font Variants

| Class | Weight | Usage |
|-------|--------|-------|
| `.font-sf-normal` | 400 | Body text |
| `.font-sf-medium` | 500 | Labels, buttons |
| `.font-sf-bold` | 700 | Headings, emphasis |

### Decorative Fonts (Google Fonts, for marketing/branding)

- Cinzel Decorative (400, 700, 900)
- EB Garamond (400–800)
- Figtree (300–900)
- Noto Kufi Arabic (100–900) — Arabic locale
- Pacifico
- Rouge Script

### Text Utilities

| Class | Style |
|-------|-------|
| `.text-default` | `text-black` |
| `.text-muted` | `text-black/60` |
| `.text-subtle` | `text-black/40` |

---

## Spacing & Layout

### Container

- Centered, with `2rem` horizontal padding
- Max width: `1400px` at `2xl` breakpoint

### Border Radius Scale

| Token | Value (approx.) |
|-------|----------------|
| `rounded-sm` | `--radius - 4px` ≈ `24px` |
| `rounded-md` | `--radius - 2px` ≈ `26px` |
| `rounded-lg` | `--radius` = `28px` |
| `rounded-xl` | `--radius + 4px` ≈ `32px` |
| `rounded-2xl` | `--radius + 8px` ≈ `36px` |
| `rounded-3xl` | `--radius + 12px` ≈ `40px` |

---

## Shadows

All shadows use very low opacity (≤ 10%) for a subtle, dark-UI-friendly feel.

| Token | Value |
|-------|-------|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.02)` |
| `shadow` | `0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)` |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.04), 0 2px 4px -2px rgb(0 0 0 / 0.04)` |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)` |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)` |
| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.1)` |

---

## Components

### Button

Built with `class-variance-authority`. Base: `h-10 px-4 py-2 rounded-md text-sm font-medium text-white`.

| Variant | Style |
|---------|-------|
| `default` | `bg-primary text-white hover:bg-primary/90` |
| `secondary` | `bg-secondary text-white hover:bg-secondary/80` |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90` |
| `outline` | `border border-input bg-background hover:bg-accent` |
| `ghost` | `hover:bg-accent` |
| `link` | `underline-offset-4 hover:underline` |

| Size | Dimensions |
|------|-----------|
| `sm` | `h-9 px-3` |
| `default` | `h-10 px-4 py-2` |
| `lg` | `h-11 px-8` |
| `icon` | `h-10 w-10` |

### Card

Dark glassmorphism card: `rounded-xl bg-[#1c1c1e]/95 border border-white/[0.08] text-white shadow-sm`

Sub-components: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

### Glass Utilities

```css
/* Frosted glass card */
.glass-card {
  @apply bg-white/95 backdrop-blur-lg border border-black/20 shadow-xl text-black;
}

/* Frosted glass button */
.glass-button {
  @apply bg-black/20 hover:bg-black/30 backdrop-blur-lg border border-black/20
         transition-all duration-300 text-black;
}
```

### Gradient Border

```css
.gradient-border {
  @apply relative before:absolute before:inset-0 before:p-[1px]
         before:bg-gradient-to-r before:from-primary/50 before:to-secondary/50
         before:rounded-[inherit] before:-z-10;
}
```

### Modal Backdrop

```css
.app-backdrop {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
}
```

---

## Dark Mode

Dark mode is implemented via a **CSS filter inversion** approach rather than a color scheme media query.

- Add `.theme-dark-invert` to `<html>` to enable dark mode
- Effect: `filter: invert(1) hue-rotate(180deg) brightness(1.2) contrast(0.9)`
- Media elements (img, video, canvas, svg) are counter-inverted to appear normal
- Active body styles: `color: #eef2f6; background: #2b2f36`
- Bottom nav active color in dark: `#6366f1` (indigo-500)

---

## Animations

| Name | Duration | Easing | Trigger |
|------|----------|--------|---------|
| `accordion-down` | 0.2s | ease-out | Radix accordion expand |
| `accordion-up` | 0.2s | ease-out | Radix accordion collapse |
| `animate-gradient` | 15s | ease infinite | `.animate-gradient` class |

---

## RTL Support

Apply `.rtl` to a container to switch to right-to-left layout. Utilities automatically flip:
- `text-left` ↔ `text-right`
- `ml-auto` ↔ `mr-auto`
- `space-x-*` direction

For Arabic locale, use **Noto Kufi Arabic** font.

---

## Mobile / PWA Specifics

- `padding-top: env(safe-area-inset-top)` on `<body>` for iOS notch support
- No bottom safe-area padding (fixed BottomNav covers the iOS home indicator)
- Scrollbars are hidden globally (`scrollbar-width: none`)
- `-webkit-tap-highlight-color: transparent` for clean tap states
- `body.no-scroll` locks page scroll during bottom nav interactions

---

## Component Library

**shadcn/ui** — `default` style, `slate` base color, CSS variables enabled.

Config: `components.json` → aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`

Available UI primitives: Accordion, Alert, Avatar, Badge, Button, Calendar, Card, Carousel, Chart, Checkbox, Command, Dialog, Drawer, Dropdown, Form, Input, Label, Navigation Menu, Pagination, Popover, Progress, Select, Sheet, Skeleton, Slider, Switch, Table, Tabs, Textarea, Toast, Toggle, Tooltip.
