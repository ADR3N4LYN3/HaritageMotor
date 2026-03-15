# PWA Frontend

Progressive Web App built with Next.js 14, designed as a mobile-first field tool for technicians and operators.

## Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14.2.x | App Router, SSR, standalone output |
| React | 18.x | UI framework |
| Zustand | 5.x | Client state management |
| SWR | 2.x | Data fetching with caching and revalidation |
| idb | 8.x | IndexedDB wrapper for offline queue |
| @zxing/browser | 0.1.x | QR code scanning via camera |
| @zxing/library | 0.21.x | Core barcode decoding library (peer of @zxing/browser) |
| react-hook-form | 7.x | Form validation |
| Tailwind CSS | 3.4.x | Utility-first styling |
| next-pwa | 5.6.x | Service worker generation |

## Project Structure

```
pwa/
├── app/
│   ├── layout.tsx             # Root layout (metadata, viewport, PWA manifest)
│   ├── page.tsx               # Root redirect → /dashboard
│   ├── login/
│   │   ├── layout.tsx         # Login layout (no AppShell)
│   │   └── page.tsx           # Login + MFA verification
│   ├── scan/
│   │   ├── layout.tsx         # Scan layout (SideNav for desktop, no AppShell)
│   │   └── page.tsx           # QR scanner + bottom sheets (vehicles, bays, tasks) + mobile back button
│   ├── change-password/
│   │   └── page.tsx           # Password change (PasswordInput, strength meter, checklist)
│   ├── admin/
│   │   ├── page.tsx           # Superadmin panel (imports components/admin/*)
│   │   └── qr-codes/page.tsx  # QR code generation and printing (admin only)
│   ├── dashboard/
│   │   ├── layout.tsx         # Dashboard layout
│   │   └── page.tsx           # Dashboard: 2-col desktop (fleet 2/3 + activity 1/3), tabbed mobile
│   ├── vehicles/
│   │   └── page.tsx           # Full vehicle list with search, status filters, table/cards
│   ├── vehicle/new/
│   │   └── page.tsx           # New vehicle onboarding form
│   ├── vehicle/[id]/
│   │   ├── layout.tsx         # Vehicle detail layout
│   │   ├── page.tsx           # Vehicle detail + timeline + tags + delete (admin) + add note/incident
│   │   ├── edit/page.tsx      # Edit vehicle details
│   │   ├── move/page.tsx      # Move vehicle to another bay
│   │   ├── task/page.tsx      # Task completion
│   │   ├── photo/page.tsx     # Photo capture and upload
│   │   └── exit/page.tsx      # Vehicle exit confirmation
│   ├── profile/
│   │   └── page.tsx           # User profile (MFA setup/disable, logout)
│   ├── tasks/
│   │   └── page.tsx           # Task list with filters, edit, delete (admin)
│   ├── users/
│   │   └── page.tsx           # User management CRUD (admin only)
│   ├── audit/
│   │   └── page.tsx           # Audit log viewer with resource filters (admin only)
│   ├── qr-codes/
│   │   └── page.tsx           # QR code generation and printing (admin only)
│   ├── bays/
│   │   └── page.tsx           # Bay list with status filters and stats
│   ├── bay/new/
│   │   └── page.tsx           # Create new bay
│   ├── bay/[id]/
│   │   ├── layout.tsx         # Bay detail layout
│   │   ├── page.tsx           # Bay detail view
│   │   └── edit/page.tsx      # Edit bay details
│   └── api/auth/
│       ├── set-token/route.ts   # Store refresh token as httpOnly cookie
│       ├── refresh/route.ts     # Proxy refresh through Next.js (cookie → API)
│       ├── logout/route.ts      # Proxy logout to backend + clear cookie
│       └── clear-token/route.ts # Clear refresh token cookie on logout
├── middleware.ts                 # Auth guard + role-based route protection (/admin → superadmin, /users → admin)
├── components/
│   ├── ErrorBoundary.tsx        # App error boundary (react-error-boundary, full-screen fallback with retry)
│   ├── layout/
│   │   ├── AppShell.tsx       # Responsive shell: SideNav (lg+) + TopBar (mobile) + BottomNav (mobile), `wide` prop for dashboard
│   │   ├── TopBar.tsx         # Mobile/tablet header with notification bell + sync badge + lang switcher
│   │   ├── DesktopTopBar.tsx  # Desktop topbar (page title + bell + lang switcher + avatar)
│   │   ├── SideNav.tsx        # Desktop sidebar navigation (220px, role-based nav items)
│   │   ├── BottomNav.tsx      # Fixed bottom navigation — mobile/tablet only (Home, Scan QR, Bays, Profile)
│   │   └── (CookieBanner moved to ui/)
│   ├── ui/
│   │   ├── ActionButton.tsx   # Styled button (primary gold/danger outlined/secondary, 48px, loading spinner)
│   │   ├── PageHeader.tsx     # Reusable header with back button, title, subtitle, action slot
│   │   ├── VehicleCard.tsx    # Vehicle summary card (memo, gold-border-top, card-lift)
│   │   ├── ActivityFeed.tsx   # Activity timeline feed (all roles, fetches GET /activity, accepts `active` prop to pause polling)
│   │   ├── EventItem.tsx      # Timeline event display
│   │   ├── BaySelector.tsx    # Bay picker for move actions
│   │   ├── LangSwitcher.tsx   # Language switcher (EN/FR/DE) with inline SVG flags, localStorage('hm-lang')
│   │   ├── TagInput.tsx       # Vehicle tag editor (4 presets + free-text custom tags, used in create/edit)
│   │   ├── SyncBadge.tsx      # Pending offline actions indicator
│   │   ├── Skeleton.tsx       # Loading skeletons
│   │   ├── SuccessScreen.tsx  # Success confirmation screen
│   │   └── CookieBanner.tsx   # GDPR cookie consent modal (centered overlay, blur backdrop, essential/analytics toggles)
│   ├── camera/
│   │   ├── CameraCapture.tsx  # Camera interface for photos
│   │   └── PhotoGrid.tsx      # Photo preview grid
│   ├── admin/
│   │   ├── AdminSelect.tsx    # Styled select input for admin forms
│   │   ├── CreateTenantForm.tsx # Tenant creation form
│   │   ├── InviteSection.tsx  # User invitation form + users table
│   │   ├── QuickLinks.tsx     # Admin overview quick links grid
│   │   ├── SectionHeading.tsx # Reusable section heading with tag
│   │   ├── StatsSection.tsx   # Platform stats grid
│   │   ├── TenantRow.tsx      # Expandable tenant row with edit/delete
│   │   └── TenantsSection.tsx # Tenants list section
│   ├── profile/
│   │   └── TOTPSetup.tsx      # TOTP MFA setup/disable flow
│   ├── scan/
│   │   ├── BaysSheet.tsx      # Bottom sheet: bay list
│   │   ├── ManualSheet.tsx    # Bottom sheet: manual vehicle search
│   │   ├── StatusBadge.tsx    # Vehicle/bay status pill
│   │   ├── TasksSheet.tsx     # Bottom sheet: pending tasks
│   │   └── VehiclesSheet.tsx  # Bottom sheet: vehicle list
│   ├── tasks/
│   │   └── CreateTaskModal.tsx # Task create/edit modal (supports editTask prop for PATCH)
│   ├── users/
│   │   └── UserFormModal.tsx  # User create/edit modal
│   └── scanner/
│       └── QRScanner.tsx      # QR code scanner with @zxing
├── hooks/
│   ├── useVehicle.ts          # SWR hooks for vehicle data + timeline
│   ├── useBay.ts              # SWR hooks for bay data
│   ├── useCamera.ts           # Photo capture state management
│   ├── useOfflineQueue.ts     # Offline queue sync with retry
│   └── useReveal.ts           # IntersectionObserver scroll-triggered reveal animations
├── lib/
│   ├── api.ts                 # API client with auto-refresh
│   ├── auth.ts                # Login, MFA, logout functions
│   ├── i18n.ts                # Shared i18n hook (useI18n) + broadcast mechanism
│   ├── translations.ts        # Translation dictionaries EN/FR/DE (all pages + nav + audit + common)
│   ├── types.ts               # TypeScript interfaces
│   ├── task-constants.ts      # Shared task icons (TASK_ICONS)
│   └── offline-queue.ts       # IndexedDB persistence layer
├── store/
│   └── app.store.ts           # Zustand store (auth + offline state)
└── package.json
```

