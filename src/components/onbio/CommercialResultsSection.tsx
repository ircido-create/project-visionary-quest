import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCommercialResult,
  generateMeetingAgenda,
  listCommercialResults,
  listMeetingAgendas,
  saveCommercialResult,
} from "@/lib/onbio/onbio.functions";

const money = (cents: number | null) =>
  cents === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function CommercialResultsSection({ tenantId, influencerId, readOnly }: { tenantId: string; influencerId: string; readOnly: boolean }) {
  const client = useQueryClient();
  const fetchResults = useServerFn(listCommercialResults);
  const saveResult = useServerFn(saveCommercialResult);
  const removeResult = useServerFn(deleteCommercialResult);
  const createAgenda = useServerFn(generateMeetingAgenda);
  const fetchAgendas = useServerFn(listMeetingAgendas);
  const [form, setForm] = useState({ periodStart: "", periodEnd: "", revenue: "", orders: "", commission: "", goal: "", campaign: "", notes: "" });
  const results = useQuery({ queryKey: ["onbio", "results", tenantId, influencerId], queryFn: () => fetchResults({ data: { tenantId, influencerId } }) });
  const agendas = useQuery({ queryKey: ["onbio", "agendas", tenantId, influencerId], queryFn: () => fetchAgendas({ data: { tenantId, influencerId } }) });
  const invalidate = () => { client.invalidateQueries({ queryKey: ["onbio", "results", tenantId, influencerId] }); client.invalidateQueries({ queryKey: ["onbio", "agendas", tenantId, influencerId] }); };
  const mutation = useMutation({
    mutationFn: () => saveResult({ data: { tenantId, influencerId, id: null, periodStart: form.periodStart, periodEnd: form.periodEnd, revenueCents: Math.round(Number(form.revenue || 0) * 100), orders: Number(form.orders || 0), commissionCents: Math.round(Number(form.commission || 0) * 100), goalCents: form.goal ? Math.round(Number(form.goal) * 100) : null, campaign: form.campaign || null, notes: form.notes || null } }),
    onSuccess: () => { setForm({ periodStart: "", periodEnd: "", revenue: "", orders: "", commission: "", goal: "", campaign: "", notes: "" }); invalidate(); toast.success("Resultado comercial registrado."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeMutation = useMutation({ mutationFn: (id: string) => removeResult({ data: { tenantId, id } }), onSuccess: () => { invalidate(); toast.success("Resultado removido."); }, onError: (error: Error) => toast.error(error.message) });
  const agendaMutation = useMutation({ mutationFn: () => createAgenda({ data: { tenantId, influencerId, periodStart: null, periodEnd: null } }), onSuccess: () => { invalidate(); toast.success("Pauta de reunião criada."); }, onError: (error: Error) => toast.error(error.message) });
  const total = (results.data ?? []).reduce((sum, row) => sum + row.revenue_cents, 0);

  return <>
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><BarChart3 className="h-5 w-5" /> Resultados comerciais</h2><p className="mt-1 text-sm text-muted-foreground">Faturamento, pedidos, comissão e metas por período.</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Faturamento acumulado</p><p className="text-2xl font-semibold text-primary">{money(total)}</p></div></div>
      {!readOnly ? <form className="mt-5 grid gap-3 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <Field label="Início"><Input type="date" required value={form.periodStart} onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))} /></Field>
        <Field label="Fim"><Input type="date" required value={form.periodEnd} onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))} /></Field>
        <Field label="Faturamento (R$)"><Input type="number" min="0" step="0.01" required value={form.revenue} onChange={(e) => setForm((p) => ({ ...p, revenue: e.target.value }))} /></Field>
        <Field label="Pedidos"><Input type="number" min="0" required value={form.orders} onChange={(e) => setForm((p) => ({ ...p, orders: e.target.value }))} /></Field>
        <Field label="Comissão (R$)"><Input type="number" min="0" step="0.01" value={form.commission} onChange={(e) => setForm((p) => ({ ...p, commission: e.target.value }))} /></Field>
        <Field label="Meta (R$)"><Input type="number" min="0" step="0.01" value={form.goal} onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))} /></Field>
        <Field label="Campanha ou produto"><Input value={form.campaign} onChange={(e) => setForm((p) => ({ ...p, campaign: e.target.value }))} /></Field>
        <Field label="Observações"><Textarea rows={1} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
        <Button className="md:col-span-4 md:w-fit" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Registrar resultado"}</Button>
      </form> : null}
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Período</th><th>Campanha</th><th>Faturamento</th><th>Pedidos</th><th>Comissão</th><th>Meta</th><th /></tr></thead><tbody>{(results.data ?? []).map((row) => <tr key={row.id} className="border-t border-border/60"><td className="py-3">{new Date(`${row.period_start}T12:00:00`).toLocaleDateString("pt-BR")} – {new Date(`${row.period_end}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{row.campaign ?? "—"}</td><td>{money(row.revenue_cents)}</td><td>{row.orders}</td><td>{money(row.commission_cents)}</td><td>{money(row.goal_cents)}</td><td>{!readOnly ? <Button type="button" variant="ghost" size="icon" title="Excluir resultado" onClick={() => removeMutation.mutate(row.id)}><Trash2 className="h-4 w-4" /></Button> : null}</td></tr>)}</tbody></table>{!results.isLoading && (results.data ?? []).length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhum resultado registrado.</p> : null}</div>
    </section>
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><Sparkles className="h-5 w-5" /> Pautas de reunião</h2><p className="mt-1 text-sm text-muted-foreground">Sugestões baseadas exclusivamente nos resultados comerciais registrados.</p></div><Button onClick={() => agendaMutation.mutate()} disabled={readOnly || agendaMutation.isPending || !results.data?.length}>{agendaMutation.isPending ? "Preparando..." : "Gerar pauta"}</Button></div>
      <div className="mt-5 grid gap-4">{(agendas.data ?? []).map((agenda) => { const output = agenda.output as { resumo_executivo?: string; conquistas?: string[]; pontos_de_atencao?: string[]; perguntas?: string[]; decisoes_necessarias?: string[]; proximos_passos?: string[] } | null; return <article key={agenda.id} className="rounded-lg border border-border/60 p-4"><div className="flex justify-between gap-3"><strong>{new Date(agenda.created_at).toLocaleString("pt-BR")}</strong><span className="text-xs text-muted-foreground">{agenda.status === "CONCLUIDA" ? "Pronta para revisão" : agenda.status}</span></div>{output ? <div className="mt-3 grid gap-3 text-sm"><p>{output.resumo_executivo}</p><AgendaList title="Conquistas" items={output.conquistas} /><AgendaList title="Pontos de atenção" items={output.pontos_de_atencao} /><AgendaList title="Perguntas" items={output.perguntas} /><AgendaList title="Decisões necessárias" items={output.decisoes_necessarias} /><AgendaList title="Próximos passos" items={output.proximos_passos} /></div> : agenda.error ? <p className="mt-2 text-sm text-destructive">{agenda.error}</p> : null}</article>; })}{!agendas.isLoading && (agendas.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pauta gerada.</p> : null}</div>
    </section>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
function AgendaList({ title, items }: { title: string; items?: string[] }) { if (!items?.length) return null; return <div><h3 className="font-semibold">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }