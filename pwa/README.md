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
    page.tsx                      Redirect -> /dashboard
    globals.css                   Animations, touch targets, safe areas
    login/page.tsx                Login (email/password + MFA, show/hide password)
    change-password/page.tsx      Changement mdp (PasswordInput, barre de force, checklist)
    dashboard/page.tsx            Dashboard unifie : registre vehicules + quick links par role (superadmin voit "Admin Panel")
    scan/page.tsx                 Scanner QR + bottom sheets (→ components/scan/)
    profile/page.tsx              Profil utilisateur (→ components/profile/TOTPSetup)
    tasks/page.tsx                Liste taches (→ components/tasks/CreateTaskModal)
    users/page.tsx                Gestion utilisateurs (→ components/users/UserFormModal)
    qr-codes/page.tsx             Generation et impression QR codes (admin only)
    admin/
      page.tsx                    Panel superadmin (→ components/admin/)
      qr-codes/page.tsx           Generation et impression QR codes (legacy)
    vehicle/new/page.tsx          Onboarding nouveau vehicule
    vehicle/[id]/
      page.tsx                    Detail vehicule + timeline
      edit/page.tsx               Edition vehicule
      move/page.tsx               Deplacement vers un bay
      exit/page.tsx               Sortie vehicule (photos + checklist)
      task/page.tsx               Completion de tache
      photo/page.tsx              Upload photos
    bays/page.tsx                 Liste bays (filtres statut, stats)
    bay/new/page.tsx              Creation bay
    bay/[id]/
      page.tsx                    Detail bay + vehicules
      edit/page.tsx               Edition bay
    api/auth/
      refresh/route.ts            BFF : cookie -> backend -> access token
      set-token/route.ts          BFF : stocke refresh token en cookie httpOnly
      logout/route.ts             BFF : revoque token + supprime cookie
      clear-token/route.ts        Suppression cookie (fallback)
  components/
    AuthBootstrap.tsx             Restaure session au mount (cookie → Zustand)
    ErrorBoundary.tsx             Error boundary global (react-error-boundary, fallback plein ecran)
    layout/
      AppShell.tsx                Wrapper (TopBar + BottomNav + contenu)
      TopBar.tsx                  Header fixe (logo, SyncBadge, user)
      BottomNav.tsx               Navigation mobile (Home, Scan, Bays, Profile)
    ui/
      ActionButton.tsx            Bouton CTA (primary/danger/secondary)
      PageHeader.tsx              Header reutilisable (bouton retour, titre, subtitle, action slot)
      VehicleCard.tsx             Carte vehicule (memo, gold-border-top, card-lift)
      EventItem.tsx               Evenement timeline
      BaySelector.tsx             Selection de bay (recherche + liste)
      SuccessScreen.tsx           Ecran de confirmation
      SyncBadge.tsx               Badge actions offline en attente
      Skeleton.tsx                Placeholder chargement
      CookieBanner.tsx            Modal consentement cookies GDPR (overlay centre, blur backdrop, toggles essentiels/analytics)
    camera/
      CameraCapture.tsx           Capture photo (getUserMedia, 1920x1080 JPEG)
      PhotoGrid.tsx               Grille photos (3 colonnes)
    admin/
      AdminSelect.tsx             Select custom dark/gold
      CreateTenantForm.tsx        Formulaire creation tenant
      InviteSection.tsx           Section invitation utilisateur
      QuickLinks.tsx              Liens rapides admin
      SectionHeading.tsx          Heading section avec tag
      StatsSection.tsx            Grille statistiques plateforme
      TenantRow.tsx               Ligne tenant expandable (edit/delete)
      TenantsSection.tsx          Liste tenants avec creation
    profile/
      TOTPSetup.tsx               Setup/disable MFA (QR code, verification)
    scan/
      BaysSheet.tsx               Bottom sheet liste bays
      ManualSheet.tsx             Bottom sheet saisie manuelle
      StatusBadge.tsx             Badge statut vehicule/bay
      TasksSheet.tsx              Bottom sheet taches en attente
      VehiclesSheet.tsx           Bottom sheet liste vehicules
    tasks/
      CreateTaskModal.tsx         Modal creation tache (recherche vehicule)
    users/
      UserFormModal.tsx           Modal creation/edition utilisateur
    scanner/
      QRScanner.tsx               Lecteur QR code (@zxing, getUserMedia prompt + camera arriere)
    providers/
      SWRProvider.tsx              Config SWR (fetcher, retry, dedup)
  hooks/
    useVehicle.ts                 SWR : GET /vehicles/:id
    useBay.ts                     SWR : GET /bays, GET /bays/:id
    useCamera.ts                  State photos + cleanup URLs
    useOfflineQueue.ts            Sync IndexedDB (online event + poll 30s)
    useReveal.ts                  Animations reveal au scroll (IntersectionObserver)
  lib/
    api.ts                        Client HTTP (auto-refresh 401, FormData)
    auth.ts                       Login, MFA verify, logout
    types.ts                      Interfaces TypeScript
    task-constants.ts             Constantes partagées tâches (TASK_ICONS)
    offline-queue.ts              CRUD IndexedDB (pushAction, getAll, remove)
  store/
    app.store.ts                  Zustand (accessToken, pendingCount, logout)
  middleware.ts                   Guard auth (redirect /login si pas de cookie, /admin → superadmin, /users → admin)
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
| dark | `#1a1916` (surfaces elevees) |
| dark-2 | `#141310` (surfaces profondes, stats) |
| gold | `#b8955a` (accent luxe) |
| gold-lt | `#d4b07a` (gradients clairs) |
| gold-dk | `#96773e` (gradients sombres) |
| white | `#faf9f7` (texte primaire) |
| success | `#22c55e` |
| warning | `#f59e0b` |
| danger | `#ef4444` |
| Font display | Cormorant Garamond (serif, font-light pour headings — jamais bold) |
| Font body | DM Sans (sans-serif) |

