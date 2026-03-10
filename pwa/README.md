# Heritage Motor PWA

Application mobile-first (Progressive Web App) pour les opérateurs de facilities de stockage de vehicules de collection.

## Stack

| Technologie | Rôle |
|---|---|
| Next.js 14 (App Router) | Framework React, SSR, routing |
| TypeScript | Typage statique |
| Tailwind CSS | Styling utilitaire |
| Zustand | State management (auth, offline count) |
| SWR | Data fetching (stale-while-revalidate) |
| next-pwa | Service worker, mode offline |
| idb | IndexedDB wrapper (offline queue) |
| @zxing/browser | Scan QR code via camera |
| react-hook-form | Gestion formulaires |
| react-doctor | Diagnostic React (60+ lint rules, dead code) |

## Lancement

```bash
cd pwa
npm install
npm run dev     # http://localhost:3000
npm run build   # Production build (standalone)
npm run lint    # ESLint
npm run doctor  # react-doctor diagnostics (score 100/100)
```

Variable d'environnement requise :
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

## Architecture

```
pwa/
  app/
    layout.tsx                    Root layout (fonts, providers, metadata)
    page.tsx                      Redirect -> /scan
    globals.css                   Animations, touch targets, safe areas
    login/page.tsx                Login (email/password + MFA, show/hide password)
    change-password/page.tsx      Changement mdp (PasswordInput, barre de force, checklist)
    dashboard/page.tsx            Liste vehicules (recherche, filtres)
    scan/page.tsx                 Scanner QR -> detail vehicule/bay
    admin/page.tsx                Superadmin (tenants CRUD, invitations, custom Select)
    vehicle/[id]/
      page.tsx                    Detail vehicule + timeline
      move/page.tsx               Deplacement vers un bay
      exit/page.tsx               Sortie vehicule (photos + checklist)
      task/page.tsx               Completion de tache
      photo/page.tsx              Upload photos
    bay/[id]/page.tsx             Detail bay + vehicules
    api/auth/
      refresh/route.ts            BFF : cookie -> backend -> access token
      set-token/route.ts          BFF : stocke refresh token en cookie httpOnly
      logout/route.ts             BFF : revoque token + supprime cookie
      clear-token/route.ts        Suppression cookie (fallback)
  components/
    AuthBootstrap.tsx             Restaure session au mount (cookie → Zustand)
    layout/
      AppShell.tsx                Wrapper (TopBar + BottomNav + contenu)
      TopBar.tsx                  Header fixe (logo, SyncBadge, user)
      BottomNav.tsx               Navigation mobile (Scan, Vehicules)
    ui/
      ActionButton.tsx            Bouton CTA (primary/danger/secondary)
      VehicleCard.tsx             Carte vehicule (memo)
      EventItem.tsx               Evenement timeline
      BaySelector.tsx             Selection de bay (recherche + liste)
      SuccessScreen.tsx           Ecran de confirmation
      SyncBadge.tsx               Badge actions offline en attente
      Skeleton.tsx                Placeholder chargement
    camera/
      CameraCapture.tsx           Capture photo (getUserMedia, 1920x1080 JPEG)
      PhotoGrid.tsx               Grille photos (3 colonnes)
    scanner/
      QRScanner.tsx               Lecteur QR code (@zxing, camera arriere)
    providers/
      SWRProvider.tsx              Config SWR (fetcher, retry, dedup)
  hooks/
    useVehicle.ts                 SWR : GET /vehicles/:id
    useBay.ts                     SWR : GET /bays, GET /bays/:id
    useCamera.ts                  State photos + cleanup URLs
    useOfflineQueue.ts            Sync IndexedDB (online event + poll 30s)
  lib/
    api.ts                        Client HTTP (auto-refresh 401, FormData)
    auth.ts                       Login, MFA verify, logout
    types.ts                      Interfaces TypeScript
    offline-queue.ts              CRUD IndexedDB (pushAction, getAll, remove)
  store/
    app.store.ts                  Zustand (accessToken, pendingCount, logout)
  middleware.ts                   Guard auth (redirect /login si pas de cookie)
```

## Patterns cles

### Auth (BFF)

Le refresh token est stocke dans un cookie `httpOnly` (inaccessible au JS).
Les routes Next.js `/api/auth/*` servent de proxy vers le backend Go.

