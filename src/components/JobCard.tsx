import { motion } from "framer-motion";
import { Bookmark, Clock, MapPin, Building2, DollarSign, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Job } from "@/types/job";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: Job;
  index: number;
  onApply: (job: Job) => void;
  onSave: (job: Job) => void;
  isSaved?: boolean;
}

export function JobCard({ job, index, onApply, onSave, isSaved }: JobCardProps) {
  const getMatchColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 75) return "text-primary";
    if (score >= 60) return "text-accent";
    return "text-muted-foreground";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg",
        job.isFeatured && "border-primary/50 shadow-glow"
      )}
    >
      {job.isFeatured && (
        <div className="absolute top-0 right-0">
          <div className="gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground rounded-bl-lg">
            Featured
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <img
          src={job.companyLogo}
          alt={job.company}
          className="h-14 w-14 rounded-xl object-cover shadow-md"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{job.company}</span>
              </div>
            </div>

            {job.matchScore && (
              <div className="flex flex-col items-end">
                <div className={cn("flex items-center gap-1 text-sm font-semibold", getMatchColor(job.matchScore))}>
                  <Zap className="h-4 w-4" />
                  <span>{job.matchScore}%</span>
                </div>
                <span className="text-xs text-muted-foreground">match</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{job.location}</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {job.type}
            </Badge>
            <div className="flex items-center gap-1 text-success font-medium">
              <DollarSign className="h-4 w-4" />
              <span>{job.salary}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {job.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{job.postedAt}</span>
              {job.isNew && (
                <Badge className="ml-2 gradient-accent text-accent-foreground text-xs">
                  New
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSave(job)}
                className={cn(isSaved && "text-accent")}
              >
                <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
              </Button>
              <Button variant="hero" size="sm" onClick={() => onApply(job)}>
                Quick Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
