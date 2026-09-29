import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Mail, Phone, MessageCircle, UserCircle2, LogIn } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About Us" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/contact", label: "Contact" },
] as const;

export const CONTACT = {
  phone: "+27 69 517 0424",
  whatsapp: "+27 69 517 0424",
  whatsappUrl: "https://wa.me/27695170424",
  email: "sitholenathi817@gmail.com",
};

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:flex lg:justify-between">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/CCS logo.jpeg"
              alt="Career Consultation Services logo"
              width={48}
              height={48}
              className="h-11 w-11 shrink-0 rounded-md object-contain bg-white/10"
            />
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-extrabold uppercase tracking-tight text-primary">
                Career Consultation
              </span>
              <span className="block truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Services
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                activeProps={{ className: "bg-secondary text-primary" }}
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <div className="ml-2 flex items-center gap-2">
                <Button asChild size="sm">
                  <Link to="/dashboard">My Dashboard</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              /* Unauthenticated status badge & portal access trigger */
              <Button
                asChild
                size="sm"
                variant="outline"
                className="ml-3 gap-2.5 rounded-full border-border bg-background px-3.5 py-1.5 shadow-sm transition-all hover:border-primary/40 hover:bg-secondary"
              >
                <Link to="/auth">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                  </span>
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Portal Access
                  </span>
                </Link>
              </Button>
            )}
          </nav>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-primary lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <nav className="border-t border-border bg-card px-4 pb-4 lg:hidden">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground"
                activeProps={{ className: "bg-secondary text-primary" }}
              >
                {item.label}
              </Link>
            ))}

            {user ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-semibold text-primary"
                >
                  My Dashboard
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    handleSignOut();
                  }}
                  className="mt-1 w-full justify-start"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="mt-3 border-t border-border pt-3">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-xl border-border bg-background py-5 shadow-sm"
                >
                  <Link to="/auth" onClick={() => setOpen(false)}>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                    </span>
                    <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Portal Access (Not Logged In)
                    </span>
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-navy-gradient text-primary-foreground">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <h3 className="font-display text-lg font-extrabold uppercase">Career Consultation Services</h3>
            <p className="mt-3 text-sm text-primary-foreground/80">
              Application support for learners: submit your results and documents, and our consultants
              assist with applications to tertiary institutions.
            </p>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-accent">Pages</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-primary-foreground/80 hover:text-accent">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/auth" className="flex items-center gap-1.5 text-primary-foreground/80 hover:text-accent">
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Applicant Portal</span>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-accent">Contact</h3>
            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/85">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-accent" />
                <a href="tel:+27695170424" className="hover:underline">
                  {CONTACT.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0 text-accent" />
                <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  WhatsApp {CONTACT.whatsapp}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                <a href={`mailto:${CONTACT.email}`} className="hover:underline">
                  {CONTACT.email}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-foreground/15 px-4 py-4 text-center text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Career Consultation Services. Final admission decisions remain with
          the relevant institution.
        </div>
      </footer>
    </div>
  );
}