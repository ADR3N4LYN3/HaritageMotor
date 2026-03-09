# Heritage Motor — Instructions Claude Code

> Ce fichier est chargé automatiquement par Claude Code. Il définit les règles **non-négociables** du projet.

## Identité du projet

**Heritage Motor** (`heritagemotor.app`) — Plateforme SaaS multi-tenant B2B pour la gestion opérationnelle de facilities de stockage de véhicules de collection et de prestige (Ferrari, Porsche, McLaren, Bugatti...).

**Ce n'est pas un CRM ni un ERP.** C'est un registre opérationnel de confiance pour des actifs à 200k–5M€. La valeur centrale est la **traçabilité complète** ("Vehicle Chain of Custody").

## Stack technique

| Composant | Choix |
|---|---|
| Backend | Go 1.22+ / Fiber v2 |
| Base de données | PostgreSQL 16 (RLS multi-tenant) |
| Frontend | Next.js + TypeScript (PWA dans `pwa/`) |
| Stockage fichiers | Hetzner Object Storage (S3-compatible) |
| Auth | Maison — JWT HS256 + bcrypt (cost 12) + TOTP |
| Config | godotenv + os.Getenv |
| Conteneurisation | Docker + Docker Compose |
| Reverse proxy | Caddy |
| Analytics | Plausible CE v2.1.4 (self-hosted) |
| Linter | golangci-lint (govet, errcheck, misspell) |
| Module Go | `github.com/chriis/heritage-motor` |

## Architecture des dossiers

```
cmd/
  api/main.go                    — Point d'entrée Fiber, toutes les routes + middleware chains
  bootstrap/main.go              — CLI création compte superadmin
internal/
  config/config.go               — Chargement env vars (godotenv + os.Getenv)
  auth/
    jwt.go                       — JWTManager : generate/validate access + MFA pending tokens
    password.go                  — HashPassword (bcrypt 12), CheckPassword
    totp.go                      — GenerateTOTPSecret, ValidateTOTPCode
  db/
    db.go                        — NewPool (owner), NewAppPool (heritage_app RLS)
    dbtx.go                      — Interface DBTX, WithTx/TxFromCtx/Conn
    migrate.go                   — RunMigrations (transactionnel, idempotent)
    migrations/                  — 001-018 (.up.sql + .down.sql)
  domain/
    types.go                     — Structs (User, Vehicle, Bay, Event, Task, Document, Tenant...)
    errors.go                    — ErrNotFound, ErrForbidden, ErrValidation, ErrConflict...
    password.go                  — ValidatePasswordStrength
  middleware/
    auth.go                      — JWT validation + blacklist cache (30s TTL)
    tenant.go                    — RLS tx injection (SET LOCAL app.current_tenant_id)
    rbac.go                      — RequireRole, RequireAdmin, RequireSuperAdmin...
    audit.go                     — Audit log async (POST/PATCH/DELETE)
    upload_limiter.go            — Rate limit uploads (200MB/10min/user)
  handler/
    response.go                  — HandleServiceError, PaginationParams, PaginatedResponse
    admin/ auth/ bay/ contact/ document/ event/ scan/ task/ user/ vehicle/
  service/
    admin/                       — Superadmin : tenants CRUD, invitations, dashboard
    auth/                        — Login, logout, refresh, MFA, change-password
    bay/ event/ task/ document/ user/ vehicle/   — CRUD + logique métier
    contact/                     — Formulaire contact public + email confirmation i18n (EN/FR/DE)
    mailer/                      — Envoi emails via Resend API
    plan/                        — Limites par plan (starter/pro/enterprise)
  storage/s3.go                  — Upload, GetSignedURL, Delete (aws-sdk-go-v2)
  testutil/setup.go              — Infrastructure tests intégration (Env, Setup, helpers)
web/static/
  index.html                     — Landing page (SEO, hero video, CTA)
  contact.html                   — Page contact (formulaire POST /api/v1/contact, lang auto)
  hero-bg.mp4                    — Vidéo hero (Remotion v2)
  logo.svg                       — Logo Heritage Motor
  logo-crest.svg                 — Shield crest logo (watermark vidéo + emails)
  logo-email.png / .svg          — Logo optimisé pour emails HTML
video/                           — Projet Remotion 4 (génération hero-bg.mp4, v2/v3/v4)
pwa/                             — Frontend Next.js PWA (voir pwa/README.md)
```

