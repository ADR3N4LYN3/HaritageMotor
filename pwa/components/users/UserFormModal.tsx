"use client";

import { useCallback } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import type { User } from "@/lib/types";

const ROLES = ["admin", "operator", "technician", "viewer"] as const;

export interface UserFormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface UserFormModalProps {
  editingUser: User | null;
  form: UserFormData;
  formError: string;
  submitting: boolean;
  onUpdateField: (field: keyof UserFormData, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function UserFormModal({
  editingUser,
  form,
  formError,
  submitting,
  onUpdateField,
  onSubmit,
  onClose,
}: UserFormModalProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-2xl font-light tracking-wide text-white">
          {editingUser ? "Edit user" : "New user"}
        </h2>

        {!editingUser && (
          <div>
            <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onUpdateField("email", e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none text-sm transition-colors"
              autoComplete="off"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
              First name
            </label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => onUpdateField("first_name", e.target.value)}
              placeholder="John"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none text-sm transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
              Last name
            </label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => onUpdateField("last_name", e.target.value)}
              placeholder="Doe"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none text-sm transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
            Role
          </label>
          <select
            value={form.role}
            onChange={(e) => onUpdateField("role", e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none text-sm transition-colors appearance-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-[#1a1a1a] text-white">
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {!editingUser && (
          <div>
            <label className="text-sm font-semibold text-white/30 uppercase tracking-wider block mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => onUpdateField("password", e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none text-sm transition-colors"
              autoComplete="new-password"
            />
            {form.password.length > 0 && form.password.length < 8 && (
              <p className="text-danger text-xs mt-1">
                Password must be at least 8 characters
              </p>
            )}
          </div>
        )}

        {formError && (
          <div className="text-danger text-sm">{formError}</div>
        )}

        <div className="flex gap-3 pt-1">
          <ActionButton
            variant="secondary"
            fullWidth
            onClick={onClose}
            type="button"
          >
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            fullWidth
            loading={submitting}
            onClick={onSubmit}
            type="button"
          >
            {editingUser ? "Save" : "Create"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
