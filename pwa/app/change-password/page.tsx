"use client";

import { useState, useReducer, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";

/* ---------- i18n ---------- */
const cpI18n = {
  en: { title: "Change Password", subtitle: "You must change your password before continuing", current: "Current password", newPw: "New password", confirm: "Confirm new password", submit: "Update Password", mismatch: "Passwords do not match", fail: "Failed to change password", weak: "Weak", fair: "Fair", good: "Good", strong: "Strong", excellent: "Excellent", chars: "8+ characters", lower: "Lowercase", upper: "Uppercase", digit: "Digit", special: "Special character" },
  fr: { title: "Changement de mot de passe", subtitle: "Vous devez changer votre mot de passe avant de continuer", current: "Mot de passe actuel", newPw: "Nouveau mot de passe", confirm: "Confirmer le nouveau mot de passe", submit: "Mettre \u00e0 jour", mismatch: "Les mots de passe ne correspondent pas", fail: "\u00c9chec du changement de mot de passe", weak: "Faible", fair: "Passable", good: "Bon", strong: "Fort", excellent: "Excellent", chars: "8+ caract\u00e8res", lower: "Minuscule", upper: "Majuscule", digit: "Chiffre", special: "Caract\u00e8re sp\u00e9cial" },
  de: { title: "Passwort \u00e4ndern", subtitle: "Sie m\u00fcssen Ihr Passwort \u00e4ndern, bevor Sie fortfahren", current: "Aktuelles Passwort", newPw: "Neues Passwort", confirm: "Neues Passwort best\u00e4tigen", submit: "Passwort aktualisieren", mismatch: "Passw\u00f6rter stimmen nicht \u00fcberein", fail: "Passwort\u00e4nderung fehlgeschlagen", weak: "Schwach", fair: "Ausreichend", good: "Gut", strong: "Stark", excellent: "Ausgezeichnet", chars: "8+ Zeichen", lower: "Kleinbuchstabe", upper: "Gro\u00dfbuchstabe", digit: "Ziffer", special: "Sonderzeichen" },
} as const;
type Lang = keyof typeof cpI18n;

function getSavedLang(): Lang {
  try { const l = localStorage.getItem("hm-lang"); if (l && l in cpI18n) return l as Lang; } catch {}
  return "en";
}

/* ---------- Helpers ---------- */
function getStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const strengthColors = ["", "bg-red-500", "bg-orange-500", "bg-amber-400", "bg-emerald-400", "bg-emerald-500"];

const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const inputCls = "w-full px-4 py-3.5 pr-12 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(184,149,90,0.4)] focus:ring-1 focus:ring-[rgba(184,149,90,0.2)] text-sm font-normal tracking-wide transition-colors";

/* ---------- PasswordInput ---------- */
function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        className={inputCls}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        tabIndex={-1}
      >
        {show ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ---------- CTA Button (same as login) ---------- */
function CPButton({ loading, children, ...props }: { loading: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="group relative w-full mt-2 py-3.5 border border-[rgba(184,149,90,0.4)] text-[#b8955a] text-[0.78rem] font-sans font-medium uppercase tracking-[0.15em] rounded overflow-hidden transition-colors duration-500 hover:text-[#0e0d0b] hover:border-[#b8955a] disabled:opacity-40 disabled:pointer-events-none"
      disabled={loading}
      {...props}
    >
      <span className="absolute inset-0 bg-[#b8955a] origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </span>
    </button>
  );
}

/* ---------- Page ---------- */
export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [{ loading, error }, setStatus] = useReducer(
    (s: { loading: boolean; error: string | null }, a: Partial<{ loading: boolean; error: string | null }>) => ({ ...s, ...a }),
    { loading: false, error: null as string | null }
  );
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => { setLang(getSavedLang()); }, []);

  const switchLang = useCallback((l: Lang) => {
    setLang(l);
    try { localStorage.setItem("hm-lang", l); } catch {}
  }, []);

  const t = cpI18n[lang];
  const strengthLabels = ["", t.weak, t.fair, t.good, t.strong, t.excellent];

  const strength = getStrength(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const hasLength = newPassword.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ error: null });

    if (newPassword !== confirm) {
      setStatus({ error: t.mismatch });
      return;
    }

    setStatus({ loading: true });
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (user?.role === "superadmin") {
        router.push("/admin");
      } else {
        router.push("/scan");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setStatus({ error: err.message });
      } else {
        setStatus({ error: t.fail });
      }
    } finally {
      setStatus({ loading: false });
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0e0d0b] flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1767907571229-01cf4ba03590?w=1920&q=60&auto=format&fit=crop"
        alt=""
        className="pointer-events-none fixed inset-0 w-full h-full object-cover object-center scale-105"
      />
      {/* Dark overlay */}
      <div className="pointer-events-none fixed inset-0" style={{ background: "linear-gradient(180deg, rgba(14,13,11,0.96) 0%, rgba(14,13,11,0.91) 40%, rgba(14,13,11,0.91) 60%, rgba(14,13,11,0.97) 100%)" }} />
      {/* Noise texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: noiseBg }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">

        {/* Header */}
        <div className="mb-10 text-center flex flex-col items-center">
          <svg className="w-[54px] h-auto mb-5" viewBox="0 0 280 336" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cpGH" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#96783f"/><stop offset="50%" stopColor="#dcc28a"/><stop offset="100%" stopColor="#96783f"/>
              </linearGradient>
              <linearGradient id="cpDk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#191816"/><stop offset="100%" stopColor="#0e0d0b"/>
              </linearGradient>
              <linearGradient id="cpGV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dcc28a"/><stop offset="45%" stopColor="#b8955a"/><stop offset="100%" stopColor="#96783f"/>
              </linearGradient>
            </defs>
            <path d="M140,4 L264,4 Q276,4 276,16 L276,186 Q276,230 248,260 Q218,292 140,332 Q62,292 32,260 Q4,230 4,186 L4,16 Q4,4 16,4 Z" fill="url(#cpGH)"/>
            <path d="M140,12 L260,12 Q268,12 268,20 L268,184 Q268,226 242,254 Q214,284 140,322 Q66,284 38,254 Q12,226 12,184 L12,20 Q12,12 20,12 Z" fill="url(#cpDk)"/>
            <path d="M140,22 L254,22 Q260,22 260,28 L260,180 Q260,220 236,246 Q210,274 140,310 Q70,274 44,246 Q20,220 20,180 L20,28 Q20,22 26,22 Z" fill="none" stroke="#b8955a" strokeWidth="1.2"/>
            <text x="140" y="185" textAnchor="middle" fontFamily="'Cormorant Garamond','Georgia',serif" fontSize="118" fontWeight="700" letterSpacing="5" fill="url(#cpGV)">HM</text>
          </svg>
          <h1 className="font-display text-xl font-light tracking-wide text-white">
            {t.title}
          </h1>
          <p className="text-white/40 text-sm mt-2">{t.subtitle}</p>
          <div className="w-16 h-px mx-auto mt-8" style={{ background: "linear-gradient(90deg, transparent, #b8955a, transparent)" }} />
        </div>

        <form onSubmit={handleSubmit} className="w-full bg-[rgba(14,13,11,0.65)] border border-white/[0.10] rounded-2xl p-8 backdrop-blur-md space-y-5">
          <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder={t.current} autoComplete="current-password" />
          <PasswordInput value={newPassword} onChange={setNewPassword} placeholder={t.newPw} autoComplete="new-password" />

          {/* Strength bar */}
          {newPassword.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      n <= strength ? strengthColors[strength] : "bg-white/[0.06]"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs">{strengthLabels[strength]}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  { ok: hasLength, label: t.chars },
                  { ok: hasLower, label: t.lower },
                  { ok: hasUpper, label: t.upper },
                  { ok: hasDigit, label: t.digit },
                  { ok: hasSpecial, label: t.special },
                ].map((r) => (
                  <p key={r.label} className={`text-xs ${r.ok ? "text-emerald-400/70" : "text-white/20"}`}>
                    {r.ok ? "\u2713" : "\u2022"} {r.label}
                  </p>
                ))}
              </div>
            </div>
          )}

          <PasswordInput value={confirm} onChange={setConfirm} placeholder={t.confirm} autoComplete="new-password" />

          {error && <p className="text-danger text-sm text-center">{error}</p>}

          <CPButton type="submit" loading={loading}>
            {t.submit}
          </CPButton>
        </form>

        {/* Language switcher */}
        <div className="flex items-center gap-4 mt-8">
          {(["en", "fr", "de"] as const).map((l) => (
            <button
              key={l}
              onClick={() => switchLang(l)}
              className={`text-[0.7rem] font-sans font-medium uppercase tracking-[0.15em] transition-colors ${
                lang === l ? "text-[#b8955a]" : "text-white/30 hover:text-white/50"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
