import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutDashboard, Search, Users, FileCheck2, Clock, Trophy, Loader2 } from "lucide-react";
import { PortalShell, Panel, StatusPill, inputCls } from "@/components/portal-shell";
import { supabase } from "@/integrations/supabase/client";
import { APPLICATION_STATUSES, STATUS_LABELS } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Career Consultation Services" },
      { name: "description", content: "Review learner applications, documents and qualification results." },
    ],
  }),
  component: AdminDashboard,
});

const NAV = [{ key: "all", label: "All learners", icon: LayoutDashboard }];

function AdminDashboard() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, reference_code, full_name, email, phone, aps, first_choice, province, status, submitted, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const apps = data ?? [];

  const filtered = useMemo(
    () =>
      apps.filter((a) => {
        const s = `${a.full_name ?? ""} ${a.reference_code} ${a.email} ${a.first_choice ?? ""}`.toLowerCase();
        return s.includes(q.toLowerCase()) && (!status || a.status === status);
      }),
    [apps, q, status],
  );

  const submitted = apps.filter((a) => a.submitted);

  return (
    <PortalShell title="Learner Applications" subtitle="Admin Portal" nav={NAV} active="all" onNav={() => navigate({ to: "/admin" })}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} label="Registered learners" value={apps.length} />
          <Stat icon={FileCheck2} label="Submitted" value={submitted.length} />
          <Stat icon={Clock} label="Awaiting assessment" value={submitted.filter((a) => a.status === "documents_submitted").length} />
          <Stat icon={Trophy} label="Successful" value={apps.filter((a) => a.status === "successful").length} />
        </div>

        <Panel>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input className={`${inputCls} pl-9`} placeholder="Search name, reference, email, course" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className={`${inputCls} sm:w-60`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10 text-primary"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No learners yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Learner</th>
                    <th className="py-2 pr-3">First choice</th>
                    <th className="py-2 pr-3">APS</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 hover:bg-secondary/50">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-foreground">{a.full_name || "Unnamed learner"}</p>
                        <p className="text-xs text-muted-foreground">{a.reference_code} · {a.email}</p>
                      </td>
                      <td className="py-3 pr-3">{a.first_choice || "—"}</td>
                      <td className="py-3 pr-3 font-bold text-primary">{a.aps ?? "—"}</td>
                      <td className="py-3 pr-3">
                        {a.submitted ? <StatusPill status={a.status} /> : <span className="text-xs font-semibold uppercase text-muted-foreground">Draft</span>}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">{new Date(a.updated_at).toLocaleDateString()}</td>
                      <td className="py-3 text-right">
                        <Link to="/admin/$id" params={{ id: a.id }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="rounded-lg bg-accent/25 p-3 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-extrabold text-primary">{value}</p>
      </div>
    </div>
  );
}
