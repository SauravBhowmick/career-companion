import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  MessageSquare,
  Award,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useJobApplications, JobApplication } from "@/hooks/useJobApplications";
import { AuthModal } from "@/components/AuthModal";
import { format } from "date-fns";

const statusConfig = {
  applied: {
    label: "Applied",
    icon: Clock,
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
    iconColor: "text-blue-500",
  },
  viewed: {
    label: "Viewed",
    icon: CheckCircle,
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
    iconColor: "text-purple-500",
  },
  interview: {
    label: "Interview",
    icon: MessageSquare,
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
    iconColor: "text-amber-500",
  },
  offer: {
    label: "Offer",
    icon: Award,
    color: "bg-green-500/10 text-green-600 border-green-200",
    iconColor: "text-green-500",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "bg-red-500/10 text-red-600 border-red-200",
    iconColor: "text-red-500",
  },
};

type StatusFilter = "all" | JobApplication["status"];

const Applications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { applications, loading, updateApplicationStatus } = useJobApplications();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const filteredApplications = applications.filter(
    (app) => statusFilter === "all" || app.status === statusFilter
  );

  const stats = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer: applications.filter((a) => a.status === "offer").length,
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Sign in to view applications</h2>
          <p className="text-muted-foreground mb-4">
            Track all your job applications in one place
          </p>
          <Button onClick={() => setIsAuthOpen(true)}>Sign In</Button>
        </Card>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold">My Applications</h1>
            <p className="text-sm text-muted-foreground">Track your job application progress</p>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Applications</p>
            <p className="text-3xl font-bold text-primary">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-3xl font-bold text-blue-500">{stats.applied}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Interviews</p>
            <p className="text-3xl font-bold text-amber-500">{stats.interview}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Offers</p>
            <p className="text-3xl font-bold text-green-500">{stats.offer}</p>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-6">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Applications</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="offer">Offer</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredApplications.length === 0 ? (
          <Card className="p-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {statusFilter === "all" ? "No applications yet" : `No ${statusFilter} applications`}
            </h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter === "all"
                ? "Start applying to jobs to track them here"
                : "Try changing the filter to see more applications"}
            </p>
            {statusFilter === "all" && (
              <Button onClick={() => navigate("/")}>Browse Jobs</Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((application, index) => {
              const status = statusConfig[application.status];
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={application.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Job Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${status.color}`}>
                            <StatusIcon className={`h-5 w-5 ${status.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{application.job_title}</h3>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {application.company}
                              </span>
                              {application.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {application.location}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(new Date(application.applied_at), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="secondary" className={status.color}>
                            {status.label}
                          </Badge>
                          {application.job_type && (
                            <Badge variant="outline">{application.job_type}</Badge>
                          )}
                          {application.salary_range && (
                            <Badge variant="outline">{application.salary_range}</Badge>
                          )}
                          {application.match_score && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              {application.match_score}% Match
                            </Badge>
                          )}
                          {application.auto_applied && (
                            <Badge variant="outline" className="bg-accent/50">
                              Auto-Applied
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Status Update */}
                      <div className="flex items-center gap-2">
                        <Select
                          value={application.status}
                          onValueChange={(value) =>
                            updateApplicationStatus(application.id, value as JobApplication["status"])
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="viewed">Viewed</SelectItem>
                            <SelectItem value="interview">Interview</SelectItem>
                            <SelectItem value="offer">Offer</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Applications;
