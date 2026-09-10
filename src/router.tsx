import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Sem estas duas linhas o padrão é `staleTime: 0`: todo dado nasce velho, e cada
  // navegação entre páginas refaz as consultas mesmo que nada tenha mudado. Medido no
  // navegador, eram 3 chamadas ao servidor por navegação. Meio minuto é curto o
  // bastante para não esconder alteração feita por outra pessoa da equipe, e as
  // mutações invalidam as chaves afetadas na hora — quem edita vê o efeito imediato.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
