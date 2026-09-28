import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft, User, GraduationCap, FileText, Bot, Building2, MessageSquare,
  Download, Loader2, Plus, Trash2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PortalShell, Panel, Field, StatusPill, inputCls } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import {
  getApplication, getDocumentLink, updateApplicationStatus,
  addEligibilityResult, deleteEligibilityResult, addApplicationUpdate,
} from "@/lib/applications.functions";
import { analyzeApplication, type AiAnalysis, type AiRecommendation } from "@/lib/ai.functions";
import { APPLICATION_STATUSES, DOCUMENT_TYPES, STATUS_LABELS, markToLevel, type ApplicationStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  head: () => ({ meta: [{ title: "Learner File | Career Consultation Services" }, { name: "description", content: "Learner application file." }] }),
  component: LearnerFile,
});

const NAV = [
  { key: "profile", label: "Profile", icon: User },
  { key: "marks", label: "Marks", icon: GraduationCap },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "ai", label: "AI Assistant", icon: Bot },
  { key: "eligibility", label: "Qualifications", icon: Building2 },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
  { key: "back", label: "All learners", icon: ArrowLeft },
];

function LearnerFile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("profile");
  const fetchApp = useServerFn(getApplication);
  const docLink = useServerFn(getDocumentLink);
  const setStatusFn = useServerFn(updateApplicationStatus);
  const addElig = useServerFn(addEligibilityResult);
  const delElig = useServerFn(deleteEligibilityResult);
  const addUpdate = useServerFn(addApplicationUpdate);
  const analyze = useServerFn(analyzeApplication);

  const { data, isLoading } = useQuery({ queryKey: ["admin-app", id], queryFn: () => fetchApp({ data: { id } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-app", id] });

  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");
  const [msgStatus, setMsgStatus] = useState<ApplicationStatus | "">("");
  const [manual, setManual] = useState({ institution: "", programme: "", requirements: "", notes: "", meets: true });

  if (isLoading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-primary"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  const { application: a, documents, eligibility, updates } = data as any;
  const subjects: { subject: string; mark: number | null }[] = Array.isArray(a.subjects) ? a.subjects : [];

  const onNav = (k: string) => (k === "back" ? navigate({ to: "/admin" }) : setTab(k));

  async function download(path: string) {
    try {
      const { url } = await docLink({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function changeStatus(s: ApplicationStatus) {
    await setStatusFn({ data: { id, status: s } });
    toast.success("Status updated");
    refresh();
  }

  async function runAi() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await analyze({ data: { id } });
      if (res.ok) setAnalysis(res.analysis);
      else toast.error(res.error);
    } catch {
      toast.error("The assistant could not complete the analysis.");
    }
    setAnalyzing(false);
  }

  async function saveRec(r: AiRecommendation) {
    await addElig({
      data: {
        applicationId: id, institution: r.institution, programme: r.programme, requirements: r.requirements,
        meetsRequirements: r.meets_requirements, applicationStatus: "Not yet applied",
        notes: r.closing_date ? `Closing date: ${r.closing_date}` : "",
      },
    });
    toast.success("Added to learner's qualifications");
    refresh();
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    await addElig({
      data: {
        applicationId: id, institution: manual.institution, programme: manual.programme, requirements: manual.requirements,
        meetsRequirements: manual.meets, applicationStatus: "Not yet applied", notes: manual.notes,
      },
    });
    setManual({ institution: "", programme: "", requirements: "", notes: "", meets: true });
    refresh();
  }

  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const status = (msgStatus || a.status) as ApplicationStatus;
    await addUpdate({ data: { applicationId: id, message, status } });
    if (msgStatus && msgStatus !== a.status) await setStatusFn({ data: { id, status: msgStatus } });
    setMessage("");
    setMsgStatus("");
    toast.success("Feedback sent to the learner's portal");
    refresh();
  }

  const row = (label: string, value: any) => (
    <div className="border-b border-border/60 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );

  return (
    <PortalShell title={a.full_name || "Learner"} subtitle="Admin Portal" nav={NAV} active={tab} onNav={onNav}>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{a.reference_code}</p>
          <p className="font-display text-xl font-extrabold text-primary">{a.full_name || "Unnamed learner"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={a.status} />
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">APS {a.aps ?? "—"}</span>
            {!a.submitted && <span className="text-xs font-semibold uppercase text-muted-foreground">Draft – not yet submitted</span>}
          </div>
        </div>
        <select className={`${inputCls} sm:w-64`} value={a.status} onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {tab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Personal">
            {row("Name", [a.title, a.first_name, a.surname].filter(Boolean).join(" "))}
            {row("ID / passport", a.id_number)}
            {row("Date of birth", a.date_of_birth)}
            {row("Gender", a.gender)}
            {row("Nationality", a.nationality)}
            {row("Home language", a.home_language)}
            {row("Disability", a.disability)}
          </Panel>
          <Panel title="Contact">
            {row("Phone", a.phone)}
            {row("Email", a.email)}
            {row("Address", [a.address, a.city, a.province, a.postal_code].filter(Boolean).join(", "))}
            {row("Guardian", [a.guardian_name, a.guardian_relationship].filter(Boolean).join(" – "))}
            {row("Guardian contact", [a.guardian_phone, a.guardian_email].filter(Boolean).join(" · "))}
          </Panel>
          <Panel title="School">
            {row("Status", a.grade_status)}
            {row("School", a.school)}
            {row("Matric year", a.matric_year)}
            {row("Exam body", a.exam_body)}
          </Panel>
          <Panel title="Study preferences">
            {row("Field of interest", a.field_of_interest)}
            {row("Choices", [a.first_choice, a.second_choice, a.third_choice].filter(Boolean).join(" · "))}
            {row("Preferred institutions", a.preferred_institutions)}
            {row("Funding", a.funding)}
            {row("Notes", a.notes)}
          </Panel>
        </div>
      )}

      {tab === "marks" && (
        <Panel title="Subjects & marks">
          {subjects.length === 0 ? <p className="text-sm text-muted-foreground">No marks captured.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-2">Subject</th><th>Mark</th><th>Level</th></tr></thead>
              <tbody>
                {subjects.map((s, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2">{s.subject}</td>
                    <td>{s.mark ?? "—"}%</td>
                    <td className="font-bold text-primary">{s.mark != null ? markToLevel(s.mark) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "documents" && (
        <Panel title="Documents">
          {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents uploaded.</p> : (
            <div className="divide-y divide-border">
              {documents.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{DOCUMENT_TYPES.find((t) => t.key === d.doc_type)?.label ?? d.doc_type}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.file_name} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => download(d.file_path)} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "ai" && (
        <div className="space-y-6">
          <Panel
            title="AI admissions assistant"
            action={
              <Button onClick={runAi} disabled={analyzing} className="gap-1.5">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {analyzing ? "Analysing..." : analysis ? "Run again" : "Analyse learner"}
              </Button>
            }
          >
            <p className="text-sm text-muted-foreground">
              Checks this learner's marks and interests against public university, university of technology and TVET college prospectuses, and suggests courses and institutions. Always confirm against the current official prospectus before advising the learner.
            </p>
            {analyzing && <p className="mt-4 text-sm text-primary">This can take up to a minute…</p>}
          </Panel>
          {analysis && (
            <>
              <Panel title="Summary">
                <p className="whitespace-pre-line text-sm text-foreground">{analysis.summary}</p>
                {analysis.advice && <p className="mt-3 whitespace-pre-line rounded-lg bg-accent/20 p-3 text-sm text-foreground">{analysis.advice}</p>}
              </Panel>
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-primary">{r.programme}</p>
                        <p className="text-xs text-muted-foreground">{r.institution} · {r.qualification_type}</p>
                      </div>
                      <span className="rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">{r.suitability} fit</span>
                    </div>
                    <p className="mt-3 text-xs text-foreground"><strong>Requirements:</strong> {r.requirements}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{r.reason}</p>
                    {r.closing_date && <p className="mt-2 text-xs text-muted-foreground">Closing: {r.closing_date}</p>}
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <span className={`text-[11px] font-bold uppercase ${r.meets_requirements ? "text-primary" : "text-destructive"}`}>
                        {r.meets_requirements ? "Qualifies" : "Does not meet yet"}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => saveRec(r)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add to learner</Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "eligibility" && (
        <div className="space-y-6">
          <Panel title="Qualifications shown to learner">
            {eligibility.length === 0 ? <p className="text-sm text-muted-foreground">None yet. Use the AI assistant or add one below.</p> : (
              <div className="divide-y divide-border">
                {eligibility.map((e: any) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">{e.programme}</p>
                      <p className="text-xs text-muted-foreground">{e.institution} · {e.meets_requirements ? "Qualifies" : "Does not meet yet"}</p>
                      {e.requirements && <p className="mt-1 text-xs text-foreground">{e.requirements}</p>}
                    </div>
                    <button type="button" aria-label="Remove" onClick={async () => { await delElig({ data: { id: e.id } }); refresh(); }} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Add manually">
            <form onSubmit={saveManual} className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution"><input required className={inputCls} value={manual.institution} onChange={(e) => setManual({ ...manual, institution: e.target.value })} /></Field>
              <Field label="Programme"><input required className={inputCls} value={manual.programme} onChange={(e) => setManual({ ...manual, programme: e.target.value })} /></Field>
              <Field label="Requirements" span={2}><input className={inputCls} value={manual.requirements} onChange={(e) => setManual({ ...manual, requirements: e.target.value })} /></Field>
              <Field label="Notes" span={2}><input className={inputCls} value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual.meets} onChange={(e) => setManual({ ...manual, meets: e.target.checked })} /> Learner meets requirements</label>
              <div className="text-right"><Button type="submit">Add</Button></div>
            </form>
          </Panel>
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-6">
          <Panel title="Send feedback to learner portal">
            <form onSubmit={sendFeedback} className="space-y-4">
              <textarea rows={4} className={inputCls} placeholder="e.g. We've reviewed your results. You qualify for…" value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <select className={`${inputCls} sm:w-72`} value={msgStatus} onChange={(e) => setMsgStatus(e.target.value as ApplicationStatus)}>
                  <option value="">Keep status ({STATUS_LABELS[a.status as ApplicationStatus]})</option>
                  {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                <Button type="submit">Send feedback</Button>
              </div>
            </form>
          </Panel>
          <Panel title="History">
            {updates.length === 0 ? <p className="text-sm text-muted-foreground">No feedback sent yet.</p> : (
              <ol className="space-y-4 border-l-2 border-accent pl-4">
                {updates.map((u: any) => (
                  <li key={u.id}>
                    <div className="flex items-center gap-2">{u.status && <StatusPill status={u.status} />}<span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</span></div>
                    <p className="mt-1 whitespace-pre-line text-sm">{u.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </PortalShell>
  );
}
