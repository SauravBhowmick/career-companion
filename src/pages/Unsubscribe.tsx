import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailX, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "success" | "error" | "missing";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("missing");
      setMessage("");
      return;
    }

    setStatus("loading");
    setMessage("");

    let cancelled = false;

    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("unsubscribe", {
          body: { token },
        });

        if (cancelled) return;

        if (error) {
          // Prefer the function's JSON body when available
          let detail = error.message;
          try {
            const res = (error as any).context;
            if (res && typeof res.json === "function") {
              const body = await res.json();
              if (body?.error) detail = body.error;
            }
          } catch {
            // keep generic message
          }
          setStatus("error");
          setMessage(detail || "Something went wrong. Please try again from Settings.");
          return;
        }

        if (data?.error) {
          setStatus("error");
          setMessage(data.error);
          return;
        }

        setStatus("success");
        setMessage(
          data?.message ||
            "You have been unsubscribed from JobFlow job alerts and digest emails."
        );
      } catch (err: any) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err?.message || "Failed to unsubscribe. Please try again.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">JobFlow</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center"
        >
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <h1 className="font-display text-xl font-semibold">Unsubscribing…</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Please wait while we update your email preferences.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h1 className="font-display text-xl font-semibold">You're unsubscribed</h1>
              <p className="text-muted-foreground mt-2 text-sm">{message}</p>
              <p className="text-muted-foreground mt-3 text-xs">
                You can turn emails back on anytime in Settings after signing in.
              </p>
              <Button asChild className="mt-6" variant="hero">
                <Link to="/">Back to JobFlow</Link>
              </Button>
            </>
          )}

          {status === "missing" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MailX className="h-8 w-8 text-muted-foreground" />
              </div>
              <h1 className="font-display text-xl font-semibold">Missing unsubscribe link</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Open the unsubscribe link from your email, or sign in and disable email
                notifications in Settings.
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link to="/">Go to JobFlow</Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="font-display text-xl font-semibold">Couldn't unsubscribe</h1>
              <p className="text-muted-foreground mt-2 text-sm">{message}</p>
              <p className="text-muted-foreground mt-3 text-xs">
                The link may have expired. Sign in and turn off email alerts in Settings.
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link to="/">Go to JobFlow</Link>
              </Button>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
