import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, User, GraduationCap, FileText, MessageSquare,
  CheckCircle2, Circle, Plus, Trash2, UploadCloud, Building2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PortalShell, Panel, Field, inputCls, StatusPill, type PortalNavItem } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMON_SUBJECTS, DOCUMENT_TYPES, PROVINCES, calculateAps, markToLevel, type SubjectMark,
} from "@/lib/status";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Student Dashboard | Career Consultation Services" },
      { name: "description", content: "Complete your application, add your marks, upload documents and read feedback." },
    ],
  }),
  component: StudentDashboard,
});

const NAV: PortalNavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "details", label: "Application Form", icon: User },
  { key: "marks", label: "Subjects & Marks", icon: GraduationCap },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
];

type Form = Record<string, string>;
const FIELDS = [
  "title", "first_name", "surname", "id_number", "date_of_birth", "gender", "nationality", "home_language",
  "phone", "email", "address", "city", "province", "postal_code",
  "guardian_name", "guardian_relationship", "guardian_phone", "guardian_email",
  "disability", "grade_status", "school", "matric_year", "exam_body",
  "field_of_interest", "first_choice", "second_choice", "third_choice", "preferred_institutions", "funding", "notes",
];

function StudentDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<any>(null);
  const [form, setForm] = useState<Form>({});
  const [subjects, setSubjects] = useState<SubjectMark[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [eligibility, setEligibility] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const aps = useMemo(() => calculateAps(subjects), [subjects]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (roles?.some((r) => r.role === "admin")) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    setUserId(u.user.id);
    setEmail(u.user.email ?? "");
    const { data: a } = await supabase.from("applications").select("*").eq("user_id", u.user.id).maybeSingle();
    if (a) {
      setApp(a);
      const f: Form = {};
      FIELDS.forEach((k) => (f[k] = (a as any)[k] ?? ""));
      setForm(f);
      setSubjects(Array.isArray(a.subjects) ? (a.subjects as SubjectMark[]) : []);
      const [d, e, up] = await Promise.all([
        supabase.from("application_documents").select("*").eq("application_id", a.id).order("created_at"),
        supabase.from("eligibility_results").select("*").eq("application_id", a.id).order("created_at"),
        supabase.from("application_updates").select("*").eq("application_id", a.id).order("created_at", { ascending: false }),
      ]);
      setDocuments(d.data ?? []);
      setEligibility(e.data ?? []);
      setUpdates(up.data ?? []);
    } else {
      setForm({ email: u.user.email ?? "", nationality: "South African", grade_status: "Grade 12 (Matric)" });
      setSubjects([
        { subject: "English First Additional Language", mark: null },
        { subject: "Mathematics", mark: null },
        { subject: "Life Orientation", mark: null },
      ]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    const payload: Record<string, unknown> = { user_id: userId, subjects, aps, ...extra };
    FIELDS.forEach((k) => (payload[k] = form[k]?.toString().trim() || null));
    payload.full_name = [form.first_name, form.surname].filter(Boolean).join(" ") || null;
    payload.email = form.email || email;
    const q = app
      ? supabase.from("applications").update(payload as any).eq("id", app.id).select().single()
      : supabase.from("applications").insert(payload as any).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return null;
    }
    setApp(data);
    toast.success("Saved");
    return data;
  }

  async function upload(docKey: string, file: File) {
    const current = app ?? (await save());
    if (!current) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("Files must be smaller than 20MB.");
    setUploading(docKey);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${docKey}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("learner-documents").upload(path, file);
    if (!error) {
      await supabase.from("application_documents").insert({
        application_id: current.id, doc_type: docKey, file_name: file.name, file_path: path,
      });
      toast.success("Document uploaded");
      const { data } = await supabase.from("application_documents").select("*").eq("application_id", current.id).order("created_at");
      setDocuments(data ?? []);
    } else toast.error(error.message);
    setUploading(null);
  }

  async function removeDoc(doc: any) {
    await supabase.storage.from("learner-documents").remove([doc.file_path]);
    await supabase.from("application_documents").delete().eq("id", doc.id);
    setDocuments((d) => d.filter((x) => x.id !== doc.id));
  }

  const requiredDone = DOCUMENT_TYPES.filter((d) => d.required).every((d) => documents.some((x) => x.doc_type === d.key));
  const detailsDone = !!(form.first_name && form.surname && form.id_number && form.phone && form.first_choice);
  const marksDone = subjects.filter((s) => s.mark != null).length >= 6;

  async function submit() {
    if (!detailsDone || !marksDone || !requiredDone) {
      toast.error("Please complete your details, at least 6 subjects and the required documents first.");
      return;
    }
    const saved = await save({ submitted: true });
    if (saved) toast.success("Application submitted to our consultants");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-primary">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const title = NAV.find((n) => n.key === tab)?.label ?? "Dashboard";

  return (
    <PortalShell title={title} subtitle="Student Portal" email={email} nav={NAV} active={tab} onNav={setTab}>
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="rounded-xl bg-navy-gradient p-6 text-primary-foreground shadow-card sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Welcome{form.first_name ? `, ${form.first_name}` : ""}</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">Your application journey</h2>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              {app?.reference_code && <span className="rounded-md bg-primary-foreground/10 px-3 py-1 font-mono">{app.reference_code}</span>}
              {app?.submitted ? <StatusPill status={app.status} /> : <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase text-accent-foreground">Not yet submitted</span>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="APS score" value={aps || "—"} />
            <Stat label="Documents uploaded" value={documents.length} />
            <Stat label="Qualifying options" value={eligibility.length} />
          </div>

          <Panel title="Checklist">
            <ul className="space-y-3">
              <Check done={detailsDone} label="Complete your application form" onClick={() => setTab("details")} />
              <Check done={marksDone} label="Add at least 6 subjects with marks" onClick={() => setTab("marks")} />
              <Check done={requiredDone} label="Upload your ID and latest results" onClick={() => setTab("documents")} />
              <Check done={!!app?.submitted} label="Submit your application to our consultants" />
            </ul>
            {!app?.submitted && (
              <Button onClick={submit} disabled={saving} className="mt-6 font-display uppercase tracking-wide">
                Submit application
              </Button>
            )}
          </Panel>

          {updates[0] && (
            <Panel title="Latest feedback" action={<button className="text-xs font-semibold text-primary underline" onClick={() => setTab("feedback")}>View all</button>}>
              <p className="text-sm text-foreground">{updates[0].message}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(updates[0].created_at).toLocaleString()}</p>
            </Panel>
          )}
        </div>
      )}

      {tab === "details" && (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Panel title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <select className={inputCls} value={form.title ?? ""} onChange={set("title")}>
                  <option value="">Select</option>{["Mr", "Ms", "Mrs", "Miss", "Mx"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="First name(s) *"><input required className={inputCls} value={form.first_name ?? ""} onChange={set("first_name")} /></Field>
              <Field label="Surname *"><input required className={inputCls} value={form.surname ?? ""} onChange={set("surname")} /></Field>
              <Field label="SA ID / passport number *"><input required className={inputCls} value={form.id_number ?? ""} onChange={set("id_number")} /></Field>
              <Field label="Date of birth"><input type="date" className={inputCls} value={form.date_of_birth ?? ""} onChange={set("date_of_birth")} /></Field>
              <Field label="Gender">
                <select className={inputCls} value={form.gender ?? ""} onChange={set("gender")}>
                  <option value="">Select</option>{["Female", "Male", "Other", "Prefer not to say"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Nationality"><input className={inputCls} value={form.nationality ?? ""} onChange={set("nationality")} /></Field>
              <Field label="Home language"><input className={inputCls} value={form.home_language ?? ""} onChange={set("home_language")} /></Field>
              <Field label="Disability (if any)" span={2}><input className={inputCls} value={form.disability ?? ""} onChange={set("disability")} placeholder="None" /></Field>
            </div>
          </Panel>

          <Panel title="Contact & address">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cell phone *"><input required className={inputCls} value={form.phone ?? ""} onChange={set("phone")} /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={form.email ?? ""} onChange={set("email")} /></Field>
              <Field label="Street address" span={2}><input className={inputCls} value={form.address ?? ""} onChange={set("address")} /></Field>
              <Field label="Town / city"><input className={inputCls} value={form.city ?? ""} onChange={set("city")} /></Field>
              <Field label="Province">
                <select className={inputCls} value={form.province ?? ""} onChange={set("province")}>
                  <option value="">Select</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Postal code"><input className={inputCls} value={form.postal_code ?? ""} onChange={set("postal_code")} /></Field>
            </div>
          </Panel>

          <Panel title="Parent / guardian">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input className={inputCls} value={form.guardian_name ?? ""} onChange={set("guardian_name")} /></Field>
              <Field label="Relationship"><input className={inputCls} value={form.guardian_relationship ?? ""} onChange={set("guardian_relationship")} /></Field>
              <Field label="Phone"><input className={inputCls} value={form.guardian_phone ?? ""} onChange={set("guardian_phone")} /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={form.guardian_email ?? ""} onChange={set("guardian_email")} /></Field>
            </div>
          </Panel>

          <Panel title="School information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Current status">
                <select className={inputCls} value={form.grade_status ?? ""} onChange={set("grade_status")}>
                  {["Grade 11", "Grade 12 (Matric)", "Completed matric", "Upgrading matric", "Already studying"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="School name"><input className={inputCls} value={form.school ?? ""} onChange={set("school")} /></Field>
              <Field label="Matric year"><input className={inputCls} value={form.matric_year ?? ""} onChange={set("matric_year")} placeholder="e.g. 2026" /></Field>
              <Field label="Examination body">
                <select className={inputCls} value={form.exam_body ?? ""} onChange={set("exam_body")}>
                  <option value="">Select</option>{["NSC (DBE)", "IEB", "SACAI", "Cambridge", "NC(V)", "Other"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Study preferences">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Field of interest" span={2}><input className={inputCls} value={form.field_of_interest ?? ""} onChange={set("field_of_interest")} placeholder="e.g. Engineering, Health Sciences, Law" /></Field>
              <Field label="First choice course *"><input required className={inputCls} value={form.first_choice ?? ""} onChange={set("first_choice")} /></Field>
              <Field label="Second choice course"><input className={inputCls} value={form.second_choice ?? ""} onChange={set("second_choice")} /></Field>
              <Field label="Third choice course"><input className={inputCls} value={form.third_choice ?? ""} onChange={set("third_choice")} /></Field>
              <Field label="Preferred institutions"><input className={inputCls} value={form.preferred_institutions ?? ""} onChange={set("preferred_institutions")} placeholder="e.g. UJ, TUT, Wits" /></Field>
              <Field label="How will you fund your studies?">
                <select className={inputCls} value={form.funding ?? ""} onChange={set("funding")}>
                  <option value="">Select</option>{["NSFAS", "Bursary", "Self / family funded", "Student loan", "Not sure yet"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Anything else we should know?" span={2}><textarea rows={3} className={inputCls} value={form.notes ?? ""} onChange={set("notes")} /></Field>
            </div>
          </Panel>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="font-display uppercase tracking-wide">{saving ? "Saving..." : "Save details"}</Button>
          </div>
        </form>
      )}

      {tab === "marks" && (
        <Panel
          title="Subjects & latest marks"
          action={<span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">APS {aps}</span>}
        >
          <p className="mb-4 text-sm text-muted-foreground">Enter your most recent results (Grade 11 final or Grade 12). APS uses your best six subjects, excluding Life Orientation.</p>
          <datalist id="subjects">{COMMON_SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_56px_36px] items-center gap-2">
                <input list="subjects" className={inputCls} value={s.subject} placeholder="Subject"
                  onChange={(e) => setSubjects((l) => l.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))} />
                <input type="number" min={0} max={100} className={inputCls} value={s.mark ?? ""} placeholder="%"
                  onChange={(e) => setSubjects((l) => l.map((x, j) => (j === i ? { ...x, mark: e.target.value === "" ? null : Math.min(100, Number(e.target.value)) } : x)))} />
                <span className="text-center text-sm font-semibold text-primary">{s.mark != null ? `L${markToLevel(s.mark)}` : "—"}</span>
                <button type="button" aria-label="Remove" onClick={() => setSubjects((l) => l.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setSubjects((l) => [...l, { subject: "", mark: null }])} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add subject
            </Button>
            <Button onClick={() => save()} disabled={saving} className="font-display uppercase tracking-wide">{saving ? "Saving..." : "Save marks"}</Button>
          </div>
        </Panel>
      )}

      {tab === "documents" && (
        <Panel title="Supporting documents">
          <p className="mb-4 text-sm text-muted-foreground">PDF or clear photos, max 20MB each. Items marked * are required.</p>
          <div className="divide-y divide-border">
            {DOCUMENT_TYPES.map((d) => {
              const files = documents.filter((x) => x.doc_type === d.key);
              return (
                <div key={d.key} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {files.length ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm font-semibold text-foreground">{d.label}{d.required && " *"}</span>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary">
                      {uploading === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                      Upload
                      <input type="file" className="hidden" accept=".pdf,image/*" disabled={!!uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(d.key, f); e.target.value = ""; }} />
                    </label>
                  </div>
                  {files.map((f) => (
                    <div key={f.id} className="ml-6 mt-2 flex items-center justify-between rounded-md bg-secondary/60 px-3 py-1.5 text-xs">
                      <span className="truncate">{f.file_name}</span>
                      <button type="button" onClick={() => removeDoc(f)} className="text-muted-foreground hover:text-destructive" aria-label="Remove file">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "feedback" && (
        <div className="space-y-6">
          <Panel title="Where you qualify">
            {eligibility.length === 0 ? (
              <p className="text-sm text-muted-foreground">Our consultants will list the institutions and programmes you qualify for here once they've reviewed your results.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {eligibility.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-primary">{e.programme}</p>
                        <p className="text-xs text-muted-foreground">{e.institution}</p>
                      </div>
                    </div>
                    {e.requirements && <p className="mt-2 text-xs text-foreground">{e.requirements}</p>}
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase">
                      <span className={`rounded-full px-2 py-0.5 ${e.meets_requirements ? "bg-primary text-primary-foreground" : "bg-destructive/10 text-destructive"}`}>
                        {e.meets_requirements ? "Meets requirements" : "Does not meet yet"}
                      </span>
                      <span className="rounded-full bg-accent/30 px-2 py-0.5 text-foreground">{e.application_status}</span>
                    </div>
                    {e.notes && <p className="mt-2 text-xs text-muted-foreground">{e.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Messages from your consultant">
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            ) : (
              <ol className="space-y-4 border-l-2 border-accent pl-4">
                {updates.map((u) => (
                  <li key={u.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      {u.status && <StatusPill status={u.status} />}
                      <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{u.message}</p>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function Check({ done, label, onClick }: { done: boolean; label: string; onClick?: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex items-center gap-3 text-left text-sm">
        {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
        <span className={done ? "text-muted-foreground line-through" : "font-semibold text-foreground"}>{label}</span>
      </button>
    </li>
  );
}
