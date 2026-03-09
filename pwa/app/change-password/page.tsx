"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/app.store";
import { ActionButton } from "@/components/ui/ActionButton";

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // Redirect based on role after password change
      if (user?.role === "superadmin") {
        router.push("/admin");
      } else {
        router.push("/scan");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to change password");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-display font-bold text-gold tracking-wide">
          Change Password
        </h1>
        <p className="text-white/40 text-sm mt-2">
          You must change your password before continuing
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          required
          minLength={8}
          className={inputClass}
          autoComplete="current-password"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          required
          minLength={8}
          className={inputClass}
          autoComplete="new-password"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          required
          minLength={8}
          className={inputClass}
          autoComplete="new-password"
        />

        <p className="text-white/30 text-xs">
          Min 8 characters, uppercase, lowercase, digit, and special character
        </p>

        {error && <p className="text-danger text-sm text-center">{error}</p>}

        <ActionButton type="submit" loading={loading}>
          Update Password
        </ActionButton>
      </form>
    </div>
  );
}
