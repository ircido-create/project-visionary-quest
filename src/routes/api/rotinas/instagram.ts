import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina agendada de seguidores da ONBIO. Chamada pelo `pg_cron` do banco a cada hora,
 * com o segredo `MCB_ROTINA_INSTAGRAM` do Vault no cabeçalho `x-mcb-rotina`. Sem ele,
 * responde 401 e não consulta nada. A resposta traz só contagens.
 */
export const Route = createFileRoute("/api/rotinas/instagram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { chamadaDaRotinaValida, executarRotina } =
          await import("@/lib/onbio/rotinaInstagram.server");
        if (!(await chamadaDaRotinaValida(request.headers.get("x-mcb-rotina")))) {
          return Response.json({ erro: "não autorizado" }, { status: 401 });
        }
        try {
          return Response.json(await executarRotina());
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "falha na rotina";
          return Response.json({ erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});