## Règles de sécurité impératives

### RLS (Row Level Security)
- **Dual pools** : `ownerPool` (migrations, auth login, audit) bypass RLS ; `appPool` (business) enforce RLS
- **Rôle dédié** : `heritage_app` — ne bypass JAMAIS le RLS
- **Flux middleware** : TenantMiddleware → begin tx sur appPool → `SET LOCAL app.current_tenant_id` → inject tx via `db.WithTx(ctx)`
- **DBTX** : `db.Conn(ctx, fallback)` retourne le tx du middleware si présent, sinon le fallback pool
- **FORCE RLS** activé sur toutes les tables business (migration 014)
- **Policies** : utilisent `current_setting('app.current_tenant_id', true)::UUID` (missing_ok = true)
- **tenant_id** vient TOUJOURS du JWT, JAMAIS du body ou d'un paramètre URL
- Ne JAMAIS faire de SELECT sans filtre `tenant_id` dans les services (RLS = filet de sécurité, pas mécanisme principal)

### Tables append-only
- `events` : JAMAIS d'UPDATE ni DELETE (règles PostgreSQL empêchent)
- `audit_log` : JAMAIS d'UPDATE ni DELETE

### Auth & secrets
- Mots de passe : bcrypt cost 12 minimum
- Access token JWT : 15 min, HS256, avec `jti` (UUID) pour blacklisting
- Refresh token : 7 jours, stocké en DB (SHA-256 hash), révocable
- MFA TOTP obligatoire (Google Authenticator)
- Secrets (JWT_SECRET, clés S3) TOUJOURS dans les variables d'env, JAMAIS dans le code
- Rate limiting : 5 req/15min/IP sur auth, 100 req/min/user sur routes authentifiées
- Upload limiter : 200MB cumulé / 10 min / user sur les endpoints upload
- Password strength : min 8 chars, upper+lower+digit+special

### Token blacklist (migration 015)
- Table `token_blacklist` en PostgreSQL (survit aux redémarrages)
- Entrées par `jti` (token spécifique) ou `user_id` (bloc user-level)
- Check dans AuthMiddleware : `SELECT EXISTS(... WHERE (jti=$1 OR user_id=$2) AND expires_at > NOW())`
- Fail-open avec warning log si DB indisponible
- Logout : blackliste l'access token + révoque le refresh token
- User delete : révoque tous refresh tokens + blackliste user_id pour durée access token
- Middleware order : Auth (+ blacklist) → Per-user limiter → RequirePasswordChanged → Tenant (RLS tx) → Audit
- Superadmin routes : Auth → RequireSuperAdmin → Audit (pas de TenantMiddleware, utilisent ownerPool)
- **Isolation obligatoire** : chaque chaîne middleware utilise `api.Group()` (PAS `api.Use()` qui accumule sur le même routeur). Tenant routes = `api.Group("")`, admin routes = `api.Group("/admin", ...)`

### Stockage S3
- Stocker UNIQUEMENT les clés S3 en DB, JAMAIS les URLs signées
- URLs signées générées à la volée : 15 min (photos), 60 min (documents)
- Clés S3 : `{tenant_id}/{resource_type}/{resource_id}/{timestamp}_{filename}`
- S3 errors sanitized — pas de credentials dans les logs

## RBAC — Matrice des permissions

5 rôles : `superadmin` (plateforme), `admin`, `operator`, `technician`, `viewer` (tenant).