## Authentication Flow

```
Login Page                    Next.js API Routes             Go API
    │                              │                           │
    ├── POST /auth/login ──────────┼──────────────────────────►│
    │                              │                           │
    │◄── {access_token,            │                           │
    │     refresh_token, user}     │                           │
    │                              │                           │
    ├── POST /api/auth/set-token ─►│                           │
    │   {refresh_token}            ├── Set httpOnly cookie     │
    │                              │                           │
    ├── Zustand: setAccessToken ───┤                           │
    │   (memory only)              │                           │
    │                              │                           │
    │  --- On 401 ---              │                           │
    │                              │                           │
    ├── POST /api/auth/refresh ───►│                           │
    │   (cookie sent auto)         ├── POST /auth/refresh ────►│
    │                              │   {refresh_token}         │
    │◄── {access_token}            │◄── new tokens             │
    │                              │                           │
    ├── Retry original request     │                           │
```

### Token Storage

| Token | Storage | Rationale |
|-------|---------|-----------|
| Access token | Zustand (memory) | Cleared on page refresh, no XSS exposure |
| Refresh token | httpOnly cookie (via Next.js API route) | Not accessible to JavaScript |
| User role | httpOnly cookie (`user_role`) | UX-only route guard for `/admin` in middleware — backend RBAC is the real authority |