```
Login -> backend retourne access + refresh token
      -> access token en memoire (Zustand)
      -> refresh token en cookie httpOnly (via /api/auth/set-token)
      -> 401 sur requete -> auto-refresh via /api/auth/refresh (sans condition sur token)
      -> F5/refresh -> AuthBootstrap restaure depuis cookie -> Zustand hydrate
```

**Important** : Le handler 401 dans `api.ts` ne doit JAMAIS conditionner le refresh sur `token` en memoire (Zustand est in-memory, `token = null` apres refresh). Il tente toujours le refresh via le cookie httpOnly.

### Offline Queue

Les actions move/task/exit peuvent fonctionner hors ligne :
1. Tentative en ligne via `api.post()`
2. Si erreur reseau (pas `ApiError`) -> `pushAction()` en IndexedDB
3. `useOfflineQueue()` ecoute `online` event + poll 30s
4. Sync avec retry exponentiel (max 6 tentatives, 30s max delay)
5. Photos non serialisables en IndexedDB -> upload uniquement en ligne

### Data Fetching

- **SWR** pour les lectures (GET) avec refresh 30s
- **api.ts** pour les mutations (POST/PATCH/DELETE)
- `SWRProvider` configure le fetcher global (`api.get`)

### Design System (Dark Luxury)

Theme entierement sombre, inspire de la landing page (Ferrari/Porsche aesthetic).

| Token | Valeur |
|---|---|
| black | `#0e0d0b` (background principal) |
| gold | `#b8955a` (accent luxe) |
| white | `#faf9f7` (texte primaire) |
| success | `#22c55e` |
| warning | `#f59e0b` |
| danger | `#ef4444` |
| Font display | Cormorant Garamond (serif, font-light pour headings) |
| Font body | DM Sans (sans-serif) |

| Element | Classes Tailwind |
|---|---|
| Glass card | `bg-white/[0.03] border border-white/[0.06] rounded-2xl` |
| Input | `bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40` |
| Section label | `text-sm font-semibold text-white/30 uppercase tracking-wider` |
| Heading | `font-display font-light tracking-wide text-white` |
| Status pill actif | `bg-gold/15 text-gold border-gold/30` |
| Status pill inactif | `bg-white/[0.04] text-white/50 border-white/[0.06]` |

Touch targets : min 44x44px. Safe areas iOS/Android gerees.

### Composants inline notables

| Composant | Fichier | Description |
|---|---|---|
| `PasswordInput` | `change-password/page.tsx` | Input mot de passe avec toggle show/hide (eye icon) |
| `getStrength` + barre | `change-password/page.tsx` | Indicateur de force (5 segments Weak→Excellent) + checklist (8+ chars, upper, lower, digit, special) |
| `Select` | `admin/page.tsx` | Dropdown custom dark/gold remplacant les `<select>` natifs, click-outside-to-close |
| `TenantRow` | `admin/page.tsx` | Ligne tenant expandable (edit inline + delete 2-step confirmation) |
| `AuthBootstrap` | `components/AuthBootstrap.tsx` | Restaure session au mount via useSWR + cookie httpOnly → `/api/auth/refresh` → Zustand (onSuccess callback). Affiche spinner pendant hydratation. Sans lui, toute page auth est blanche apres F5. |

## react-doctor (100/100)

Le projet maintient un score de 100/100 sur react-doctor. Config dans `react-doctor.config.json`.

```bash
npm run doctor           # Score rapide
npm run doctor:verbose   # Detail par fichier
```

### Regles appliquees

| Regle | Pattern applique |
|---|---|
| useReducer consolidation | `const [{ a, b }, set] = useReducer((s, a) => ({...s, ...a}), init)` — remplace 3+ useState |
| next/image obligatoire | `<Image fill unoptimized sizes="33vw">` pour blob URLs camera |
| Labels accessibilite | `<label>` wrapping natif, `htmlFor`+`id` pour composants custom |
| Pas d'autoFocus | Supprime sur inputs MFA/scan (probleme accessibilite) |
| Keys stables | `key={photo.preview}` ou `key={item.id}`, jamais `key={index}` sur listes dynamiques |
| Pas de dead code | Exports non utilises supprimes (`clearCompleted`, `Tenant` rendu local) |
| fetch → SWR | AuthBootstrap utilise useSWR au lieu de fetch-in-useEffect |
| redirect() | Admin page utilise `redirect()` de next/navigation au lieu de useEffect+router.replace |

## Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Output `standalone` configure dans `next.config.js`.
