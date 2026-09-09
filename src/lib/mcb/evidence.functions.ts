import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EVIDENCE_BUCKET,
  EVIDENCE_EXTENSION,
  EVIDENCE_MIME_TYPES,
  EVIDENCE_URL_TTL_SECONDS,
  MAX_EVIDENCE_BYTES,
} from "@/lib/mcb/evidence";

/**
 * Fase 2 — Evidências (prints de insights).
 *
 * O bucket `evidencias` é privado e o caminho segue {tenant_id}/{influencer_id}/…,
 * que é o que as políticas de storage.objects usam para isolar os ambientes.
 * A trilha de confirmação humana (quem confirmou, quando e o que leu no print)
 * fica em audit_logs, que é onde o projeto já registra esse tipo de coisa.
 */

const evidenceMimeSchema = z.enum(EVIDENCE_MIME_TYPES);

/** Reserva um caminho no bucket e devolve o token de upload direto do navegador. */
export const createEvidenceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string; mimeType: string }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        mimeType: evidenceMimeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // A candidata precisa existir neste ambiente: sem esta conferência daria para
    // montar um caminho apontando para o tenant de outra gestora.
    const { data: influencer, error: lookupError } = await supabase
      .from("influencers")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!influencer) throw new Error("Candidata não encontrada neste ambiente.");

    const extension = EVIDENCE_EXTENSION[data.mimeType];
    const path = `${data.tenantId}/${data.influencerId}/${crypto.randomUUID()}.${extension}`;

    const { data: signed, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);

    return { path: signed.path, token: signed.token };
  });

/** Registra em `files` o print que acabou de subir — ainda sem confirmação humana. */
export const registerEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      influencerId: string;
      storagePath: string;
      mimeType: string;
      sizeBytes: number;
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          influencerId: z.string().uuid(),
          storagePath: z.string().trim().min(1).max(400),
          mimeType: evidenceMimeSchema,
          sizeBytes: z.number().int().min(1).max(MAX_EVIDENCE_BYTES),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // O caminho volta do navegador, então é reconferido aqui: caso contrário daria
    // para registrar um objeto de outro ambiente como evidência desta candidata.
    if (!data.storagePath.startsWith(`${data.tenantId}/${data.influencerId}/`)) {
      throw new Error("Caminho de arquivo inválido para esta candidata.");
    }

    const { data: file, error } = await supabase
      .from("files")
      .insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        storage_path: data.storagePath,
        kind: "insight",
        mime_type: data.mimeType,
        size_bytes: data.sizeBytes,
        confirmed: false,
        uploaded_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Não foi possível registrar a evidência.");

    await supabase.from("audit_logs").insert({
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "evidence.uploaded",
      entity: "files",
      entity_id: file.id,
      meta: { influencer_id: data.influencerId, size_bytes: data.sizeBytes },
    });

    return { id: file.id };
  });

/** Prints da candidata com URL assinada de vida curta e quem já confirmou cada um. */
export const listEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string }) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: files, error } = await supabase
      .from("files")
      .select("id, storage_path, mime_type, size_bytes, confirmed, uploaded_by, created_at")
      .eq("tenant_id", data.tenantId)
      .eq("influencer_id", data.influencerId)
      .eq("kind", "insight")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!files || files.length === 0) return { files: [] };

    const fileIds = files.map((file) => file.id);

    const [signedResult, confirmationResult] = await Promise.all([
      // Bucket privado: a imagem só é exibível por URL assinada, que expira.
      supabase.storage.from(EVIDENCE_BUCKET).createSignedUrls(
        files.map((file) => file.storage_path),
        EVIDENCE_URL_TTL_SECONDS,
      ),
      supabase
        .from("audit_logs")
        .select("entity_id, actor_id, created_at, meta")
        .eq("tenant_id", data.tenantId)
        .eq("entity", "files")
        .eq("action", "evidence.confirmed")
        .in("entity_id", fileIds)
        .order("created_at", { ascending: false }),
    ]);

    const urlByPath = new Map(
      (signedResult.data ?? [])
        .filter((item) => item.signedUrl)
        .map((item) => [item.path ?? "", item.signedUrl]),
    );

    // A consulta vem da mais recente para a mais antiga, então o primeiro registro
    // de cada arquivo é a confirmação que vale.
    const confirmationByFile = new Map<
      string,
      { actorId: string | null; at: string; caption: string | null }
    >();
    for (const row of confirmationResult.data ?? []) {
      if (!row.entity_id || confirmationByFile.has(row.entity_id)) continue;
      const meta = (row.meta ?? {}) as { caption?: unknown };
      confirmationByFile.set(row.entity_id, {
        actorId: row.actor_id,
        at: row.created_at,
        caption: typeof meta.caption === "string" && meta.caption.length > 0 ? meta.caption : null,
      });
    }

    const actorIds = [
      ...new Set([...confirmationByFile.values()].map((c) => c.actorId).filter(Boolean)),
    ];
    const nameByActor = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds as string[]);
      for (const profile of profiles ?? []) {
        nameByActor.set(profile.id, profile.full_name || profile.email || "Equipe");
      }
    }

    return {
      files: files.map((file) => {
        const confirmation = confirmationByFile.get(file.id) ?? null;
        return {
          id: file.id,
          url: urlByPath.get(file.storage_path) ?? null,
          mimeType: file.mime_type,
          sizeBytes: file.size_bytes,
          confirmed: file.confirmed,
          createdAt: file.created_at,
          confirmedBy: confirmation?.actorId
            ? (nameByActor.get(confirmation.actorId) ?? "Equipe")
            : null,
          confirmedAt: confirmation?.at ?? null,
          caption: confirmation?.caption ?? null,
        };
      }),
    };
  });

/** Confirmação humana: alguém olhou o print e atestou o que está nele. */
export const confirmEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; fileId: string; caption: string }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        fileId: z.string().uuid(),
        caption: z.string().trim().min(3).max(280),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: file, error } = await supabase
      .from("files")
      .update({ confirmed: true })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.fileId)
      .select("id, influencer_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Evidência não encontrada neste ambiente.");

    await supabase.from("audit_logs").insert({
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "evidence.confirmed",
      entity: "files",
      entity_id: file.id,
      meta: { influencer_id: file.influencer_id, caption: data.caption },
    });

    return { ok: true };
  });

/** Remove o print do Storage e o registro correspondente. */
export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; fileId: string }) =>
    z.object({ tenantId: z.string().uuid(), fileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: file, error } = await supabase
      .from("files")
      .select("id, storage_path, influencer_id")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Evidência não encontrada neste ambiente.");

    // O objeto sai primeiro: se a remoção do Storage falhar, a linha continua
    // apontando para ele e a evidência não vira um registro órfão sem imagem.
    const { error: storageError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .remove([file.storage_path]);
    if (storageError) throw new Error(storageError.message);

    const { error: deleteError } = await supabase
      .from("files")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("id", data.fileId);
    if (deleteError) throw new Error(deleteError.message);

    await supabase.from("audit_logs").insert({
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "evidence.deleted",
      entity: "files",
      entity_id: file.id,
      meta: { influencer_id: file.influencer_id },
    });

    return { ok: true };
  });
