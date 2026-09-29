import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Portal Access | Career Consultant Services" }],
  }),
  component: AuthPage,
});


function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;

        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          setIsSignUp(false);
          setSuccessMessage("Account created successfully! Please sign in with your credentials.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) throw error;

        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
        navigate({ to: roles?.length ? "/admin" : "/dashboard" });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid login credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || "Google sign in failed.");
      setGoogleLoading(false);
    }
  };

  return (
    <SiteLayout>
      <div className="relative flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 -z-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-secondary/50 p-2 shadow-sm">
              <img
                src="/CCS logo.jpeg"
                alt="Career Consultant Services"
                className="h-full w-full rounded-md object-contain"
              />
            </div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-primary">
              {isSignUp ? "Learner Registration" : "Welcome Back"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSignUp
                ? "Sign up to begin submitting your documents and tracking applications"
                : "Sign in to access your student portal or admin dashboard"}
            </p>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-xs font-medium text-emerald-700">
              {successMessage}
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold tracking-wide text-foreground shadow-sm transition-all hover:bg-secondary hover:border-primary/30 active:scale-[0.98] disabled:opacity-60"
              style={{ fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif" }}
            >
              <svg className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
              <span>{googleLoading ? "Connecting..." : "Continue with Google"}</span>
            </button>

            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full border-t border-border" />
              <span className="absolute bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                or with email
              </span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="relative">
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder=" "
                  className="peer w-full rounded-xl border border-input bg-background px-4 pb-2.5 pt-5 text-sm text-foreground placeholder-transparent outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <label
                  htmlFor="fullName"
                  className="pointer-events-none absolute left-4 top-1.5 z-10 origin-[0] scale-75 text-xs font-semibold uppercase tracking-wider text-primary transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:normal-case peer-placeholder-shown:text-muted-foreground peer-focus:top-1.5 peer-focus:scale-75 peer-focus:uppercase peer-focus:text-primary"
                >
                  Full Name
                </label>
              </div>
            )}

            <div className="relative">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="peer w-full rounded-xl border border-input bg-background px-4 pb-2.5 pt-5 text-sm text-foreground placeholder-transparent outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <label
                htmlFor="email"
                className="pointer-events-none absolute left-4 top-1.5 z-10 origin-[0] scale-75 text-xs font-semibold uppercase tracking-wider text-primary transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:normal-case peer-placeholder-shown:text-muted-foreground peer-focus:top-1.5 peer-focus:scale-75 peer-focus:uppercase peer-focus:text-primary"
              >
                Email Address
              </label>
            </div>

            <div className="relative">
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                className="peer w-full rounded-xl border border-input bg-background px-4 pb-2.5 pt-5 text-sm text-foreground placeholder-transparent outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <label
                htmlFor="password"
                className="pointer-events-none absolute left-4 top-1.5 z-10 origin-[0] scale-75 text-xs font-semibold uppercase tracking-wider text-primary transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:normal-case peer-placeholder-shown:text-muted-foreground peer-focus:top-1.5 peer-focus:scale-75 peer-focus:uppercase peer-focus:text-primary"
              >
                Password
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl py-6 font-display font-semibold uppercase tracking-wide shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? "Processing..." : isSignUp ? "Create Student Account" : "Sign In to Portal"}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center text-xs">
            <button
              type="button"
              className="font-medium text-muted-foreground transition-colors hover:text-primary underline underline-offset-4"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              {isSignUp
                ? "Already registered? Sign in here"
                : "New student? Enroll & create an account"}
            </button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}