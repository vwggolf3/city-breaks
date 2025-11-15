# Dependencies Documentation

**Last Updated:** 2025-11-15

## Overview

This document lists all npm packages used in Weekend Flight Finder, their purpose, versions, and potential alternatives for scaling.

---

## Core Framework & Build Tools

### React & React DOM
**Version:** ^18.3.1  
**Purpose:** Core UI framework  
**Why:** Industry standard, excellent ecosystem, component-based architecture  
**License:** MIT

```json
"react": "^18.3.1",
"react-dom": "^18.3.1"
```

**Alternatives:** Vue.js, Svelte, Angular (not recommended for migration)

---

### Vite
**Version:** Latest (via Lovable)  
**Purpose:** Build tool and development server  
**Why:** Fast HMR, optimized builds, excellent developer experience  
**License:** MIT

**Configuration:** `vite.config.ts`

**Alternatives:** Webpack, Parcel, Rollup

---

### TypeScript
**Version:** Latest  
**Purpose:** Type safety and better developer experience  
**Why:** Catch errors at compile time, better IDE support, improved maintainability  
**License:** Apache 2.0

**Configuration:** `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`

---

## Routing

### React Router DOM
**Version:** ^6.30.1  
**Purpose:** Client-side routing  
**Why:** De facto standard for React routing, supports nested routes, protected routes

```json
"react-router-dom": "^6.30.1"
```

**Usage:**
```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
```

**Key Features Used:**
- `BrowserRouter` - HTML5 history API routing
- `Routes` & `Route` - Route definitions
- `useNavigate` - Programmatic navigation
- `useLocation` - Current route access

**Alternatives:** Next.js (requires full framework migration), TanStack Router

---

## UI Components & Styling

### Tailwind CSS
**Version:** Latest  
**Purpose:** Utility-first CSS framework  
**Why:** Rapid development, consistent design, small bundle size  
**License:** MIT

**Configuration:** `tailwind.config.ts`, `postcss.config.js`

**Plugins:**
- `tailwindcss-animate` - Pre-built animations

**Alternatives:** CSS Modules, Styled Components, Emotion

---

### Shadcn UI Components
**Version:** Latest (copied to project)  
**Purpose:** Pre-built, accessible React components  
**Why:** Fully customizable, accessibility-first, owns the code

**Components Used:**
- Accordion, Alert Dialog, Alert, Avatar, Badge
- Breadcrumb, Button, Calendar, Card, Carousel
- Chart, Checkbox, Collapsible, Command, Context Menu
- Dialog, Drawer, Dropdown Menu, Form, Hover Card
- Input, Input OTP, Label, Menubar, Navigation Menu
- Pagination, Popover, Progress, Radio Group
- Scroll Area, Select, Separator, Sheet, Sidebar
- Skeleton, Slider, Sonner (toast), Switch, Table
- Tabs, Textarea, Toast, Toggle, Tooltip

**License:** MIT

**Installation Method:** Copy-paste (not npm package)

```bash
# Components are in src/components/ui/
```

**Alternatives:** Material-UI, Ant Design, Chakra UI

---

### Radix UI
**Version:** Various (latest stable)  
**Purpose:** Unstyled, accessible component primitives (used by Shadcn)  
**Why:** Best-in-class accessibility, headless design  
**License:** MIT

```json
"@radix-ui/react-accordion": "^1.2.11",
"@radix-ui/react-alert-dialog": "^1.1.14",
"@radix-ui/react-avatar": "^1.1.10",
// ... (40+ packages)
```

**Note:** These are peer dependencies of Shadcn components.

---

### Lucide React
**Version:** ^0.462.0  
**Purpose:** Icon library  
**Why:** Beautiful icons, tree-shakeable, actively maintained  
**License:** ISC

```json
"lucide-react": "^0.462.0"
```

**Usage:**
```typescript
import { Plane, MapPin, Calendar } from "lucide-react";
```

**Alternatives:** React Icons, Heroicons, Font Awesome

---

## State Management & Data Fetching

### TanStack Query (React Query)
**Version:** ^5.83.0  
**Purpose:** Server state management and caching  
**Why:** Excellent caching, automatic refetching, optimistic updates  
**License:** MIT

```json
"@tanstack/react-query": "^5.83.0"
```

