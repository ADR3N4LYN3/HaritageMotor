# Heritage Motor — Instructions Claude Code

> Ce fichier est chargé automatiquement par Claude Code. Il définit les règles **non-négociables** du projet.

## Identité du projet

**Heritage Motor** (`heritagemotor.app`) — Plateforme SaaS multi-tenant B2B pour la gestion opérationnelle de facilities de stockage de véhicules de collection et de prestige (Ferrari, Porsche, McLaren, Bugatti...).

**Ce n'est pas un CRM ni un ERP.** C'est un registre opérationnel de confiance pour des actifs à 200k–5M€. La valeur centrale est la **traçabilité complète** ("Vehicle Chain of Custody").

## Stack technique

| Composant | Choix |
|---|---|
| Backend | Go 1.25+ / Fiber v2 |
| Base de données | PostgreSQL 16 (RLS multi-tenant) |
| Frontend | Next.js + TypeScript (PWA dans `pwa/`) |
| Stockage fichiers | Hetzner Object Storage (S3-compatible) |
| Auth | Maison — JWT HS256 + bcrypt (cost 12) + TOTP |
| Config | godotenv + os.Getenv |
| Conteneurisation | Docker + Docker Compose |
| Reverse proxy | Caddy |
| Analytics | Plausible CE v2.1.4 (self-hosted) |
| Linter Go | golangci-lint (govet, errcheck, misspell) |
| Linter React | react-doctor (60+ lint rules, dead code detection) |
| Module Go | `github.com/chriis/heritage-motor` |

## Architecture des dossiers