### MFA Support

The login page handles TOTP-based MFA:

1. User submits email + password
2. If MFA is enabled, API returns `{mfa_required: true, mfa_token: "..."}`
3. Page switches to 6-digit code input
4. Auto-submits when 6 digits are entered
5. On success, stores tokens and redirects to `/dashboard`

### Cloudflare Turnstile (Anti-Bot)

The login page includes a Cloudflare Turnstile widget (compact, dark theme) to prevent bot login attempts. Uses **auto-rendering** via a `cf-turnstile` div with `data-callback` pointing to a global function (`__hmTurnstileCb`) that stores the token in React state. The token is sent as `cf_turnstile_response` in the login request body.

The Turnstile widget is positioned with `absolute` CSS to avoid layout shift during loading. If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is not set, the widget is not rendered and the token is not sent (dev mode — backend skips verification when `TURNSTILE_SECRET_KEY` is empty).

The login page background image uses `fetchPriority="high"` to ensure it loads immediately and avoids a flash of unstyled content.

### Logo in Standalone Mode

The logo (`logo-crest-v2.png`) uses a **static import** to work in Next.js standalone Docker mode:

```tsx
import logoCrest from "@/public/logo-crest-v2.png";
// ...
<img src={logoCrest.src} alt="Heritage Motor" className="h-[88px] w-auto" />
```

In standalone mode, Next.js does NOT serve `public/` files directly. Static imports are bundled by webpack into `/_next/static/media/` which IS included in the standalone output. This pattern is used in both `login/page.tsx` and `components/layout/TopBar.tsx`.

## API Client

`lib/api.ts` provides a typed HTTP client with automatic token refresh:

```typescript
const vehicle = await api.get<Vehicle>(`/vehicles/${id}`);
await api.post(`/vehicles/${id}/move`, { bay_id: targetBayId });
await api.upload(`/vehicles/${id}/documents`, formData);
```

Features:
- Automatic `Authorization: Bearer` header injection from Zustand store
- Auto-refresh on 401: calls `/api/auth/refresh`, retries original request
- FormData detection: skips `Content-Type` header for multipart uploads
- Redirect to `/login` on refresh failure
- Typed error class `ApiError` with HTTP status code

## State Management

### Zustand Store (`store/app.store.ts`)

```typescript
interface AppState {
  accessToken: string | null;   // JWT access token (memory only)
  user: User | null;            // Current user object
  pendingCount: number;         // Offline queue count
  setAccessToken(token: string): void;
  setUser(user: User): void;
  logout(): void;
  setPendingCount(count: number): void;
}
```

### Data Fetching (SWR)

Custom hooks wrap SWR for data fetching:

```typescript
// hooks/useVehicle.ts
export function useVehicle(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Vehicle>(
    id ? `/vehicles/${id}` : null,
    (url: string) => api.get<Vehicle>(url)
  );
  return { vehicle: data, error, isLoading, mutate };
}
```

The dashboard page uses SWR with a 30-second refresh interval for vehicle list.

## Offline Support

### Architecture

