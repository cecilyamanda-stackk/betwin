"use client";

import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * Standalone register route. Kept for direct links even though the header
 * now opens this same form in a modal via AuthButtons/AuthModal — both
 * render RegisterForm, so there's one source of truth for the auth logic.
 */
export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
      <BrandLogo />
      <div className="mt-6 w-full">
        <RegisterForm
          onSuccess={() => {
            router.push("/");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