| Element | Classes Tailwind |
|---|---|
| Glass card | `bg-white/[0.03] border border-white/[0.06] rounded-2xl` |
| Input | `bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40` |
| Section label | `text-sm font-semibold text-white/30 uppercase tracking-wider` |
| Heading | `font-display font-light tracking-wide text-white` |
| Status pill actif | `bg-gold/15 text-gold border-gold/30` |
| Status pill inactif | `bg-white/[0.04] text-white/50 border-white/[0.06]` |
| Card accent | `gold-border-top` (bordure or en haut) |
| Card hover | `card-lift` (translateY(-4px) + ombre or) |
| Section tag | `section-tag` (uppercase, lignes or flanquantes) |
| Separateur or | `gold-sep` (ligne gradient horizontale) |

#### Animations reveal (scroll)

Hook `useReveal` (IntersectionObserver) pour animations au scroll :
- `reveal-up` : fade-in + slide-up (28px), 0.9s avec `--ease-lux`
- `reveal-d1` a `reveal-d6` : delais progressifs (0.1s increments)
- Utilise sur dashboard (vehicle cards) et admin (stats, quick links)

#### PageHeader

Composant reutilisable pour navigation retour + titre + action :

```tsx
<PageHeader title="Edit Bay" subtitle={bay.code} backHref={`/bay/${id}`} action={<button>Save</button>} />
```

Utilise sur toutes les sous-pages (vehicle detail, move, exit, task, photo, bay detail, edit, bays list, admin/qr-codes).

Touch targets : min 44x44px. Safe areas iOS/Android gerees.

### Composants notables

| Composant | Fichier | Description |
|---|---|---|
| `PageHeader` | `components/ui/PageHeader.tsx` | Header reutilisable : bouton retour (backHref ou router.back()), titre serif, subtitle, slot action. Utilise sur toutes les sous-pages. |
| `PasswordInput` | `change-password/page.tsx` | Input mot de passe avec toggle show/hide (eye icon) |
| `getStrength` + barre | `change-password/page.tsx` | Indicateur de force (5 segments Weak→Excellent) + checklist (8+ chars, upper, lower, digit, special) |
| `AdminSelect` | `components/admin/AdminSelect.tsx` | Dropdown custom dark/gold remplacant les `<select>` natifs, click-outside-to-close |
| `TenantRow` | `components/admin/TenantRow.tsx` | Ligne tenant expandable (edit inline + delete 2-step confirmation) |
| `TOTPSetup` | `components/profile/TOTPSetup.tsx` | Setup/disable MFA avec QR code, verification TOTP |
| `CreateTaskModal` | `components/tasks/CreateTaskModal.tsx` | Modal creation tache avec recherche vehicule |
| `UserFormModal` | `components/users/UserFormModal.tsx` | Modal creation/edition utilisateur |
| `CookieBanner` | `components/ui/CookieBanner.tsx` | Modal GDPR consentement cookies (overlay centre, blur backdrop, toggles essentiels/analytics), persistence localStorage |
| `AppErrorBoundary` | `components/ErrorBoundary.tsx` | Error boundary global (react-error-boundary). Affiche fallback plein ecran dark luxury avec message d'erreur et bouton "Try again" (reload page). |
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