```
User Action
    │
    ├── Online? ──► api.post() ──► Success
    │
    └── Offline? ──► pushAction() ──► IndexedDB
                                        │
                        useOfflineQueue ─┤
                        (30s interval)   │
                                         ├── Online? ──► syncAction() ──► api.post()
                                         │                                   │
                                         │                               ┌── Success ──► removeAction()
                                         │                               │
                                         │                               ├── 4xx ──► status: "failed"
                                         │                               │
                                         │                               └── Network ──► retry (exp backoff)
                                         │
                                         └── Offline? ──► skip
```

### IndexedDB Schema (`lib/offline-queue.ts`)

- Database: `heritage-motor`
- Object Store: `pending_actions`
- Key Path: `id` (UUID)

### PendingAction Type

```typescript
interface PendingAction {
  id: string;
  type: "move" | "task" | "photo" | "exit";
  vehicle_id: string;
  payload: Record<string, unknown>;
  photos: Blob[];
  created_at: string;
  status: "pending" | "syncing" | "failed";
}
```

### Sync Logic (`hooks/useOfflineQueue.ts`)

- Listens for `online` browser event to trigger sync
- Polls every 30 seconds when online
- Processes actions in FIFO order (sorted by `created_at`)
- Exponential backoff on network errors: 1s, 2s (2 retries max, cap at 10s)
- Client errors (4xx) mark action as `failed` — no retry

## QR Scanner

### Component (`components/scanner/QRScanner.tsx`)

Uses `@zxing/browser` for real-time QR code scanning:

1. Requests camera permission via `getUserMedia()` (triggers browser prompt on mobile)
2. Lists video input devices (requires prior permission grant to enumerate)
3. Prefers back/rear camera
4. Decodes continuously from video stream
5. Haptic feedback on successful scan (`navigator.vibrate(100)`)
6. Stops scanning after first result to prevent duplicate resolution

### Scan Flow

```
QR Code → QRScanner → resolveToken(token)
                          │
                          ├── GET /scan/{token}
                          │
                          ├── vehicle → /vehicle/{id}
                          └── bay → /bay/{id}
```

Fallback: manual code entry for devices without camera access.

## Page Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/` | No | Redirects to `/dashboard` |
| `/login` | No | Login form + MFA verification |
| `/change-password` | Yes | Password change (strength meter, checklist) |
| `/admin` | Yes (superadmin) | Legacy admin page |
| `/admin/qr-codes` | Yes (admin) | QR code generation and printing |
| `/scan` | Yes | QR scanner + bottom sheets (vehicles, bays, tasks) |
| `/dashboard` | Yes | 2-column desktop (fleet 2/3 + activity 1/3), tabbed mobile, quick actions, stats |
| `/vehicles` | Yes | Full vehicle list with search, status filters, table (desktop) / cards (mobile) |
| `/profile` | Yes | User profile (MFA setup/disable, logout) |
| `/tasks` | Yes | Task list with filters, edit (technician+), delete (admin) |
| `/users` | Yes (admin) | User management CRUD |
| `/audit` | Yes (admin) | Audit log with resource type filters and pagination |
| `/qr-codes` | Yes (admin) | QR code generation and printing |
| `/vehicle/new` | Yes | New vehicle onboarding form (with tags) |
| `/vehicle/[id]` | Yes | Vehicle detail with timeline, tags, documents, add note/incident, delete (admin) |
| `/vehicle/[id]/edit` | Yes | Edit vehicle details (with tags) |
| `/vehicle/[id]/move` | Yes | Bay selector for vehicle relocation |
| `/vehicle/[id]/task` | Yes | Task completion form |
| `/vehicle/[id]/photo` | Yes | Camera capture and photo upload |
| `/vehicle/[id]/exit` | Yes | Vehicle exit confirmation |
| `/bays` | Yes | Bay list with status filters and stats |
| `/bay/new` | Yes | Create new bay |
| `/bay/[id]` | Yes | Bay detail view |
| `/bay/[id]/edit` | Yes | Edit bay details |
| `not-found` | No | Custom 404 page (dark luxury theme) |

## Role-Based UI

The vehicle detail page conditionally shows actions based on user role:

