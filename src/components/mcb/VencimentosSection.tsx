/**
 * Fase 7 — Na administração: quem precisa de aviso de cobrança. O MCB não envia e-mail
 * próprio; o link abre o e-mail da dona da plataforma com a mensagem pronta para a dona
 * do ambiente (os Termos prometem avisar por e-mail antes de suspender).
 */

import type { AmbienteNaVisaoGeral } from "@/lib/mcb/admin.functions";
import {
  DIAS_DE_AVISO_DE_VENCIMENTO,
  emailDeVencimento,
  estadoDaAssinatura,
  linkDeEmail,
  precisaDeAviso,
  textoDaSituacao,
} from "@/lib/mcb/assinatura";

export function VencimentosSection({ ambientes }: { ambientes: AmbienteNaVisaoGeral[] }) {
  const lista = ambientes
    .map((ambiente) => ({
      ambiente,
      estado: estadoDaAssinatura({
        cobranca: ambiente.cobranca,
        venceEm: ambiente.venceEm,
        status: ambiente.status,
        suspensaoMotivo: ambiente.suspensaoMotivo,
        isDemo: ambiente.isDemo,
      }),
    }))
    .filter(({ estado }) => precisaDeAviso(estado));

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <h2 className="font-serif text-xl">Vencimentos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Avaliação ou mês pago terminando em até {DIAS_DE_AVISO_DE_VENCIMENTO} dias, vencidos na
        tolerância e suspensos por vencimento. O MCB não envia e-mail sozinho: o botão abre o seu
        e-mail com a mensagem pronta para a dona do ambiente.
      </p>
      {lista.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum ambiente perto do vencimento.</p>
      ) : (
        <ul className="mt-4 grid gap-3 text-sm">
          {lista.map(({ ambiente, estado }) => {
            const email = ambiente.dona?.email ?? null;
            return (
              <li key={ambiente.id} className="rounded-lg border border-border/60 p-3">
                <p className="font-medium">{ambiente.nome}</p>
                <p className="mt-1 text-xs text-muted-foreground">{textoDaSituacao(estado)}</p>
                {email ? (
                  <a
                    className="mt-2 inline-block underline underline-offset-4"
                    href={linkDeEmail(
                      email,
                      emailDeVencimento({
                        nomeDaDona: ambiente.dona?.nome ?? null,
                        ambiente: ambiente.nome,
                        estado,
                        plano: ambiente.plano?.nome ?? null,
                        precoCentavos: ambiente.precoCentavos,
                      }),
                    )}
                  >
                    Escrever para {ambiente.dona?.nome ?? email}
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sem e-mail da dona do ambiente.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
