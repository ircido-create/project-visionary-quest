import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  confirmEvidence,
  createEvidenceUpload,
  deleteEvidence,
  listEvidence,
  registerEvidence,
} from "@/lib/mcb/evidence.functions";
import {
  EVIDENCE_BUCKET,
  EVIDENCE_MIME_TYPES,
  EVIDENCE_URL_TTL_SECONDS,
  MAX_EVIDENCE_BYTES,
  formatBytes,
  isEvidenceMimeType,
} from "@/lib/mcb/evidence";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  tenantId: string;
  influencerId: string;
  readOnly: boolean;
};

export function EvidenceSection({ tenantId, influencerId, readOnly }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const fetchEvidence = useServerFn(listEvidence);
  const requestUpload = useServerFn(createEvidenceUpload);
  const register = useServerFn(registerEvidence);
  const confirm = useServerFn(confirmEvidence);
  const remove = useServerFn(deleteEvidence);

  const queryKey = ["mcb", "evidence", tenantId, influencerId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchEvidence({ data: { tenantId, influencerId } }),
    // As URLs sao assinadas e expiram; recarrega antes disso para a imagem nao sumir.
    refetchInterval: (EVIDENCE_URL_TTL_SECONDS - 60) * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const guard = () => {
    if (readOnly) {
      toast.error("Ambiente de demonstração: as alterações não são salvas.");
      return false;
    }
    return true;
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!isEvidenceMimeType(file.type)) {
        throw new Error("Formato não aceito. Envie PNG, JPG ou WEBP.");
      }
      if (file.size > MAX_EVIDENCE_BYTES) {
        throw new Error(`O print passa do limite de ${formatBytes(MAX_EVIDENCE_BYTES)}.`);
      }

      const { path, token } = await requestUpload({
        data: { tenantId, influencerId, mimeType: file.type, sizeBytes: file.size },
      });

      const { error } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .uploadToSignedUrl(path, token, file);
      if (error) throw new Error(error.message);

      // Só registra depois que o objeto está de fato no Storage, para não deixar
      // uma linha em `files` apontando para um arquivo que nunca subiu.
      await register({
        data: {
          tenantId,
          influencerId,
          storagePath: path,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });
    },
    onSuccess: () => {
      toast.success("Print enviado. Falta a confirmação de uma pessoa.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível enviar o print."),
  });

  const confirmMutation = useMutation({
    mutationFn: (input: { fileId: string; caption: string }) =>
      confirm({ data: { tenantId, ...input } }),
    onSuccess: (_result, variables) => {
      setCaptions((current) => {
        const next = { ...current };
        delete next[variables.fileId];
        return next;
      });
      toast.success("Evidência confirmada.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível confirmar a evidência."),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => remove({ data: { tenantId, fileId } }),
    onSuccess: () => {
      toast.success("Evidência removida.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível remover a evidência."),
  });

  const files = query.data?.files ?? [];
  const pending = files.filter((file) => !file.confirmed).length;

  return (
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">Evidências</h2>
        {pending > 0 ? (
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {pending} aguardando confirmação
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Prints dos insights do Instagram. Nenhum número entra na qualificação por conta do print:
        uma pessoa precisa olhar a imagem e registrar o que leu.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          ref={fileInputRef}
          type="file"
          accept={EVIDENCE_MIME_TYPES.join(",")}
          className="max-w-sm"
          disabled={readOnly || uploadMutation.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!guard()) {
              event.target.value = "";
              return;
            }
            uploadMutation.mutate(file);
          }}
        />
        <span className="text-xs text-muted-foreground">
          PNG, JPG ou WEBP · até {formatBytes(MAX_EVIDENCE_BYTES)}
        </span>
      </div>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando evidências...</p>
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum print enviado até agora.</p>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => (
            <li key={file.id} className="rounded-lg border border-border/60 p-3">
              {file.url ? (
                <a href={file.url} target="_blank" rel="noreferrer">
                  <img
                    src={file.url}
                    alt="Print de insights da candidata"
                    loading="lazy"
                    className="h-40 w-full rounded-md border border-border/40 object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-md border border-border/40 text-xs text-muted-foreground">
                  Pré-visualização indisponível
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{new Date(file.createdAt).toLocaleString("pt-BR")}</span>
                <span>{formatBytes(file.sizeBytes)}</span>
              </div>

              {file.confirmed ? (
                <div className="mt-3 text-sm">
                  <p className="text-primary">Confirmado</p>
                  {file.caption ? <p className="mt-1">{file.caption}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {file.confirmedBy ?? "Equipe"}
                    {file.confirmedAt
                      ? ` · ${new Date(file.confirmedAt).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </div>
              ) : (
                <form
                  className="mt-3 grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!guard()) return;
                    confirmMutation.mutate({
                      fileId: file.id,
                      caption: captions[file.id] ?? "",
                    });
                  }}
                >
                  <Input
                    placeholder="O que você lê neste print?"
                    value={captions[file.id] ?? ""}
                    onChange={(event) =>
                      setCaptions((current) => ({ ...current, [file.id]: event.target.value }))
                    }
                    required
                    minLength={3}
                    maxLength={280}
                    disabled={readOnly}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={readOnly || confirmMutation.isPending}
                  >
                    Confirmar evidência
                  </Button>
                </form>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-destructive"
                disabled={readOnly || deleteMutation.isPending}
                onClick={() => {
                  if (!guard()) return;
                  deleteMutation.mutate(file.id);
                }}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
