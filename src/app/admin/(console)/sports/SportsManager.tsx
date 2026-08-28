"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminForm, AdminCheckbox } from "@/components/admin/AdminForm";
import { FormField } from "@/components/ui/FormField";
import { slugify } from "@/lib/utils/slug";
import { createSport, updateSport, type SportInput } from "@/actions/admin/sports";

interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  active: boolean;
}

const EMPTY: SportInput = { name: "", slug: "", icon: "", active: true };

export function SportsManager({ sports }: { sports: Sport[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SportInput>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setSlugTouched(false);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(sport: Sport) {
    setEditingId(sport.id);
    setForm({ name: sport.name, slug: sport.slug, icon: sport.icon ?? "", active: sport.active });
    setSlugTouched(true);
    setError(null);
    setModalOpen(true);
  }

  function updateName(name: string) {
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = editingId ? await updateSport(editingId, form) : await createSport(form);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openCreate} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Add sport
        </button>
      </div>

      <AdminTable
        rows={sports}
        keyField={(s) => s.id}
        onRowClick={openEdit}
        emptyTitle="No sports yet."
        emptyDescription="Add the first sport to start building out the catalogue."
        columns={[
          { key: "name", label: "Name", render: (s) => s.name },
          { key: "slug", label: "Slug", render: (s) => <span className="text-text-secondary">{s.slug}</span> },
          {
            key: "active",
            label: "Status",
            render: (s) => (
              <span className={s.active ? "pill pill-selected" : "pill"}>{s.active ? "Active" : "Inactive"}</span>
            ),
          },
        ]}
      />

      <AdminForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit sport" : "Add sport"}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        submitLabel={editingId ? "Save changes" : "Create sport"}
      >
        <FormField label="Name" type="text" value={form.name} onChange={updateName} required />
        <FormField
          label="Slug"
          type="text"
          value={form.slug}
          onChange={(v) => {
            setSlugTouched(true);
            setForm((f) => ({ ...f, slug: v }));
          }}
          required
        />
        <FormField
          label="Icon (optional)"
          type="text"
          value={form.icon ?? ""}
          onChange={(v) => setForm((f) => ({ ...f, icon: v }))}
        />
        <AdminCheckbox
          label="Active (visible on the public site)"
          checked={form.active}
          onChange={(v) => setForm((f) => ({ ...f, active: v }))}
        />
      </AdminForm>
    </>
  );
}