| Action | superadmin | admin | operator | technician | viewer |
|---|---|---|---|---|---|
| Gérer tenants/plans | ✓ | ✗ | ✗ | ✗ | ✗ |
| Inviter users cross-tenant | ✓ | ✗ | ✗ | ✗ | ✗ |
| Dashboard plateforme | ✓ | ✗ | ✗ | ✗ | ✗ |
| Lire véhicules | — | ✓ | ✓ | ✓ | ✓ |
| Créer/modifier véhicule | — | ✓ | ✓ | ✗ | ✗ |
| Supprimer véhicule (soft) | — | ✓ | ✗ | ✗ | ✗ |
| Logger un événement | — | ✓ | ✓ | ✓ | ✗ |
| Uploader photos/docs | — | ✓ | ✓ | ✓ | ✗ |
| Gérer/compléter tâches | — | ✓ | ✓ | ✓ | ✗ |
| Voir audit log | — | ✓ | ✗ | ✗ | ✗ |
| Gérer utilisateurs | — | ✓ | ✗ | ✗ | ✗ |
| Gérer bays | — | ✓ | ✓ | ✗ | ✗ |
| Générer rapport PDF | — | ✓ | ✓ | ✗ | ✗ |

## Routes API

Préfixe : `/api/v1`. Toutes sauf `/auth/*` et `/contact` requièrent JWT. `tenant_id` toujours du JWT.

```
# Public (pas de JWT)
POST   /contact                 — Formulaire contact (3 req/15min/IP, lang=en|fr|de)

# Auth
POST   /auth/login              POST   /auth/mfa/verify
POST   /auth/refresh            POST   /auth/logout
GET    /auth/me                 POST   /auth/mfa/setup
POST   /auth/mfa/enable         DELETE /auth/mfa
POST   /auth/change-password    — Accessible même avec password_change_required

# Superadmin (JWT + superadmin role, pas de tenant)
GET    /admin/dashboard          — Stats globales plateforme
GET    /admin/tenants            POST   /admin/tenants
GET    /admin/tenants/:id        PATCH  /admin/tenants/:id
DELETE /admin/tenants/:id        POST   /admin/invitations

# Vehicles
GET    /vehicles                POST   /vehicles
GET    /vehicles/:id            PATCH  /vehicles/:id
DELETE /vehicles/:id            GET    /vehicles/:id/timeline
POST   /vehicles/:id/move       POST   /vehicles/:id/exit
GET    /vehicles/:id/report

# Events
GET    /events                  POST   /events
GET    /events/:id

# Bays
GET    /bays                    POST   /bays
GET    /bays/:id                PATCH  /bays/:id
DELETE /bays/:id

# Tasks
GET    /tasks                   POST   /tasks
GET    /tasks/:id               PATCH  /tasks/:id
POST   /tasks/:id/complete      DELETE /tasks/:id

# Documents
GET    /vehicles/:id/documents           POST   /vehicles/:id/documents
GET    /vehicles/:id/documents/:docId    DELETE /vehicles/:id/documents/:docId

# Photos
POST   /events/:id/photos       GET    /photos/:key/signed-url

# Users (admin only)
GET    /users                   POST   /users
PATCH  /users/:id               DELETE /users/:id

# Audit (admin only)
GET    /audit
```

## Conventions de code Go

### Nommage
- Services : `svc.NewService()` — Handlers : `handler.NewHandler()`
- Erreurs métier typées : `ErrNotFound`, `ErrForbidden`, `ErrValidation`, `ErrConflict`
- Handlers utilisent `c.UserContext()` (pas `c.Context()`) pour propager le tx Fiber

### Pattern events (Vehicle Timeline)
Chaque action modifiant l'état d'un véhicule **doit** créer un event. Le service s'en charge, pas le handler.

### Pattern handler
```
BodyParser → Validate → Service call → HandleServiceError → JSON response
```

### Requêtes list
- Utiliser `COUNT(*) OVER()` (single query, pas de COUNT séparé)
- Soft delete : filtrer `deleted_at IS NULL`

### Transactions
- Auth service : ownerPool comme fallback ; routes authentifiées utilisent appPool tx du middleware
- Business services : `db.Conn(ctx, s.pool)` pour récupérer le tx ou fallback sur le pool
- Superadmin/contact/plan services : ownerPool direct (pas de RLS, pas de tenant)

