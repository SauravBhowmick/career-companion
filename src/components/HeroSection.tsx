import { motion } from "framer-motion";
import { Search, Sparkles, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function HeroSection({ searchQuery, onSearchChange }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden gradient-hero py-20 lg:py-28">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-2 text-sm text-primary-foreground"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI-powered job matching & auto-apply</span>
          </motion.div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
            Find Your Dream Job,
            <br />
            <span className="text-accent">Automatically</span>
          </h1>

          <p className="mt-6 text-lg text-primary-foreground/70">
            Upload your CV once, set your preferences, and let our AI apply to matching jobs for you.
            Get notified instantly when new opportunities arise.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search jobs, companies, or skills..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-14 pl-12 pr-4 text-base bg-background/95 border-0 shadow-xl"
              />
            </div>
            <Button variant="accent" size="xl" className="shrink-0">
              <TrendingUp className="h-5 w-5 mr-2" />
              Find Jobs
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-primary-foreground/60"
          >
            <span>Popular:</span>
            {["React", "Remote", "Senior", "Full Stack"].map((tag) => (
              <button
                key={tag}
                onClick={() => onSearchChange(tag)}
                className="rounded-full border border-primary-foreground/20 px-3 py-1 hover:bg-primary-foreground/10 transition-colors"
              >
                {tag}
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