| Action | Required Role |
|--------|--------------|
| Move Vehicle | `admin`, `operator` |
| Maintenance Tasks | `admin`, `operator`, `technician` |
| Add Photo | `admin`, `operator`, `technician` |
| Exit Vehicle | `admin`, `operator` |
| Add Note / Report Incident | `admin`, `operator`, `technician` |
| Delete Vehicle (soft) | `admin` |
| Delete Document | `admin` |
| Edit Task | `admin`, `operator`, `technician` |
| Delete Task | `admin` |
| View Audit Log | `admin` |
| Generate PDF Report | `admin`, `operator` |

Role is read from the Zustand store (`user.role`) and checked client-side. Server-side RBAC middleware provides the enforcement layer.

## Layout System

### AppShell

Responsive layout that adapts to viewport:

**Mobile / Tablet (< lg)**
```
┌──────────────────┐
│     TopBar       │  ← Fixed top, bell + sync badge + avatar
├──────────────────┤
│                  │
│   Main Content   │  ← pt-16 pb-20 px-4, max-w-2xl
│                  │
├──────────────────┤
│   BottomNav      │  ← Fixed bottom (Home, Scan, Bays, Profile)
└──────────────────┘
```

**Desktop (lg+)**
```
┌────────┬─────────────────────────┐
│        │    DesktopTopBar        │  ← Page title + bell + avatar
│ Side   ├─────────────────────────┤
│ Nav    │                         │
│ 220px  │    Main Content         │  ← max-w-900px, px-9 py-7
│        │                         │
│        │                         │
└────────┴─────────────────────────┘
```

**Wide mode** (`<AppShell wide>`): removes the 900px max-width, content fills available width. Used by the dashboard for the 2-column layout (fleet 2/3 + activity sidebar 1/3).

**Dashboard Desktop (lg+)**
```
┌────────┬──────────────────┬──────────┐
│        │   DesktopTopBar               │
│ Side   ├──────────────────┬──────────┤
│ Nav    │                  │ Activity │
│ 220px  │  Fleet (2/3)     │ Feed     │
│        │  quick actions   │ (1/3)    │
│        │  search + table  │ sticky   │
└────────┴──────────────────┴──────────┘
```

### Navigation

**Mobile/Tablet:** Bottom navigation bar with four tabs:
- **Home** — Dashboard with vehicle registry, stats, quick actions
- **Scan QR** — QR scanner with bottom sheets (primary workflow entry)
- **Bays** — Bay list with status filters and stats
- **Profile** — User profile, MFA settings, logout

**Desktop:** Sidebar navigation (SideNav, 220px) with role-based items:
- All roles: Home, Vehicles, Scan, Bays, Tasks
- Admin/Operator: + QR Codes
- Admin: + Team, + Audit Log
- Superadmin: + Admin
- Profile at bottom with separator

TopBar (mobile) includes a notification bell (pending task count via SWR), sync badge, language switcher (SVG flags), and profile avatar (initials). DesktopTopBar shows the current page label, bell, language switcher, and avatar.

### Language Switcher & i18n

Shared `LangSwitcher` component (`components/ui/LangSwitcher.tsx`) used in both TopBar and DesktopTopBar. Features:
- Inline SVG flags (UK, France, Germany) — no emoji for cross-platform consistency
- Dropdown with `aria-expanded`, click-outside-to-close
- Reads/writes `localStorage('hm-lang')` — shared with landing pages
- Three languages: EN (default), FR, DE
- **Broadcast mechanism**: `broadcastLang()` from `lib/i18n.ts` notifies all `useI18n()` hooks in real-time — no page reload needed

**PWA i18n architecture** (`lib/i18n.ts` + `lib/translations.ts`):
- `useI18n(dict)` hook: reads `localStorage('hm-lang')`, subscribes to broadcast updates, returns `{ lang, t }`
- `broadcastLang(l)` : called by LangSwitcher, updates all subscribed hooks via in-memory listener set
- Translation dictionaries in `lib/translations.ts`: `dashboardI18n`, `baysI18n`, `tasksI18n`, `profileI18n`, `scanI18n`, `activityI18n`, `auditI18n`, `navI18n`, `pageLabelsI18n`, `commonI18n`
- Login and change-password pages use their own local `loginI18n` / `cpI18n` dicts (pre-existing pattern)
- Translated pages: dashboard, vehicles, bays, tasks, profile, scan (+ all sheets), audit, SideNav, BottomNav, DesktopTopBar, ActivityFeed, login, change-password

## Design System (Dark Luxury)

