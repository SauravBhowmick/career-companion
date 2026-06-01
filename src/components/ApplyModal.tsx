import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Sparkles, Building2, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Job } from "@/types/job";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface ApplyModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (job: Job, autoApplySimilar: boolean) => void;
}

export function ApplyModal({ job, isOpen, onClose, onConfirm }: ApplyModalProps) {
  const [autoApplySimilar, setAutoApplySimilar] = useState(true);
  const [isApplied, setIsApplied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [formData, setFormData] = useState({
    phone: "",
    coverLetter: "",
  });
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending auto-close timer on unmount so it can't fire late.
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const resetAndClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsApplied(false);
    setIsLoading(false);
    setFormData({ phone: "", coverLetter: "" });
    onClose();
  };

  const handleApply = async () => {
    if (!job) return;
    if (!formData.phone) {
      toast.error("Please provide your phone number");
      return;
    }

    // Capture the job up front so the recorded application never depends on
    // parent state that may be cleared while the success view animates.
    const appliedJob = job;
    setIsLoading(true);

    // The confirmation email is best-effort — it must NOT block recording the
    // application. If the email service is unavailable (e.g. RESEND_API_KEY not
    // configured), the application is still submitted.
    let sent = false;
    let failReason = "";
    let failStatus: number | undefined;
    let failRaw = "";
    let originalError: unknown;
    try {
      const { data, error } = await supabase.functions.invoke("send-application-email", {
        body: {
          jobTitle: appliedJob.title,
          company: appliedJob.company,
          applicantPhone: formData.phone,
          coverLetter: formData.coverLetter,
        },
      });

      if (error) {
        originalError = error;
        // FunctionsHttpError carries the function's actual Response on
        // error.context; the top-level error.message is only a generic
        // "non-2xx status" string.
        if (error instanceof FunctionsHttpError) {
          failStatus = error.context.status;
          // Read the body once as text, then attempt JSON — non-JSON bodies
          // (e.g. plain-text gateway errors) would otherwise be lost.
          failRaw = await error.context.text().catch(() => "");
          try {
            const body = JSON.parse(failRaw);
            failReason = body?.error || body?.message || "";
          } catch {
            failReason = failRaw;
          }
        }
        if (!failReason) failReason = error.message || "Unknown error";
      } else if (data?.error) {
        failReason = data.error;
      } else {
        sent = true;
      }
    } catch (err: any) {
      originalError = err;
      failReason = err?.message || "Network error";
    }

    if (!sent) {
      console.warn(
        `Confirmation email not sent${failStatus ? ` (HTTP ${failStatus})` : ""}: ${failReason}`,
        { raw: failRaw.substring(0, 500), error: originalError }
      );
    }

    // Record the application immediately — closing the modal can no longer drop it.
    onConfirm(appliedJob, autoApplySimilar);

    setEmailSent(sent);
    setIsLoading(false);
    setIsApplied(true);
    if (sent) {
      toast.success("Application sent! Check your email for confirmation.");
    } else {
      toast.warning("Application recorded — confirmation email could not be sent.");
    }

    // Auto-close the success view after the animation; safe to clear on early close.
    closeTimeoutRef.current = setTimeout(resetAndClose, 1500);
  };

  if (!job) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            {isApplied ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success"
                >
                  <CheckCircle className="h-10 w-10 text-success-foreground" />
                </motion.div>
                <h3 className="font-display text-xl font-semibold">
                  {emailSent ? "Application Sent!" : "Application Submitted!"}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {emailSent
                    ? "A confirmation email has been sent to your account email."
                    : "Your application has been recorded."}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {autoApplySimilar
                    ? "We'll auto-apply to similar roles for you."
                    : "Good luck with your application!"}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold">Apply to Position</h2>
                  <Button variant="ghost" size="icon" onClick={resetAndClose}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Job Summary */}
                  <div className="flex gap-4 p-4 rounded-xl bg-muted/50">
                    <img
                      src={job.companyLogo}
                      alt={job.company}
                      className="h-14 w-14 rounded-xl object-cover shadow-md"
                    />
                    <div>
                      <h3 className="font-display font-semibold">{job.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-4 w-4" />
                        <span>{job.company}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center gap-1 text-success">
                          <DollarSign className="h-3 w-3" />
                          <span>{job.salary}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Application Form */}
                  <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Phone Number</label>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Cover Letter (Optional)</label>
                      <Textarea
                        placeholder="Tell the company why you're interested in this role..."
                        value={formData.coverLetter}
                        onChange={(e) =>
                          setFormData({ ...formData, coverLetter: e.target.value })
                        }
                        disabled={isLoading}
                        className="min-h-[120px] resize-none"
                      />
                    </div>
                  </div>

                  {/* Auto-apply toggle */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAutoApplySimilar(!autoApplySimilar)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-colors ${
                      autoApplySimilar
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${autoApplySimilar ? "gradient-primary" : "bg-muted"}`}>
                        <Sparkles className={`h-5 w-5 ${autoApplySimilar ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="font-medium">Auto-apply to similar roles</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Let AI find and apply to similar {job.title} positions automatically
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {job.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {job.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{job.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={resetAndClose} disabled={isLoading}>
                      Cancel
                    </Button>
                    <Button variant="hero" className="flex-1" onClick={handleApply} disabled={isLoading}>
                      {isLoading ? "Sending..." : "Apply Now"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}