### golangci-lint
- Variable shadowing : utiliser `var x; x, err = ...` au lieu de `:=` quand `err` est déjà déclaré
- `defer tx.Rollback(ctx)` : ajouter `//nolint:errcheck // rollback is no-op after commit`
- Texte français/British English : ajouter `//nolint:misspell // French text` ou `// British English`
- `_ = godotenv.Load()` : gérer le retour de fonction même optionnel
- `make` est un builtin Go : ne pas l'utiliser comme nom de paramètre (utiliser `vmake`)
- Tests d'intégration : toujours `defer resp.Body.Close()` après `DoRequest()`

### Superadmin & Plans
- Superadmin = `user_role='superadmin'`, `tenant_id IS NULL` (pas attaché à un tenant)
- `plan_limits` table : plan → resource → max_count (starter/pro/enterprise)
- Plan service avec cache mémoire (TTL 5min), fail-open
- Invitation flow : crée user avec temp password → email Resend i18n → `password_change_required=true`
- Mailer service : Resend API, i18n (FR/EN/DE), no-op si `RESEND_API_KEY` vide (dev mode)
- `InviteUserRequest` inclut `Lang` (optionnel, défaut `fr`)

## Tests d'intégration

### Infrastructure (`internal/testutil/`)
- `Setup(t)` : initialise un `Env` partagé (`sync.Once`) avec Fiber app, dual pools (owner + app), JWT manager
- Helpers : `CreateTenant`, `CreateUser`, `CreateVehicle`, `CreateBay`, `AuthToken`, `AuthTokenPCR`, `CreateSuperAdmin`
- `DoRequest(t, method, path, token, body)` : requête JSON via `app.Test()` (Fiber in-process)
- `ReadJSON(t, resp, &dest)` : decode réponse JSON
- `BgCtx()` : raccourci `context.Background()`
- Requiert PostgreSQL local avec `.env.test` (gitignored)

### Couverture (12 fichiers de tests)
- **RLS** : isolation cross-tenant, dual pool, SET LOCAL vérifié (`db/rls_test.go`)
- **Auth** : login, logout, refresh, MFA setup/verify/disable, change-password (`handler/auth/`)
- **Middleware** : JWT validation, blacklist after logout, RBAC matrix 5 rôles, PCR, superadmin (`middleware/auth_test.go`)
- **Audit** : log async POST, skip GET, request ID, append-only (`middleware/audit_test.go`)
- **CRUD handlers** : vehicle, bay, event, task, user, document, admin (`handler/*/handler_test.go`)
- **Plan limits** : starter/pro/enterprise, HTTP 402 blocking (`service/plan/plan_test.go`)

### Emails transactionnels (Resend API)