Fully dark theme inspired by the landing page (Ferrari/Porsche aesthetic). Consistent across all pages.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| black | `#0e0d0b` | Background principal (AppShell, all pages) |
| dark | `#1a1916` | Card backgrounds, elevated surfaces |
| dark-2 | `#141310` | Deeper surfaces (stats cards) |
| gold | `#b8955a` | Primary accent, active states, borders |
| gold-lt | `#d4b07a` | Light gold gradients |
| gold-dk | `#96773e` | Dark gold gradients |
| white | `#faf9f7` | Primary text |
| success | `#22c55e` | "Stored" / "Free" status |
| warning | `#f59e0b` | "Occupied" / "Maintenance" status |
| danger | `#ef4444` | Errors, destructive actions |

### Typography

- Heading font: `DM Sans 300` (sans-serif, `font-light tracking-[0.03em] leading-[1.2]` — never bold, never serif)
- Body font: `DM Sans` (sans-serif, body text, labels, buttons)
- Brand/logo font: `Cormorant Garamond` (serif, `font-display` — ONLY for "HM" logo text and "Heritage Motor" on login/admin header)

### Component Patterns

- Glass cards: `bg-white/[0.03] border border-white/[0.06] rounded-2xl`
- Inputs: `bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20`
- Section labels: `text-sm font-semibold text-white/30 uppercase tracking-wider`
- Status pills active: `bg-gold/15 text-gold border-gold/30`
- Status pills inactive: `bg-white/[0.04] text-white/50 border-white/[0.06]`
- Loading: skeleton placeholders with `skeleton` class
- Gold top border accent: `gold-border-top` class on cards
- Card hover lift: `card-lift` class (translateY(-4px) + gold glow on hover)

### Accessibility

- Toggle/filter buttons use `aria-pressed` (dashboard tabs, status filters, bay features)
- Language switcher uses `aria-expanded`
- All interactive elements have `aria-label` where visible text is absent
- Touch targets: min 44x44px (`touch-target` class)
- Safe areas for iOS/Android notches (`safe-top`, `safe-bottom`)

### Reveal Animations

Scroll-triggered animations via `useReveal` hook (IntersectionObserver):

- `reveal-up` — fade-in + slide-up (28px), 0.9s with `--ease-lux` timing
- `reveal-d1` through `reveal-d6` — staggered delays (0.1s increments)
- Section tags: `section-tag` class (uppercase, gold flanking lines)
- Gold separators: `gold-sep` class (horizontal gradient line)

### PageHeader Component

Reusable header used across all sub-pages:

```tsx
<PageHeader
  title="Edit Bay"
  subtitle={bay.code}
  backHref={`/bay/${id}`}
  action={<button>Save</button>}
/>
```

Props: `title` (string), `subtitle?` (string), `backHref?` (string, defaults to router.back()), `action?` (ReactNode)

## Build & Deployment

### Docker Build

Multi-stage build in `pwa/Dockerfile`:

1. **deps** — install node_modules
2. **builder** — `next build` with build args for `NEXT_PUBLIC_*` env vars
3. **runner** — minimal Node.js image with standalone output

**Critical**: `NEXT_PUBLIC_*` variables are inlined into the client-side bundle at build time by Next.js. They must be passed as Docker `ARG` (not just runtime `ENV`). The Dockerfile declares `ARG NEXT_PUBLIC_API_URL` and `ARG NEXT_PUBLIC_APP_URL` before `npm run build`, and `compose.yaml` passes them via `build.args`. Runtime `environment` is also needed for server-side API routes (refresh, logout).

To rebuild with updated env vars:
```bash
docker compose build app --no-cache
docker compose up -d app
```

### Environment Variables

| Variable | Required | Build-time | Description |
|----------|----------|------------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Yes (ARG) | Backend API base URL (e.g., `https://api.heritagemotor.app/api/v1`) |
| `NEXT_PUBLIC_APP_URL` | No | Yes (ARG) | Frontend app URL (e.g., `https://app.heritagemotor.app`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Yes (ARG) | Cloudflare Turnstile site key for login anti-bot widget (if empty, widget not rendered) |

### PWA Manifest

Configured in `app/layout.tsx`:
- `manifest: "/manifest.json"`
- Apple Web App capable with `black-translucent` status bar
- Viewport: `width=device-width`, `initialScale=1`, `maximumScale=1`, `user-scalable=true` (WCAG)
- Theme color: `#0e0d0b`