**Usage:**
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
```

**Current Usage:**
- Provider setup in App.tsx
- Not yet used for data fetching (potential)

**Alternatives:** SWR, Apollo Client (for GraphQL), Redux Toolkit Query

---

## Backend Integration

### Supabase JS
**Version:** Auto-managed by Lovable  
**Purpose:** Backend client for auth, database, storage, realtime  
**Why:** Full-featured, excellent TypeScript support, real-time capabilities  
**License:** MIT

```typescript
import { supabase } from "@/integrations/supabase/client";
```

**Features Used:**
- Authentication (email/password, OAuth)
- Database queries with RLS
- Edge Functions invocation
- Auto-generated TypeScript types

**Files:**
- `src/integrations/supabase/client.ts` - Client instance
- `src/integrations/supabase/types.ts` - Auto-generated types

**Alternatives:** Firebase, AWS Amplify, PocketBase

---

## Form Management

### React Hook Form
**Version:** ^7.61.1  
**Purpose:** Form state management and validation  
**Why:** Minimal re-renders, excellent performance, easy validation  
**License:** MIT

```json
"react-hook-form": "^7.61.1"
```

**Integration with Zod:**
```json
"@hookform/resolvers": "^3.10.0"
```

**Usage:**
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
```

**Current Status:** Installed but not yet heavily used

**Alternatives:** Formik, Final Form

---

### Zod
**Version:** ^3.25.76  
**Purpose:** Schema validation  
**Why:** TypeScript-first, excellent error messages, composable  
**License:** MIT

```json
"zod": "^3.25.76"
```

**Usage:**
```typescript
const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Must be at least 6 characters");
```

**Alternatives:** Yup, Joi, Ajv

---

## Utilities

### Class Variance Authority (CVA)
**Version:** ^0.7.1  
**Purpose:** Type-safe component variant management  
**Why:** Excellent TypeScript support, reduces boilerplate  
**License:** Apache 2.0

```json
"class-variance-authority": "^0.7.1"
```

**Usage:**
```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "..." }
  }
});
```

---

### clsx & tailwind-merge
**Versions:** ^2.1.1 & ^2.6.0  
**Purpose:** Conditional class name merging  
**Why:** Handles Tailwind class conflicts intelligently  
**License:** MIT

```json
"clsx": "^2.1.1",
"tailwind-merge": "^2.6.0"
```

**Combined in utility:**
```typescript
// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

---

### date-fns
**Version:** ^3.6.0  
**Purpose:** Date manipulation and formatting  
**Why:** Modular, tree-shakeable, immutable, excellent TypeScript support  
**License:** MIT

```json
"date-fns": "^3.6.0"
```

**Usage:**
```typescript
import { format } from "date-fns";

const formatted = format(new Date(), "MMM d, yyyy");
```

**Alternatives:** Day.js, Luxon, Moment.js (deprecated)

---

## UI Enhancements

### Sonner
**Version:** ^1.7.4  
**Purpose:** Toast notifications  
**Why:** Beautiful, accessible, easy to use  
**License:** MIT

```json
"sonner": "^1.7.4"
```

**Usage:**
```typescript
import { toast } from "sonner";