7 templates email, tous en design dark luxury cohérent (fond #0a0908, accents or #b8955a, logo shield PNG) :

| Template | Service | i18n | Envoyé quand |
|----------|---------|------|--------------|
| Confirmation contact (×3) | `contact/service.go` | FR/EN/DE | Soumission formulaire contact |
| Notification admin | `contact/service.go` | — | Soumission formulaire contact (→ admin) |
| Welcome (×3) | `mailer/service.go` | FR/EN/DE | Invitation utilisateur |

- Champ `lang` (en|fr|de) : depuis `localStorage('hm-lang')` (contact) ou `InviteUserRequest.Lang` (welcome)
- Logo : `web/static/logo-email.png` généré via Playwright depuis `logo.svg` (fond noir intégré)
- Hébergé à `https://heritagemotor.app/logo-email.png`
- Nom du tenant affiché en or (#b8955a) dans le welcome email
- Expéditeurs : `welcome@` (confirmation/welcome), `noreply@` (notification admin)
- Cloudflare Email Routing : `welcome@` et `noreply@` redirigent vers admin

## Architecture PWA (pwa/)

### Auth — BFF pattern (Backend-For-Frontend)
- Refresh token stocké en cookie `httpOnly` (inaccessible au JS client)
- Routes API Next.js comme proxy vers le backend Go :
  - `pwa/app/api/auth/refresh/route.ts` — lit le cookie, forwarde au backend, retourne l'access token + user
  - `pwa/app/api/auth/logout/route.ts` — lit le cookie, forwarde au backend, supprime le cookie
  - `pwa/app/api/auth/set-token/route.ts` — stocke le refresh token en cookie httpOnly après login
- **Next.js middleware** (`pwa/middleware.ts`) : redirige vers `/login` si le cookie `refresh_token` est absent
- **AuthBootstrap** (`pwa/components/AuthBootstrap.tsx`) : au montage de l'app, appelle `/api/auth/refresh` pour restaurer la session depuis le cookie httpOnly. Hydrate le Zustand store (`accessToken` + `user`) avant le rendu des enfants. Affiche un spinner pendant le chargement.

### Offline queue (IndexedDB)
- `pwa/lib/offline-queue.ts` — CRUD IndexedDB (`pushAction`, `getAllActions`, `removeAction`, etc.)
- `pwa/hooks/useOfflineQueue.ts` — hook React : sync listeners (`online` event + polling 30s), retourne `{ syncAll, refreshCount }`
- `pwa/lib/types.ts` → `PendingAction` : type `move | task | photo | exit`, sérialisé en IndexedDB
- **Pages d'action intégrées** : `move`, `task`, `exit` — offline fallback via `pushAction()` sur erreur réseau
  - Pattern : check `navigator.onLine` upfront + catch non-`ApiError` dans le try/catch
  - Photos non sérialisables en IndexedDB → `photo/page.tsx` n'a que les sync listeners
- `pwa/components/ui/SyncBadge.tsx` — badge animé dans la nav, affiche le nombre d'actions en attente

### State management
- Zustand store (`pwa/store/app.store.ts`) : `accessToken`, `pendingCount`, `logout()` — **in-memory**, perdu au refresh
- SWR pour le data fetching (stale-while-revalidate)
- `pwa/lib/api.ts` : client API avec auto-refresh token sur 401 (sans condition sur `token` — fonctionne même quand le store est vide après refresh)
- **Cycle de vie auth** : Login → store + cookie httpOnly → refresh page → AuthBootstrap restaure depuis cookie → store hydraté → SWR fetchers fonctionnent

## Optimisations performance

### Backend (Go)
- **Blacklist cache** : `sync.Map` avec TTL 30s dans `internal/middleware/auth.go` — évite un SELECT par requête authentifiée. `InvalidateBlacklistCache(jti, userID)` : invalidation O(1) via `Delete()` direct (pas de `Range()` scan)
- **Tenant cache** : `sync.Map` avec TTL 5min dans le TenantMiddleware. `InvalidateTenantCache(tenantID)` : invalidation immédiate sur update/delete tenant (évite données stales pendant 5min)
- **Upload limiter** : `sync.RWMutex` (pas `sync.Mutex`) avec cleanup 2-pass (RLock collect → Lock delete) pour ne pas bloquer les uploads pendant le nettoyage
- **Admin GetTenant** : LEFT JOIN subqueries (comme ListTenants) au lieu de 3 subqueries corrélées
- **PresignClient S3** : créé une seule fois dans `NewS3Client()`, réutilisé dans `GetSignedURL()`
- **COUNT(*) OVER()** : toutes les requêtes list en single query (pas de COUNT séparé)

### Frontend (PWA)
- **VehicleCard** : `React.memo()` pour éviter re-renders sur changement de filtre/recherche
- **Dashboard** : `useCallback` pour `handleVehicleClick` (référence stable pour les VehicleCard mémoïsés)
- **useCamera** : `URL.revokeObjectURL()` sur toutes les previews au unmount (empêche memory leaks sur sessions longues)
- **useOfflineQueue** : effets séparés avec dépendances minimales (initial count runs once, listeners/polling séparés)

### Landing page (web/static/)
- **Navigation** : `IntersectionObserver` au lieu de `scroll` event listener (1 callback/intersection vs ~60/sec)
- **Google Fonts** : 6 variantes au lieu de 11 (removed unused weights)
- **SEO** : `og:image`, `twitter:image`, `preconnect` vers `fonts.gstatic.com`
- **Smooth scroll** : cubic-bezier luxury easing (1200ms) pour les ancres `#contact`, clean URL via `replaceState`

## Contraintes UX (non-négociables)

| Action | Cible |
|---|---|
| Logger un mouvement véhicule | < 30 secondes, 3 clics max |
| Valider une tâche récurrente | < 10 secondes, 1 clic + confirmation |
| Retrouver fiche véhicule | < 5 secondes depuis l'accueil |
| Générer rapport de sortie | < 10 secondes, 1 clic |
| Onboarding nouveau véhicule | < 5 minutes fiche complète |

## Ce qui N'EST PAS dans le MVP v1

- Portail propriétaire (v2)
- Alertes capteurs température/humidité (v2)
- Marketplace prestataires (v3)
- Application mobile native (v2)
- IA / suggestions automatiques (v3)
- Facturation et paiements intégrés (v2)
- Gestion multi-sites (v2)

## Hero Video (Remotion 4)

Le dossier `video/` contient un projet Remotion 4 qui génère la vidéo de fond du hero de la landing page.

```
video/
  src/
    index.ts           — registerRoot
    Root.tsx            — Compositions v2 + v3 + v4 (1920×1080 30fps)
    HeroVideoV2.tsx     — v2 : 8 scènes dont 2 garage indoor (25s, 750 frames)
    HeroVideoV3.tsx     — v3 "Night & Mood" : 12 scènes, tonalité sombre (37s, 1110 frames)
    HeroVideoV4.tsx     — v4 "Detail & Drive" : 12 scènes, alternance détail/conduite (37s, 1110 frames)
    CarScene.tsx        — Scène individuelle (Ken Burns + vignette)
    BrandWatermark.tsx  — Shield crest watermark semi-transparent (12% opacity)
  package.json          — dépendances Remotion
  remotion.config.ts    — Config (overwrite output)
```

**Commandes** :
```bash
cd video
npm install
npm run dev              # Ouvre Remotion Studio (preview v2 + v3 + v4)
npm run render:v2        # Render v2 → ../web/static/hero-bg.mp4
npm run render:v3        # Render v3 → ../web/static/hero-bg.mp4
npm run render:v4        # Render v4 → ../web/static/hero-bg.mp4
npm run render:preview:v2 # Preview v2 → out/preview-v2.mp4
npm run render:preview:v3 # Preview v3 → out/preview-v3.mp4
npm run render:preview:v4 # Preview v4 → out/preview-v4.mp4
```

**Clips** : tous issus de Pexels (licence commerciale gratuite, pas d'attribution requise).
Pour changer un clip, modifier l'URL dans le tableau `CLIPS` du fichier HeroVideo correspondant et re-render.

## Bugs connus et corrections

### Login : exclure les users de tenants supprimés
- **Symptôme** : "unauthorized" au login malgré bon mot de passe
- **Cause** : `SELECT FROM users WHERE email = $1` retournait un user d'un tenant soft-deleted (même email, ancien tenant)
- **Fix** : La query login filtre via `EXISTS (SELECT 1 FROM tenants t WHERE t.id = u.tenant_id AND t.deleted_at IS NULL)`, superadmin exempté
- **Fichier** : `internal/service/auth/service.go` Login()

### DeleteTenant : cascade soft-delete users
- **Symptôme** : Users orphelins après suppression tenant → bloquent le login (email dupliqué)
- **Cause** : `DeleteTenant` ne supprimait que le tenant, pas ses users
- **Fix** : Ajout `UPDATE users SET deleted_at = NOW() WHERE tenant_id = $1` dans DeleteTenant
- **Fichier** : `internal/service/admin/service.go` DeleteTenant()

### APP_BASE_URL : doit pointer vers la PWA
- **Symptôme** : Lien "Se connecter" dans l'email d'invitation mène vers l'API (404)
- **Cause** : `APP_BASE_URL=https://api.heritagemotor.app` au lieu de `https://app.heritagemotor.app`
- **Fix** : Variable d'env corrigée sur le VPS
- **Règle** : `APP_BASE_URL` est utilisé **uniquement** par le mailer pour les liens email → toujours `app.heritagemotor.app`

### Login : normaliser l'email (trim + lowercase)
- **Symptôme** : Espace accidentel avant l'email → "unauthorized"
- **Cause** : Le service Login ne normalisait pas l'email reçu
- **Fix** : `strings.TrimSpace(strings.ToLower(email))` en début de Login(), + `email.trim()` côté frontend
- **Fichiers** : `internal/service/auth/service.go` Login(), `pwa/app/login/page.tsx`, `pwa/app/admin/page.tsx`

### Password hash : toujours utiliser bcrypt
- **Symptôme** : "unauthorized" au login malgré password correct
- **Cause** : Mot de passe mis à jour directement en SQL sans bcrypt (`UPDATE SET password_hash = 'plaintext'`)
- **Fix** : Toujours hasher avec bcrypt cost 12. Le hash doit commencer par `$2a$12$` et faire 60 caractères
- **Règle** : Ne JAMAIS modifier `password_hash` directement en SQL sans passer par `bcrypt.GenerateFromPassword()`

### Session perdue après refresh (auth bootstrap)
- **Symptôme** : toutes les pages auth affichent une page blanche ou "Failed to load" après F5
- **Cause** : Zustand store est in-memory → `accessToken = null` après refresh → requêtes sans Authorization → 401 → le handler ne tentait pas de refresh car `&& token` bloquait
- **Fix** : `AuthBootstrap` dans le layout racine restaure la session au montage + condition 401 sans `&& token`
- **Fichiers** : `pwa/components/AuthBootstrap.tsx`, `pwa/app/layout.tsx`, `pwa/lib/api.ts`

### Page 404 landing vide
- **Symptôme** : `heritagemotor.app/page-inexistante` → page blanche (body vide)
- **Cause** : Caddy retournait un 404 sans contenu, pas de page 404 custom
- **Fix** : `web/static/404.html` (page brandée) + `handle_errors` dans le Caddyfile
- **Fichiers** : `web/static/404.html`, `Caddyfile`

### Performance mobile landing (79 → cible >90)
- **Symptôme** : FCP 3.0s, LCP 4.5s sur mobile (Lighthouse 79/100)
- **Cause** : Google Fonts render-blocking (750ms) + poster hero 550KB
- **Fix** : `rel="preload" as="style"` avec `onload` swap (non-blocking) + poster réduit `w=1280&q=70`
- **Fichier** : `web/static/index.html`

### Plausible CE hang (v2.1 → v2.1.4)
- **Symptôme** : `stats.heritagemotor.app` retourne 503, Plausible bloqué à "Starting repos..."
- **Cause** : Bug connu du driver ClickHouse dans v2.1 — le process BEAM se bloque à la connexion
- **Fix** : Upgrade vers `v2.1.4` dans `compose.yaml`
- **Fichier** : `compose.yaml` ligne 95

### Admin page blanche au refresh
- **Symptôme** : F5 sur `/admin` → page blanche pendant hydratation
- **Cause** : `if (!authorized) return null` rendait un DOM vide pendant qu'AuthBootstrap restaure la session
- **Fix** : Remplacé `return null` par un spinner gold cohérent
- **Fichier** : `pwa/app/admin/page.tsx`

### Anti-patterns à éviter
- **Email pas unique globalement** : email est unique par tenant (`UNIQUE(tenant_id, email)`), pas cross-tenant. Les queries par email doivent joindre le tenant.
- **Toujours cascader les soft-deletes** : tenant → users, vehicle → events/tasks/documents
- **Cookie `user_role` éphémère** : Le middleware Next.js vérifie le cookie `user_role` pour `/admin`. Ce cookie est posé au login uniquement — s'il expire, l'accès /admin est perdu jusqu'au re-login.
- **Toujours normaliser les emails** : `TrimSpace + ToLower` côté backend ET `.trim()` côté frontend avant tout appel API
- **Ne jamais écrire de password_hash en SQL brut** : utiliser exclusivement bcrypt cost 12 via le code Go
- **Ne jamais conditionner le refresh token sur la présence du token en mémoire** : le Zustand store est in-memory, `token` est `null` après refresh. Le handler 401 doit toujours tenter un refresh via le cookie httpOnly.

## Références détaillées

| Document | Contenu |
|---|---|
| `memory/spec-backend.md` | Schéma SQL complet, services Go, variables d'env, déploiement, tests |
| `memory/spec-business.md` | Vision produit, MVP scope, pricing, roadmap, KPIs |
| `pwa/README.md` | Architecture PWA, patterns frontend, design system, composants |
