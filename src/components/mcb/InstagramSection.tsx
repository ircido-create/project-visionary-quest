/**
 * Fase 4 — Conexão com o Instagram.
 *
 * O mesmo componente serve as duas telas, porque o que muda entre elas é só quem pode
 * agir: no portal a candidata conecta, sincroniza e desconecta; no detalhe a gestora
 * apenas vê. Duplicar isso em dois componentes faria a informação divergir — a gestora
 * precisa enxergar exatamente o estado que a candidata enxerga, inclusive o erro.
 *
 * Nenhum caminho aqui recebe token: `getInstagramStatus` devolve só data de conexão,
 * usuário e resultado do último sync.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  desconectarInstagram,
  getInstagramStatus,
  iniciarConexaoInstagram,
  integracaoMetaDisponivel,
  sincronizarInstagram,
  type StatusInstagram,
} from "@/lib/mcb/instagram.functions";

const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

export function InstagramSection({
  influencerId,
  podeGerenciar,
}: {
  influencerId: string;
  /** Verdadeiro só para a dona da conta. A recusa real acontece no banco. */
  podeGerenciar: boolean;
}) {
  const queryClient = useQueryClient();
  const buscarStatus = useServerFn(getInstagramStatus);
  const verificarDisponivel = useServerFn(integracaoMetaDisponivel);
  const iniciar = useServerFn(iniciarConexaoInstagram);
  const sincronizar = useServerFn(sincronizarInstagram);
  const desconectar = useServerFn(desconectarInstagram);

  const queryKey = ["mcb", "instagram", influencerId];

  const { data: config } = useQuery({
    queryKey: ["mcb", "instagram-config"],
    queryFn: () => verificarDisponivel(),
    // A configuração do app da Meta não muda enquanto a pessoa navega.
    staleTime: Infinity,
  });

  const status = useQuery({
    queryKey,
    queryFn: () => buscarStatus({ data: { influencerId } }),
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey });
    // Os números mudam: a candidata vê pelo portal, a gestora pelo detalhe.
    queryClient.invalidateQueries({ queryKey: ["mcb", "portal"] });
    queryClient.invalidateQueries({ queryKey: ["mcb", "influencer"] });
  };

  const conexao = useMutation({
    mutationFn: () => iniciar({ data: { influencerId } }),
    onSuccess: ({ url }) => {
      // Sai da aplicação de propósito: a autorização acontece no domínio do Instagram,
      // e é lá que a candidata confere o que está autorizando.
      window.location.href = url;
    },
    // A mensagem do servidor é a que explica o motivo — engoli-la já custou caro antes.
    onError: (erro: Error) => toast.error(erro.message),
  });

  const sync = useMutation({
    mutationFn: () => sincronizar({ data: { influencerId } }),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.demografiaIndisponivel
          ? "Números atualizados. O público por gênero não veio — a Meta só informa a partir de 100 seguidores."
          : "Números atualizados direto do Instagram.",
      );
    },
    onError: (erro: Error) => {
      invalidar();
      toast.error(erro.message);
    },
  });

  const remocao = useMutation({
    mutationFn: () => desconectar({ data: { influencerId } }),
    onSuccess: () => {
      invalidar();
      toast.success("Instagram desconectado.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  // Sem app da Meta configurado não há o que oferecer, e um botão que só dá erro é
  // pior que botão nenhum.
  if (!config?.disponivel) return null;

  const s = (status.data ?? { conectado: false }) as StatusInstagram;
  const ocupado = conexao.isPending || sync.isPending || remocao.isPending;

  return (
    <div className="mt-6 rounded-lg border border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Instagram oficial
          </h3>
          {s.conectado ? (
            <p className="mt-1 text-sm">
              Conectado{s.usuario ? ` como @${s.usuario}` : ""}
              {dataHora(s.ultimo_sync) ? (
                <span className="text-muted-foreground">
                  {" "}
                  · atualizado em {dataHora(s.ultimo_sync)}
                </span>
              ) : (
                <span className="text-muted-foreground"> · ainda não sincronizado</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {podeGerenciar
                ? "Conectando sua conta profissional, seus números entram sozinhos — sem print."
                : "A candidata ainda não conectou a conta."}
            </p>
          )}
        </div>

        {podeGerenciar ? (
          <div className="flex flex-wrap gap-2">
            {s.conectado ? (
              <>
                <Button size="sm" onClick={() => sync.mutate()} disabled={ocupado}>
                  {sync.isPending ? "Atualizando…" : "Atualizar agora"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => remocao.mutate()}
                  disabled={ocupado}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => conexao.mutate()} disabled={ocupado}>
                Conectar Instagram
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {s.ultimo_erro ? (
        <p className="mt-3 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Última tentativa falhou: {s.ultimo_erro}
          {podeGerenciar ? " Reconectar costuma resolver." : ""}
        </p>
      ) : null}

      {podeGerenciar ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Só leitura: seguidores, publicações e a divisão de público por gênero. Nada é publicado na
          sua conta, e você pode desconectar quando quiser. O público por gênero só é informado pela
          Meta a partir de 100 seguidores — abaixo disso, o print continua sendo o caminho.
        </p>
      ) : null}
    </div>
  );
}
