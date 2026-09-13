import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AceiteDosTermosGate } from "@/components/mcb/AceiteDosTermosGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AreaLogada,
});

// Toda a área logada passa pelo aceite dos Termos e da Política (revisão jurídica, T1).
function AreaLogada() {
  const { user } = Route.useRouteContext();
  return (
    <AceiteDosTermosGate userId={user.id}>
      <Outlet />
    </AceiteDosTermosGate>
  );
}
