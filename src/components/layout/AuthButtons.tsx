"use client";

import { useState } from "react";
import { AuthModal, type AuthMode } from "@/components/auth/AuthModal";

/**
 * Renders the header's Login/Register buttons and owns the modal state.
 * Split out from Header (a server component) since it needs client-side
 * interactivity.
 */
export function AuthButtons() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  function openAs(m: AuthMode) {
    setMode(m);
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => openAs("login")} className="btn-secondary">
          Login
        </button>
        <button type="button" onClick={() => openAs("register")} className="btn-primary">
          Register
        </button>
      </div>

      {open && <AuthModal mode={mode} onModeChange={setMode} onClose={() => setOpen(false)} />}
    </>
  );
}
