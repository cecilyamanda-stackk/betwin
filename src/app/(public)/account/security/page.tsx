import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SecurityForm } from "@/components/account/SecurityForm";

export default async function AccountSecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) redirect("/auth/login");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Security &amp; 2FA</h1>
      <SecurityForm email={user.email} />
    </div>
  );
}
