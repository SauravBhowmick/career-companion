import { motion } from "framer-motion";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface JobFiltersProps {
  filters: {
    jobTypes: string[];
    minMatchScore: number;
    locations: string[];
  };
  onFilterChange: (filters: any) => void;
}

const JOB_TYPES = ["Remote", "Full-time", "Part-time", "Contract", "Hybrid"];
const LOCATIONS = ["San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA", "Remote"];

export function JobFilters({ filters, onFilterChange }: JobFiltersProps) {
  const handleJobTypeChange = (type: string, checked: boolean) => {
    const newTypes = checked
      ? [...filters.jobTypes, type]
      : filters.jobTypes.filter((t) => t !== type);
    onFilterChange({ ...filters, jobTypes: newTypes });
  };

  const handleLocationChange = (location: string, checked: boolean) => {
    const newLocations = checked
      ? [...filters.locations, location]
      : filters.locations.filter((l) => l !== location);
    onFilterChange({ ...filters, locations: newLocations });
  };

  const clearFilters = () => {
    onFilterChange({ jobTypes: [], minMatchScore: 0, locations: [] });
  };

  const activeFiltersCount = filters.jobTypes.length + filters.locations.length + (filters.minMatchScore > 0 ? 1 : 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold">Filters</h2>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Job Type</h3>
          <div className="space-y-2">
            {JOB_TYPES.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={type}
                  checked={filters.jobTypes.includes(type)}
                  onCheckedChange={(checked) => handleJobTypeChange(type, checked as boolean)}
                />
                <Label htmlFor={type} className="text-sm font-normal cursor-pointer">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-sm font-medium mb-3">Match Score</h3>
          <div className="px-2">
            <Slider
              value={[filters.minMatchScore]}
              onValueChange={([value]) => onFilterChange({ ...filters, minMatchScore: value })}
              max={100}
              step={5}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Any</span>
              <span className="font-medium text-primary">{filters.minMatchScore}%+</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-sm font-medium mb-3">Location</h3>
          <div className="space-y-2">
            {LOCATIONS.map((location) => (
              <div key={location} className="flex items-center space-x-2">
                <Checkbox
                  id={location}
                  checked={filters.locations.includes(location)}
                  onCheckedChange={(checked) => handleLocationChange(location, checked as boolean)}
                />
                <Label htmlFor={location} className="text-sm font-normal cursor-pointer">
                  {location}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
