import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Loader2, Sparkles } from "lucide-react";
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
import { useRealJobs } from "@/hooks/useRealJobs";
import { useJobMatcher } from "@/hooks/useJobMatcher";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Index = () => {
  const { user } = useAuth();
  const { applyToJob, saveJob, isJobSaved, applications } = useJobApplications();
  const { jobs: realJobs, loading: loadingRealJobs, fetchJobs } = useRealJobs();
  const { matchJobs, matching } = useJobMatcher();
  const [matchedJobs, setMatchedJobs] = useState<Job[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [useRealData, setUseRealData] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [filters, setFilters] = useState({
    jobTypes: [] as string[],
    minMatchScore: 0,
    locations: [] as string[],
  });

  // Fetch real jobs when search changes (debounced)
  useEffect(() => {
    if (!useRealData) return;
    
    const timeoutId = setTimeout(() => {
      fetchJobs({
        query: searchQuery || 'software developer',
        location: filters.locations[0],
        jobType: filters.jobTypes[0],
      });
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, useRealData, filters.locations, filters.jobTypes, fetchJobs]);

  // Run AI matching when jobs change or user logs in
  useEffect(() => {
    const runMatching = async () => {
      const jobsToMatch = useRealData ? realJobs : mockJobs;
      if (user && jobsToMatch.length > 0) {
        const matched = await matchJobs(jobsToMatch);
        setMatchedJobs(matched);
      } else {
        setMatchedJobs(jobsToMatch);
      }
    };
    runMatching();
  }, [user, realJobs, useRealData, matchJobs]);

  const handleFetchRealJobs = () => {
    setUseRealData(true);
    fetchJobs({
      query: searchQuery || 'software developer',
      location: filters.locations[0],
      jobType: filters.jobTypes[0],
    });
  };

  const handleRefreshMatching = async () => {
    if (!user) {
      toast.info("Please sign in to get personalized match scores");
      setIsAuthOpen(true);
      return;
    }
    const jobsToMatch = useRealData ? realJobs : mockJobs;
    const matched = await matchJobs(jobsToMatch);
    setMatchedJobs(matched);
    toast.success("Match scores updated based on your profile!");
  };

  const activeJobs = matchedJobs.length > 0 ? matchedJobs : (useRealData ? realJobs : mockJobs);
  const filteredJobs = useMemo(() => {
    return activeJobs.filter((job) => {
      // Search filter (only for mock data, real data is already filtered)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        useRealData || !searchQuery ||
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
  }, [searchQuery, filters, activeJobs, useRealData]);

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
    matched: activeJobs.length,
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
                  {useRealData ? "Live Job Results" : searchQuery ? `Results for "${searchQuery}"` : "Recommended for You"}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {filteredJobs.length} jobs found {useRealData && "• Powered by Firecrawl"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshMatching}
                  disabled={matching}
                  className="flex items-center gap-2"
                >
                  {matching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {matching ? "Matching..." : "AI Match"}
                </Button>
                <Button
                  variant={useRealData ? "outline" : "default"}
                  size="sm"
                  onClick={handleFetchRealJobs}
                  disabled={loadingRealJobs}
                  className="flex items-center gap-2"
                >
                  {loadingRealJobs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {useRealData ? "Refresh" : "Fetch Real Jobs"}
                </Button>
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