toast.success("Profile updated successfully!");
```

---

### Embla Carousel
**Version:** ^8.6.0  
**Purpose:** Carousel/slider component  
**Why:** Lightweight, framework-agnostic, touch-friendly  
**License:** MIT

```json
"embla-carousel-react": "^8.6.0"
```

**Current Status:** Installed via Shadcn carousel component

---

### React Resizable Panels
**Version:** ^2.1.9  
**Purpose:** Resizable panel layouts  
**Why:** Smooth resizing, accessible, customizable  
**License:** MIT

```json
"react-resizable-panels": "^2.1.9"
```

**Current Status:** Installed via Shadcn resizable component

---

### Vaul
**Version:** ^0.9.9  
**Purpose:** Drawer component for mobile  
**Why:** Native-feeling mobile drawers  
**License:** MIT

```json
"vaul": "^0.9.9"
```

**Current Status:** Installed via Shadcn drawer component

---

## Charting (Future Use)

### Recharts
**Version:** ^2.15.4  
**Purpose:** Chart library built on React  
**Why:** Composable, responsive, built for React  
**License:** MIT

```json
"recharts": "^2.15.4"
```

**Current Status:** Installed but not yet used

**Potential Use Cases:**
- Price trend charts for saved searches
- Budget analytics
- Travel history visualizations

**Alternatives:** Victory, Nivo, Chart.js

---

## Development Dependencies

### ESLint
**Purpose:** Code linting and quality  
**Configuration:** `eslint.config.js`

**Plugins:**
- `eslint-plugin-react-hooks` - React Hooks rules
- `eslint-plugin-react-refresh` - Fast Refresh rules
- `typescript-eslint` - TypeScript support

---

### PostCSS
**Purpose:** CSS processing  
**Configuration:** `postcss.config.js`

**Plugins:**
- `tailwindcss` - Tailwind processing
- `autoprefixer` - Browser prefixes

---

### Lovable Tagger
**Purpose:** Component identification for Lovable editor  
**Note:** Only active in development mode

---

## Special Packages

### CMDK
**Version:** ^1.1.1  
**Purpose:** Command palette component  
**Why:** Keyboard-first navigation  
**License:** MIT

```json
"cmdk": "^1.1.1"
```

**Current Status:** Installed via Shadcn command component  
**Potential Use:** Quick flight search command palette

---

### Input OTP
**Version:** ^1.4.2  
**Purpose:** One-time password input  
**License:** MIT

```json
"input-otp": "^1.4.2"
```

**Current Status:** Installed but not used  
**Potential Use:** Two-factor authentication

---

### Next Themes
**Version:** ^0.3.0  
**Purpose:** Dark mode support  
**License:** MIT

```json
"next-themes": "^0.3.0"
```

**Current Status:** Installed but not implemented  
**Potential Use:** Light/dark mode toggle

---

## Bundle Size Analysis

**Current Estimated Bundle Size:**
- Production build: ~150-200 KB (gzipped)
- Main contributors:
  - React + React DOM: ~45 KB
  - Radix UI components: ~60 KB
  - TanStack Query: ~15 KB
  - React Router: ~12 KB
  - Supabase client: ~30 KB

**Optimization Opportunities:**
1. Lazy load heavy components (Recharts)
2. Code splitting by route
3. Tree-shake unused Radix components
4. Consider removing Next Themes if not using

---

## Dependency Updates

### Update Strategy

**For Security:**
```bash
npm audit
npm audit fix
```

**For Features:**
```bash
npm outdated
npm update [package-name]
```

**Major Version Updates:**
- Test thoroughly
- Review breaking changes
- Update in development first

### Update Schedule

- **Security patches:** Immediately
- **Minor versions:** Monthly
- **Major versions:** Quarterly or as needed

---

## Alternatives for Scaling

### If Moving Away from Lovable Cloud

**Current:** Supabase JS Client  
**Alternatives:**
- PostgreSQL + Prisma ORM
- PostgreSQL + Drizzle ORM
- Firebase (different auth pattern)
- AWS Amplify

### If Building Native Mobile Apps

**Current:** React web app  
**Path Forward:**
- React Native (reuse ~70% of logic)
- Flutter (complete rewrite)
- Ionic (wrap web app)

---

## License Compliance

All dependencies use permissive open-source licenses:
- **MIT:** Majority of packages
- **Apache 2.0:** TypeScript, CVA
- **ISC:** Lucide React

**Commercial Use:** ✅ All licenses allow commercial use  
**Attribution:** Check individual licenses for requirements  
**Redistribution:** Allowed with proper attribution

---

## Security Considerations

### Dependency Scanning

**Run regularly:**
```bash
npm audit
```

**Automated scanning:** Enable Dependabot (GitHub) or Snyk

### Known Vulnerabilities

**Current Status:** No known critical vulnerabilities

**To Monitor:**
- Check [Snyk Advisor](https://snyk.io/advisor/)
- Review GitHub Security Advisories
- Subscribe to security mailing lists

---

## Installation from Scratch

To install all dependencies:

```bash
# Clone repository
git clone <your-repo-url>
cd weekend-flight-finder

# Install dependencies
npm install

# Start development server
npm run dev
```

**System Requirements:**
- Node.js 18+ (20+ recommended)
- npm 9+ or pnpm 8+

---

## Future Dependencies (Planned)

### Flight Data APIs
```bash
# Amadeus SDK (when integrated)
npm install amadeus
```

### Payment Processing
```bash
# Stripe (when integrated)
npm install @stripe/stripe-js
npm install @stripe/react-stripe-js
```

### Analytics
```bash
# PostHog (when integrated)
npm install posthog-js
npm install posthog-react
```

### Error Tracking
```bash
# Sentry (when integrated)
npm install @sentry/react
npm install @sentry/vite-plugin
```

---

## Deprecated or Unused

**None currently** - All installed dependencies are used or planned to be used.

If any packages become unused, remove them:
```bash
npm uninstall [package-name]
```

---

**Last Updated:** 2025-11-15  
**Maintainer:** Development Team  
**Review Schedule:** Update with every dependency change
