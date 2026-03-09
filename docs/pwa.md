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
│   ├── page.tsx               # Root redirect → /scan
│   ├── login/
│   │   ├── layout.tsx         # Login layout (no AppShell)
│   │   └── page.tsx           # Login + MFA verification
│   ├── scan/
│   │   ├── layout.tsx         # Scan layout (no AppShell)
│   │   └── page.tsx           # QR scanner + manual code entry
│   ├── dashboard/
│   │   ├── layout.tsx         # Dashboard layout
│   │   └── page.tsx           # Vehicle list with search & filters
│   ├── vehicle/[id]/
│   │   ├── layout.tsx         # Vehicle detail layout
│   │   ├── page.tsx           # Vehicle detail + timeline
│   │   ├── move/page.tsx      # Move vehicle to another bay
│   │   ├── task/page.tsx      # Task completion
│   │   ├── photo/page.tsx     # Photo capture and upload
│   │   └── exit/page.tsx      # Vehicle exit confirmation
│   ├── bay/[id]/
│   │   ├── layout.tsx         # Bay detail layout
│   │   └── page.tsx           # Bay detail view
│   └── api/auth/
│       ├── set-token/route.ts   # Store refresh token as httpOnly cookie
│       ├── refresh/route.ts     # Proxy refresh through Next.js (cookie → API)
│       ├── logout/route.ts      # Proxy logout to backend + clear cookie
│       └── clear-token/route.ts # Clear refresh token cookie on logout
├── middleware.ts                 # Auth guard + role-based route protection (/admin → superadmin only)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx       # TopBar + main content + BottomNav
│   │   ├── TopBar.tsx         # App header with sync badge
│   │   └── BottomNav.tsx      # Fixed bottom navigation (Scan, Vehicles)
│   ├── ui/
│   │   ├── ActionButton.tsx   # Styled button with loading state
│   │   ├── VehicleCard.tsx    # Vehicle summary card
│   │   ├── EventItem.tsx      # Timeline event display
│   │   ├── BaySelector.tsx    # Bay picker for move actions
│   │   ├── SyncBadge.tsx      # Pending offline actions indicator
│   │   ├── Skeleton.tsx       # Loading skeletons
│   │   └── SuccessScreen.tsx  # Success confirmation screen
│   ├── camera/
│   │   ├── CameraCapture.tsx  # Camera interface for photos
│   │   └── PhotoGrid.tsx      # Photo preview grid
│   └── scanner/
│       └── QRScanner.tsx      # QR code scanner with @zxing
├── hooks/
│   ├── useVehicle.ts          # SWR hooks for vehicle data + timeline
│   ├── useBay.ts              # SWR hooks for bay data
│   ├── useCamera.ts           # Photo capture state management
│   └── useOfflineQueue.ts     # Offline queue sync with retry
├── lib/
│   ├── api.ts                 # API client with auto-refresh
│   ├── auth.ts                # Login, MFA, logout functions
│   ├── types.ts               # TypeScript interfaces
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
5. On success, stores tokens and redirects to `/scan`

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
- Exponential backoff on network errors: 1s, 2s, 4s, 8s, 16s (5 retries max, cap at 30s in code)
- Client errors (4xx) mark action as `failed` — no retry

## QR Scanner

### Component (`components/scanner/QRScanner.tsx`)

Uses `@zxing/browser` for real-time QR code scanning:

1. Lists video input devices
2. Prefers back/rear camera
3. Decodes continuously from video stream
4. Haptic feedback on successful scan (`navigator.vibrate(100)`)
5. Stops scanning after first result to prevent duplicate resolution

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
| `/` | No | Redirects to `/scan` |
| `/login` | No | Login form + MFA verification |
| `/admin` | Yes (superadmin) | Platform administration (tenants, invitations) |
| `/scan` | Yes | QR scanner (default landing page) |
| `/dashboard` | Yes | Vehicle list with search and status filters |
| `/vehicle/[id]` | Yes | Vehicle detail with timeline and actions |
| `/vehicle/[id]/move` | Yes | Bay selector for vehicle relocation |
| `/vehicle/[id]/task` | Yes | Task completion form |
| `/vehicle/[id]/photo` | Yes | Camera capture and photo upload |
| `/vehicle/[id]/exit` | Yes | Vehicle exit confirmation |
| `/bay/[id]` | Yes | Bay detail view |

## Role-Based UI

The vehicle detail page conditionally shows actions based on user role:

| Action | Required Role |
|--------|--------------|
| Move Vehicle | `admin`, `operator` |
| Maintenance Tasks | `admin`, `operator`, `technician` |
| Add Photo | `admin`, `operator`, `technician` |
| Exit Vehicle | `admin`, `operator` |

Role is read from the Zustand store (`user.role`) and checked client-side. Server-side RBAC middleware provides the enforcement layer.

## Layout System

### AppShell

Wraps authenticated pages with consistent layout:

```
┌──────────────────┐
│     TopBar       │  ← Fixed top, sync badge
├──────────────────┤
│                  │
│   Main Content   │  ← pt-14 pb-20 px-4
│                  │
├──────────────────┤
│   BottomNav      │  ← Fixed bottom (Scan, Vehicles)
└──────────────────┘
```

### Navigation

Bottom navigation bar with two tabs:
- **Scan** — QR scanner (primary workflow entry)
- **Vehicles** — Dashboard with search and filters

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Brand gold | `#b8955a` | Primary actions, active states, accents |
| Dark background | `#0e0d0b` | Login, TopBar, BottomNav |
| Light background | `#faf9f7` | Main content area |
| Text primary | `#0e0d0b` | Body text on light backgrounds |
| Text on dark | `#faf9f7` | Text on dark backgrounds |
| Error red | `#ef4444` | Error messages |
| Success green | `#22c55e` | "Stored" status badge |
| Warning amber | `#f59e0b` | "Maintenance" status badge |

### Typography

- Display font: `font-display` (headings, branding)
- Body: `DM Sans` (Google Font loaded in `globals.css`, configured in `tailwind.config.ts`)

### Component Patterns

- Rounded corners: `rounded-xl` (inputs), `rounded-2xl` (cards)
- Borders: `border-[#0e0d0b]/5` (light), `border-white/10` (dark)
- Loading: skeleton placeholders with `skeleton` class
- Status badges: colored pill with `rounded-full`

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

### PWA Manifest

Configured in `app/layout.tsx`:
- `manifest: "/manifest.json"`
- Apple Web App capable with `black-translucent` status bar
- Viewport: `width=device-width`, `initialScale=1`, `maximumScale=1`, `user-scalable=false`
- Theme color: `#0e0d0b`
