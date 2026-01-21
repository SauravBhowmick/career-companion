import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { StatsBar } from "@/components/StatsBar";
import { JobCard } from "@/components/JobCard";
import { JobFilters } from "@/components/JobFilters";
import { ProfileModal } from "@/components/ProfileModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ApplyModal } from "@/components/ApplyModal";
import { AuthModal } from "@/components/AuthModal";
import { mockJobs } from "@/data/mockJobs";
import { Job } from "@/types/job";
import { useAuth } from "@/hooks/useAuth";
import { useJobApplications } from "@/hooks/useJobApplications";
import { toast } from "sonner";

const Index = () => {
  const { user } = useAuth();
  const { applyToJob, saveJob, isJobSaved, applications } = useJobApplications();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [filters, setFilters] = useState({
    jobTypes: [] as string[],
    minMatchScore: 0,
    locations: [] as string[],
  });

  const filteredJobs = useMemo(() => {
    return mockJobs.filter((job) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        job.title.toLowerCase().includes(searchLower) ||
        job.company.toLowerCase().includes(searchLower) ||
        job.tags.some((tag) => tag.toLowerCase().includes(searchLower));

      // Job type filter
      const matchesType =
        filters.jobTypes.length === 0 || filters.jobTypes.includes(job.type);

      // Match score filter
      const matchesScore =
        !job.matchScore || job.matchScore >= filters.minMatchScore;

      // Location filter
      const matchesLocation =
        filters.locations.length === 0 ||
        filters.locations.some((loc) => job.location.includes(loc) || loc === "Remote" && job.type === "Remote");

      return matchesSearch && matchesType && matchesScore && matchesLocation;
    });
  }, [searchQuery, filters]);

  const handleApply = (job: Job) => {
    if (!user) {
      toast.info("Please sign in to apply for jobs");
      setIsAuthOpen(true);
      return;
    }
    setApplyJob(job);
  };

  const handleSave = (job: Job) => {
    if (!user) {
      toast.info("Please sign in to save jobs");
      setIsAuthOpen(true);
      return;
    }
    saveJob(job);
  };

  const handleApplyConfirm = (autoApplySimilar: boolean) => {
    if (applyJob) {
      applyToJob(applyJob, autoApplySimilar);
    }
    setApplyJob(null);
  };

  const stats = {
    matched: mockJobs.length,
    autoApplied: applications.filter(a => a.auto_applied).length,
    pending: applications.filter(a => a.status === "applied" || a.status === "viewed").length,
    interviews: applications.filter(a => a.status === "interview").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        onOpenProfile={() => {
          if (!user) {
            toast.info("Please sign in to view your profile");
            setIsAuthOpen(true);
            return;
          }
          setIsProfileOpen(true);
        }}
        onOpenSettings={() => {
          if (!user) {
            toast.info("Please sign in to access settings");
            setIsAuthOpen(true);
            return;
          }
          setIsSettingsOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <HeroSection searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      
      <StatsBar stats={stats} />

      <main className="container pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <JobFilters filters={filters} onFilterChange={setFilters} />
            </div>
          </aside>

          {/* Job Listings */}
          <section className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  {searchQuery ? `Results for "${searchQuery}"` : "Recommended for You"}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {filteredJobs.length} jobs found
                </p>
              </div>
            </div>

            {filteredJobs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-lg text-muted-foreground">
                  No jobs match your criteria. Try adjusting your filters.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job, index) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={index}
                    onApply={handleApply}
                    onSave={handleSave}
                    isSaved={isJobSaved(job.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {}}
      />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ApplyModal
        job={applyJob}
        isOpen={!!applyJob}
        onClose={() => setApplyJob(null)}
        onConfirm={handleApplyConfirm}
      />
    </div>
  );
};

export default Index;
