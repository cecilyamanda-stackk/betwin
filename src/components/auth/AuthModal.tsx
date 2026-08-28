"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { BrandLogo } from "@/components/layout/BrandLogo";

export type AuthMode = "login" | "register";

interface AuthModalProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
}

/**
 * Floating login/register modal, opened from the header's Login/Register
 * buttons (see AuthButtons). Reuses the same LoginForm/RegisterForm the
 * standalone /auth/login and /auth/register pages render, so there's one
 * source of truth for the auth logic — the modal is just a presentation
 * wrapper around it.
 */
export function AuthModal({ mode, onModeChange, onClose }: AuthModalProps) {
  const router = useRouter();

  function handleSuccess() {
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title={mode === "login" ? "Log in" : "Create your account"}>
      <div className="flex flex-col items-center">
        <BrandLogo />
        <div className="mt-6 w-full">
          {mode === "login" ? (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToRegister={() => onModeChange("register")}
            />
          ) : (
            <RegisterForm onSuccess={handleSuccess} onSwitchToLogin={() => onModeChange("login")} />
          )}
        </div>
      </div>
    </Modal>
  );
}
