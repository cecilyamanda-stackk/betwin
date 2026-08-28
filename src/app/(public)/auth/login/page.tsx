"use client";

import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * Standalone login route. Kept for direct links (e.g. shared URLs, the
 * password-reset flow) even though the header now opens this same form
 * in a modal via AuthButtons/AuthModal — both render LoginForm, so
 * there's one source of truth for the auth logic.
 */
export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
      <BrandLogo />
      <div className="mt-6 w-full">
        <LoginForm
          onSuccess={() => {
            router.push("/");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
