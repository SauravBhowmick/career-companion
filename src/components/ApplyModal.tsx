import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Sparkles, Building2, MapPin, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Job } from "@/types/job";
import { useState } from "react";

interface ApplyModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (autoApplySimilar: boolean) => void;
}

export function ApplyModal({ job, isOpen, onClose, onConfirm }: ApplyModalProps) {
  const [autoApplySimilar, setAutoApplySimilar] = useState(true);
  const [isApplied, setIsApplied] = useState(false);

  const handleApply = () => {
    setIsApplied(true);
    setTimeout(() => {
      onConfirm(autoApplySimilar);
      setIsApplied(false);
    }, 1500);
  };

  if (!job) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl"
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
                <h3 className="font-display text-xl font-semibold">Application Sent!</h3>
                <p className="mt-2 text-muted-foreground">
                  {autoApplySimilar
                    ? "We'll auto-apply to similar roles for you."
                    : "Good luck with your application!"}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold">Apply to Position</h2>
                  <Button variant="ghost" size="icon" onClick={onClose}>
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
                          <Badge variant="outline" className="text-xs">
                            +{job.tags.length - 3} more
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button variant="hero" className="flex-1" onClick={handleApply}>
                      Apply Now
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