```
cmd/
  api/main.go                    — Point d'entrée Fiber, services init + middleware chains
  api/routes.go                  — Définition de toutes les routes API (extrait de main.go)
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
    migrations/                  — 001-019 (.up.sql + .down.sql)
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
    activity/ admin/ auth/ bay/ contact/ document/ event/ photo/ scan/ task/ user/ vehicle/
  service/
    admin/                       — Superadmin : tenants CRUD, invitations, dashboard
    auth/                        — Login, logout, refresh, MFA, change-password
    bay/ event/ task/ document/ user/ vehicle/   — CRUD + logique métier
    contact/
      service.go                 — Formulaire contact public + anti-bot (honeypot + Turnstile)
      templates.go               — Templates email i18n (confirmation FR/EN/DE + notification admin)
    mailer/                      — Envoi emails via Resend API
    plan/                        — Limites par plan (starter/pro/enterprise)
    report/
      service.go                 — Génération PDF véhicule (orchestration)
      pdf_builder.go             — Construction PDF pages (go-pdf/fpdf), design dark luxury
      logo.go                    — go:embed du logo-crest-v2.png pour le PDF
      logo-crest-v2.png          — Logo embarqué (copie pour go:embed)
  turnstile/turnstile.go         — Cloudflare Turnstile token verification (shared auth + contact)
  storage/s3.go                  — Upload, GetSignedURL, Delete (aws-sdk-go-v2)
  testutil/setup.go              — Infrastructure tests intégration (Env, Setup, helpers)
web/static/
  index.html                     — Landing page (SEO, hero video, CTA, i18n EN/FR/DE)
  contact.html                   — Page contact (formulaire POST /api/v1/contact, i18n EN/FR/DE)
  privacy.html                   — Politique de confidentialité (i18n EN/FR/DE)
  legal.html                     — Mentions légales (i18n EN/FR/DE)
  404.html                       — Page 404 (dark luxury, i18n EN/FR/DE, fond route brumeuse)
  hero-bg.mp4                    — Vidéo hero (Remotion v2)
  logo-crest-v2.png              — Logo principal (blason HM + laurier, PNG transparent)
  logo.svg                       — (legacy) Ancien monogramme HM shield SVG
  logo-crest.svg                 — (legacy) Ancien shield crest SVG complet
  logo-email.png / .svg          — (legacy) Ancien logo emails
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
- Trusted Proxies : `EnableTrustedProxyCheck` activé **uniquement en production** (`APP_ENV=production`) + `TrustedProxies: ["127.0.0.1", "::1"]` + `ProxyHeader: "X-Forwarded-For"` — obligatoire derrière Caddy pour que `c.IP()` retourne l'IP client réelle. Désactivé en dev/test pour éviter `c.IP()` vide sans header proxy
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

→ **Référence complète** : [`docs/api-reference.md`](docs/api-reference.md)

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

### Couverture (19 fichiers de tests)
- **RLS** : isolation cross-tenant, dual pool, SET LOCAL vérifié (`db/rls_test.go`)
- **Auth handler** : login, logout, refresh, MFA setup/verify/disable, change-password (`handler/auth/`)
- **Auth unit** : JWT generate/validate, bcrypt hash/check, TOTP (`auth/auth_test.go`)
- **Config** : env parsing, defaults, production validation (`config/config_test.go`)
- **Domain** : password strength validation, error types (`domain/domain_test.go`)
- **Middleware** : JWT validation, blacklist after logout, RBAC matrix 5 rôles, PCR, superadmin (`middleware/auth_test.go`)
- **Audit** : log async POST, skip GET, request ID, append-only (`middleware/audit_test.go`)
- **CRUD handlers** : vehicle, bay, event, task, user, document, admin, contact, scan, photo, audit (`handler/*/handler_test.go`)
- **Plan limits** : starter/pro/enterprise, HTTP 402 blocking (`service/plan/plan_test.go`)

### Emails transactionnels (Resend API)

7 templates (confirmation contact FR/EN/DE, notification admin, welcome FR/EN/DE) dans `contact/service.go` et `mailer/service.go`. Design dark luxury, i18n via champ `lang` (en|fr|de). Polices : `Cormorant Garamond` (serif, titres/brand) + `DM Sans` (sans, body/labels) avec fallbacks Georgia/Helvetica Neue pour les clients email qui ne supportent pas les web fonts.

## Architecture PWA (pwa/)

→ **Référence complète** : [`docs/pwa.md`](docs/pwa.md) et [`pwa/README.md`](pwa/README.md)

### Règles critiques PWA
- **BFF pattern** : refresh token en cookie `httpOnly`, routes Next.js `/api/auth/*` comme proxy vers le backend Go
- **AuthBootstrap obligatoire** dans `layout.tsx` : restaure session au montage via `useSWR` + cookie httpOnly → Zustand. Sans lui, toute page auth est blanche après F5
- **Handler 401** : ne JAMAIS conditionner le refresh sur `token` en mémoire (Zustand est in-memory, `token = null` après refresh). Toujours tenter le refresh via cookie httpOnly. Le refresh est dédupliqué via un mutex (une seule promise partagée pour les 401 concurrents)
- **AuthBootstrap + password_change_required** : AuthBootstrap redirige vers `/change-password` dans son `onSuccess` si `user.password_change_required === true` (enforcement post-F5)
- **Offline queue** : `pushAction()` en IndexedDB sur erreur réseau (move/task/exit). Photos non sérialisables → upload uniquement en ligne. Max 2 retries, backoff cap 10s
- **Zustand** : `accessToken`, `pendingCount`, `logout()` — **in-memory**, perdu au refresh
- **Dashboard tabs (Fleet/Activity)** : toujours montés avec CSS `hidden` class (jamais conditional rendering) pour préserver les animations `useReveal` (IntersectionObserver one-shot)
- **ActivityFeed `active` prop** : passer `active={false}` quand l'onglet Activity est masqué pour stopper le polling SWR
- **Scan layout** : le scan a son propre layout (`scan/layout.tsx`) avec `<SideNav />` car il n'utilise pas AppShell. Le `lg:left-[220px]` sur les conteneurs fixed doit rester synchronisé avec la largeur du SideNav
- **LangSwitcher partagé** : composant unique (`components/ui/LangSwitcher.tsx`) avec SVG flags inline (pas d'emoji), utilisé dans TopBar ET DesktopTopBar. Persiste dans `localStorage('hm-lang')` — partagé avec les pages statiques landing. Utilise `broadcastLang()` pour notifier tous les hooks `useI18n()` en temps réel
- **i18n PWA** : hook `useI18n(dict)` dans `lib/i18n.ts` + dictionnaires EN/FR/DE dans `lib/translations.ts`. Pages traduites : dashboard, bays, DesktopTopBar, login, change-password. Login/change-password utilisent leurs propres dicts locaux
- **Accessibilité toggle pills** : tous les boutons toggle/filtre doivent avoir `aria-pressed`, les dropdowns `aria-expanded`

### Design System Dark Luxury (PWA)
- **Background** : `bg-black` (#0e0d0b) sur AppShell et toutes les pages
- **Glass cards** : `bg-white/[0.03] border border-white/[0.06] rounded-2xl` (pas de shadow)
- **Inputs** : `bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20`
- **Texte** : `text-white` (primaire), `text-white/50` (secondaire), `text-white/30` (muted)
- **Headings** : `font-light tracking-[0.03em] text-white leading-[1.2]` (DM Sans 300 — PAS serif, PAS bold). `font-display` (Cormorant Garamond) réservé UNIQUEMENT au brand/logo ("HM", "Heritage Motor" sur login/admin header)
- **Brand text** : `font-sans font-semibold tracking-[0.18em] uppercase text-gold` (DM Sans 600 — TopBar 0.72rem, SideNav 0.65rem)
- **Section labels** : `text-sm font-semibold text-white/30 uppercase tracking-wider`
- **Status pills** : actif `bg-gold/15 text-gold border-gold/30`, inactif `bg-white/[0.04] text-white/50 border-white/[0.06]`
- **Séparateurs** : `border-gold/10` (TopBar, BottomNav)
- **Login** : shield crest SVG, glass form card, séparateur or

## Patterns performance à respecter

- **Caches sync.Map** : blacklist (TTL 30s, purge auto 5min) + tenant (TTL 5min) — appeler `InvalidateBlacklistCache()` / `InvalidateTenantCache()` lors de mutations
- **Cleanup goroutines** : token_blacklist (1h), refresh_tokens (24h, >7j), blacklist cache (5min)
- **COUNT(*) OVER()** : toujours utiliser en single query pour les listes paginées
- **VehicleCard memo** : ne pas retirer `React.memo()` ni `useCallback` dashboard
- **URL.revokeObjectURL()** : toujours cleanup les previews au unmount (useCamera)
- **react-doctor 100/100** : maintenir le score (`npm run doctor` dans pwa/)

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

## Landing Page & Pages Statiques (web/static/)

### i18n (EN/FR/DE)

Toutes les pages statiques supportent 3 langues via `localStorage('hm-lang')` partagé entre les pages.

**Deux patterns i18n :**
- **`data-i18n`** : pour les éléments courts (nav, footer, tags). JS remplace `el.textContent` via un dict `i18n = { en: {}, fr: {...}, de: {...} }`. L'anglais est le HTML par défaut, pas besoin de clé `en`.
- **`data-lang-block`** : pour le contenu long (legal, privacy). Blocs HTML complets par langue, toggle via `el.hidden = (lang !== block)`. Plus propre que traduire élément par élément.

**Pages :**
- `index.html` : `data-i18n` sur tous les éléments (nav, hero, pillars, features, pricing, CTA, footer) + toggle EUR/USD sur les prix (`localStorage('hm-currency')`, compatible i18n)
- `contact.html` : `data-i18n` (nav, labels, placeholders) + détection auto de la langue navigateur. Nav simplifié (pas de lien "Contact" redondant avec le CTA)
- `privacy.html` : `data-lang-block` pour le corps + `data-i18n` pour nav/footer
- `legal.html` : `data-lang-block` pour le corps + `data-i18n` pour nav/footer
- `404.html` : `data-i18n` + fond route brumeuse (Unsplash), shield crest, CTA style landing (pas de nav, page centrée)

### Nav responsive (hamburger drawer)

Breakpoint mobile : `@media (max-width: 960px)` sur toutes les pages avec nav (index, contact, legal, privacy).

**Comportement mobile (≤960px) :**
- Logo texte "HERITAGE MOTOR" masqué (`.nav-logo span { display: none }`), seul le blason reste (32px)
- Nav links, CTA, lang switch masqués — tout est dans le drawer
- Burger visible (`.nav-burger { display: flex }`)
- Mobile drawer : slide-in 280px depuis la droite, overlay sombre, fermeture par overlay/Escape/lien

**Pattern JS toggle (référence = index.html) :**
- `toggleDrawer(open)` : paramètre `open` explicite (boolean) ou toggle par détection de classe
- Overlay click → `toggleDrawer(false)` (pas toggle, fermeture garantie)
- Escape key → `toggleDrawer(false)`
- `aria-expanded` mis à jour dynamiquement sur le burger
- `document.body.style.overflow = 'hidden'` quand ouvert (empêche scroll derrière)

**404.html** : pas de nav, pas de hamburger — page centrée by design.

### Cookie Consent Modal

Modal centrée avec backdrop blur (`backdrop-filter: blur(8px)`) qui bloque l'interaction tant que l'utilisateur n'a pas choisi. Présente sur les 5 pages statiques + la PWA (`CookieBanner.tsx`).

**Options :**
- **Essentiels** (toujours actif, toggle verrouillé) — préférence de langue, choix de consentement, cookies auth (PWA)
- **Statistiques anonymes** (toggle on/off, activé par défaut) — Plausible analytics

**Consentement stocké** : `localStorage('hm-cookie-consent')` = JSON `{essential: true, analytics: bool, timestamp: ISO}`. Opt-out Plausible via `localStorage('plausible_ignore', 'true')` (standard Plausible).

**Boutons** : "Enregistrer mes choix" (sauve l'état des toggles) / "Tout accepter" (active tout). i18n EN/FR/DE sur les pages statiques.

### Design System Landing (Dark Luxury)

**Polices :**
- Serif : `Cormorant Garamond` (300, 400, 600, italic 400) — titres, accroches, prix
- Sans : `DM Sans` (400, 500) — body, labels, nav, boutons

**Typographie titres (Cormorant Garamond 300) :**
- Hero h1 : `clamp(3.2rem, 7vw, 8rem)` / `<em>` = italic + opacité réduite
- Section h2 : `clamp(2.8rem, 4.5vw, 4.5rem)`
- Split h2 : `clamp(2.4rem, 3.5vw, 3.6rem)`
- Pillar/Feat card h3 : `1.5rem`
- Manifesto quote : `clamp(2.2rem, 3.8vw, 3.8rem)` italic
- Price amount : `4.5rem`

**Exception stats :** `.stat-val` utilise DM Sans 400 / 3.5rem (les caractères spéciaux €, <, "click" rendent mal en serif)

**Typographie labels (DM Sans) :**
- `0.78rem` : nav, footer, badges, attributions
- `0.88rem` : section tags, feat tags, step labels, boutons, liens
- `1rem` : hero tag, hero CTA

**Body text :** `0.95rem / 300 / line-height 1.8-1.9` — cohérent partout

**Règle FR :** Toujours sentence case (pas de Title Case anglais). Ex: "Registre véhicules", pas "Registre Véhicules".

### Logo

Logo principal : `logo-crest-v2.png` — blason HM art déco + couronne de laurier, PNG fond transparent, tons or (#b8955a / #c4a265).

Utilisé comme `<img>` + texte "HERITAGE MOTOR" en Cormorant Garamond 600 à côté. Tailles :
- **Landing nav desktop** : 42px + texte 19px
- **Landing nav mobile** (≤960px) : 32px, texte masqué (blason seul)
- **Landing footer** : 28px + texte 15px
- **PWA TopBar** : 30px + texte 0.82rem
- **PWA Login** : 88px (centré, texte en dessous)
- **Emails** : 72px (via `https://heritagemotor.app/logo-crest-v2.png`)
- **PDF report** : 18mm (go:embed dans `internal/service/report/`)
- **Vidéo watermark** : 52px (Remotion `staticFile`)

Fichier présent dans 4 répertoires : `web/static/`, `pwa/public/`, `video/public/`, `internal/service/report/` (go:embed PDF).

**PWA standalone** : En mode standalone Docker, Next.js ne sert PAS les fichiers `public/` directement. Le logo doit être importé en static import (`import logoCrest from "@/public/logo-crest-v2.png"`) puis utilisé via `logoCrest.src` — webpack le bundle dans `/_next/static/media/`. Pattern utilisé dans `login/page.tsx` et `TopBar.tsx`.

## Hero Video (Remotion 4)

Dossier `video/` — Remotion 4, 3 versions (v2/v3/v4). Clips Pexels (licence commerciale).

```bash
cd video && npm install
npm run dev           # Remotion Studio
npm run render:v4     # → ../web/static/hero-bg.mp4
```

## Anti-patterns à éviter

- **Email pas unique globalement** : email est unique par tenant (`UNIQUE(tenant_id, email)`), pas cross-tenant. Les queries par email doivent joindre le tenant. Le login filtre `EXISTS(... WHERE t.deleted_at IS NULL)`
- **Toujours cascader les soft-deletes** : tenant → users, vehicle → events/tasks/documents
- **APP_BASE_URL = domaine PWA** : utilisé uniquement par le mailer pour les liens email → toujours `app.heritagemotor.app`
- **Toujours normaliser les emails** : `TrimSpace + ToLower` côté backend ET `.trim()` côté frontend avant tout appel API
- **Ne jamais écrire de password_hash en SQL brut** : utiliser exclusivement bcrypt cost 12 via le code Go (`$2a$12$`, 60 chars)
- **Ne jamais conditionner le refresh sur token en mémoire** : Zustand est in-memory, le handler 401 doit toujours tenter le refresh via cookie httpOnly
- **Cookie `user_role` éphémère** : posé au login uniquement, s'il expire → perte accès /admin jusqu'au re-login
- **Caddy clean URLs** : utiliser `rewrite /privacy /privacy.html` au niveau top-level dans le bloc landing, PAS dans un `handle` (directive ordering). Après modif Caddyfile, toujours `docker compose up -d --force-recreate caddy`
- **Turnstile hostname** : dans Cloudflare Dashboard, TOUS les hostnames où le widget est rendu doivent être listés (`heritagemotor.app` + `app.heritagemotor.app`). Sinon → 403
- **Turnstile auto-rendering** : utiliser `cf-turnstile` div + `data-callback`, PAS `render=explicit` (race conditions). Le widget login est `compact` (visible), pas invisible
- **Git LFS** : `hero-bg.mp4` tracké via LFS. `deploy.sh` fait `git lfs pull` automatiquement. Sans LFS installé sur le serveur → fichier pointeur au lieu de la vidéo

## Documentation détaillée

Toute la documentation technique est dans [`docs/`](docs/) :

| Document | Contenu |
|---|---|
| [`docs/README.md`](docs/README.md) | Vue d'ensemble projet, quick start, structure |
| [`docs/architecture.md`](docs/architecture.md) | Layers, middleware pipeline, request flow, multi-tenant |
| [`docs/api-reference.md`](docs/api-reference.md) | Endpoints REST complets avec exemples |
| [`docs/database.md`](docs/database.md) | Schéma SQL, migrations 001-019, RLS, index |
| [`docs/security.md`](docs/security.md) | Auth, RBAC, token blacklist, rate limiting, headers |
| [`docs/deployment.md`](docs/deployment.md) | Docker, Caddy, Cloudflare, variables d'env |
| [`docs/pwa.md`](docs/pwa.md) | Frontend PWA complet |
| [`docs/pitch.md`](docs/pitch.md) | Vision produit, business model, go-to-market |
| [`pwa/README.md`](pwa/README.md) | Architecture PWA détaillée, patterns, design system |
