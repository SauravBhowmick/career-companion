import { motion } from "framer-motion";
import { Briefcase, CheckCircle, Clock, Zap } from "lucide-react";

interface StatsBarProps {
  stats: {
    matched: number;
    autoApplied: number;
    pending: number;
    interviews: number;
  };
}

export function StatsBar({ stats }: StatsBarProps) {
  const statItems = [
    { icon: Briefcase, label: "Jobs Matched", value: stats.matched.toString(), color: "text-primary" },
    { icon: Zap, label: "Auto-Applied", value: stats.autoApplied.toString(), color: "text-accent" },
    { icon: Clock, label: "Pending", value: stats.pending.toString(), color: "text-muted-foreground" },
    { icon: CheckCircle, label: "Interviews", value: stats.interviews.toString(), color: "text-success" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="container py-6"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
