"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { AdminForm } from "@/components/admin/AdminForm";
import { FormField } from "@/components/ui/FormField";
import { createNotification, type NotificationInput } from "@/actions/admin/notifications";

interface Notification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  authorUsername: string;
}

const emptyForm: NotificationInput = { title: "", body: "" };

export function NotificationsManager({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NotificationInput>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are both required.");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await createNotification(form);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
    setForm(emptyForm);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-text-secondary">System-wide announcements.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setError(null);
            setModalOpen(true);
          }}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Compose
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="card px-6 py-10 text-center text-sm text-text-secondary">
          No announcements sent yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <div key={n.id} className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display font-bold text-text-primary">{n.title}</h2>
                <span className="text-xs text-text-secondary">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-text-secondary">{n.body}</p>
              <p className="mt-2 text-xs text-text-secondary">— @{n.authorUsername}</p>
            </div>
          ))}
        </div>
      )}

      <AdminForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Compose announcement"
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        submitLabel="Send"
      >
        <FormField label="Title" type="text" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-secondary">Body</span>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
            rows={4}
            className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:border-gold/60"
          />
        </label>
      </AdminForm>
    </div>
  );
}
