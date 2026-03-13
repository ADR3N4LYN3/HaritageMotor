"use client";

import { useState, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { UserFormModal } from "@/components/users/UserFormModal";
import type { UserFormData } from "@/components/users/UserFormModal";
import { useAppStore } from "@/store/app.store";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import useSWR from "swr";

const ROLES = ["admin", "operator", "technician", "viewer"] as const;
const ROLE_FILTERS = ["", ...ROLES] as const;

const roleColors: Record<string, string> = {
  admin: "bg-gold/15 text-gold",
  operator: "bg-[#3b82f6]/10 text-[#3b82f6]",
  technician: "bg-success/10 text-success",
  viewer: "bg-white/[0.06] text-white/40",
};

const emptyForm: UserFormData = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "operator",
};

export default function UsersPage() {
  const currentUser = useAppStore((s) => s.user);
  const isAdmin = currentUser?.role === "admin";

  const { data, isLoading, error, mutate } = useSWR<{ data: User[] }>("/users");
  const users = useMemo(() => data?.data || [], [data]);

  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, search]);

  const openCreate = useCallback(() => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((user: User) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    });
    setFormError("");
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingUser(null);
    setFormError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormError("");

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError("First name and last name are required");
      return;
    }

    if (!editingUser) {
      if (!form.email.trim()) {
        setFormError("Email is required");
        return;
      }
      if (form.password.length < 8) {
        setFormError("Password must be at least 8 characters");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
        });
      } else {
        await api.post("/users", {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
        });
      }
      await mutate();
      closeModal();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("An unexpected error occurred");
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, editingUser, mutate, closeModal]);

  const handleDelete = useCallback(
    async (userId: string) => {
      if (deleteConfirm !== userId) {
        setDeleteConfirm(userId);
        return;
      }

      setDeleting(true);
      try {
        await api.delete(`/users/${userId}`);
        await mutate();
        setDeleteConfirm(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        }
      } finally {
        setDeleting(false);
      }
    },
    [deleteConfirm, mutate]
  );

  const updateField = useCallback(
    (field: keyof UserFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="text-center py-20 text-white/30 text-sm font-light">
          Access restricted to administrators
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Team"
          backHref="/dashboard"
          action={
            <button
              onClick={openCreate}
              className="w-10 h-10 rounded-full border border-gold/40 bg-transparent flex items-center justify-center text-gold text-xl font-light hover:bg-gold hover:text-black transition-all duration-500 active:scale-95"
              style={{ transitionTimingFunction: "var(--ease-lux)" }}
              aria-label="Add user"
            >
              +
            </button>
          }
        />

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 focus:border-gold/40 focus:ring-1 focus:ring-gold/20 outline-none text-sm transition-colors"
          />
        </div>

        {/* Role filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                roleFilter === r
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-white/[0.04] text-white/50 border-white/[0.06]"
              }`}
            >
              {r || "All"}
            </button>
          ))}
        </div>

        {/* User list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-danger text-sm font-light">
            Failed to load users
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm font-light">
            No users found
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-light text-white truncate">
                      {user.first_name} {user.last_name}
                    </h3>
                    <p className="text-sm text-white/40 truncate mt-0.5">
                      {user.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          roleColors[user.role] || roleColors.viewer
                        }`}
                      >
                        {user.role}
                      </span>
                      {user.totp_enabled && (
                        <span className="text-xs text-success/60">MFA</span>
                      )}
                      {user.password_change_required && (
                        <span className="text-xs text-warning/60">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(user)}
                      className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-colors text-xs"
                      aria-label={`Edit ${user.first_name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={deleting}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs transition-colors ${
                          deleteConfirm === user.id
                            ? "border-danger/40 bg-danger/10 text-danger"
                            : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-danger hover:border-danger/30"
                        }`}
                        aria-label={
                          deleteConfirm === user.id
                            ? `Confirm delete ${user.first_name}`
                            : `Delete ${user.first_name}`
                        }
                      >
                        {deleteConfirm === user.id ? (
                          <span className="text-[10px] font-semibold">OK</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {user.last_login_at && (
                  <p className="text-xs text-white/20 mt-2">
                    Last login:{" "}
                    {new Date(user.last_login_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {formError && !modalOpen && (
          <div className="text-danger text-sm text-center">{formError}</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <UserFormModal
          editingUser={editingUser}
          form={form}
          formError={formError}
          submitting={submitting}
          onUpdateField={updateField}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </AppShell>
  );
}
