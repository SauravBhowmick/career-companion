import { motion, AnimatePresence } from "framer-motion";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface JobFiltersProps {
  filters: {
    jobTypes: string[];
    minMatchScore: number;
    locations: string[];
  };
  onFilterChange: (filters: any) => void;
}

const JOB_TYPES = ["Remote", "Full-time", "Part-time", "Contract", "Hybrid"];

interface LocationGroup {
  region: string;
  locations: string[];
}

const LOCATION_GROUPS: LocationGroup[] = [
  {
    region: "Global",
    locations: ["Remote"],
  },
  {
    region: "United States",
    locations: [
      "San Francisco, CA",
      "New York, NY",
      "Austin, TX",
      "Seattle, WA",
      "Los Angeles, CA",
      "Boston, MA",
      "Chicago, IL",
      "Denver, CO",
    ],
  },
  {
    region: "EU — Germany",
    locations: ["Berlin, Germany", "Munich, Germany", "Frankfurt, Germany", "Hamburg, Germany"],
  },
  {
    region: "EU — France",
    locations: ["Paris, France", "Lyon, France", "Toulouse, France"],
  },
  {
    region: "EU — Netherlands",
    locations: ["Amsterdam, Netherlands", "Rotterdam, Netherlands", "Eindhoven, Netherlands"],
  },
  {
    region: "EU — Ireland",
    locations: ["Dublin, Ireland", "Cork, Ireland"],
  },
  {
    region: "EU — Spain",
    locations: ["Madrid, Spain", "Barcelona, Spain", "Valencia, Spain"],
  },
  {
    region: "EU — Italy",
    locations: ["Milan, Italy", "Rome, Italy", "Turin, Italy"],
  },
  {
    region: "EU — Sweden",
    locations: ["Stockholm, Sweden", "Gothenburg, Sweden"],
  },
  {
    region: "EU — Denmark",
    locations: ["Copenhagen, Denmark"],
  },
  {
    region: "EU — Finland",
    locations: ["Helsinki, Finland", "Espoo, Finland"],
  },
  {
    region: "EU — Poland",
    locations: ["Warsaw, Poland", "Krakow, Poland", "Wroclaw, Poland"],
  },
  {
    region: "EU — Portugal",
    locations: ["Lisbon, Portugal", "Porto, Portugal"],
  },
  {
    region: "EU — Belgium",
    locations: ["Brussels, Belgium", "Antwerp, Belgium"],
  },
  {
    region: "EU — Austria",
    locations: ["Vienna, Austria", "Graz, Austria"],
  },
  {
    region: "EU — Czech Republic",
    locations: ["Prague, Czech Republic", "Brno, Czech Republic"],
  },
  {
    region: "EU — Romania",
    locations: ["Bucharest, Romania", "Cluj-Napoca, Romania"],
  },
  {
    region: "EU — Hungary",
    locations: ["Budapest, Hungary"],
  },
  {
    region: "EU — Luxembourg",
    locations: ["Luxembourg City, Luxembourg"],
  },
  {
    region: "EU — Estonia",
    locations: ["Tallinn, Estonia"],
  },
  {
    region: "EU — Latvia",
    locations: ["Riga, Latvia"],
  },
  {
    region: "EU — Lithuania",
    locations: ["Vilnius, Lithuania"],
  },
  {
    region: "EU — Greece",
    locations: ["Athens, Greece", "Thessaloniki, Greece"],
  },
  {
    region: "EU — Croatia",
    locations: ["Zagreb, Croatia"],
  },
  {
    region: "EU — Slovenia",
    locations: ["Ljubljana, Slovenia"],
  },
  {
    region: "EU — Slovakia",
    locations: ["Bratislava, Slovakia"],
  },
  {
    region: "EU — Bulgaria",
    locations: ["Sofia, Bulgaria"],
  },
  {
    region: "EU — Cyprus",
    locations: ["Nicosia, Cyprus", "Limassol, Cyprus"],
  },
  {
    region: "EU — Malta",
    locations: ["Valletta, Malta"],
  },
];

export function JobFilters({ filters, onFilterChange }: JobFiltersProps) {
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({
    Global: true,
    "United States": true,
  });

  const toggleRegion = (region: string) => {
    setExpandedRegions((prev) => ({ ...prev, [region]: !prev[region] }));
  };

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

  const selectedCountInGroup = (group: LocationGroup) =>
    group.locations.filter((l) => filters.locations.includes(l)).length;

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
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {LOCATION_GROUPS.map((group) => {
              const isExpanded = !!expandedRegions[group.region];
              const count = selectedCountInGroup(group);
              return (
                <div key={group.region}>
                  <button
                    type="button"
                    onClick={() => toggleRegion(group.region)}
                    className="flex w-full items-center justify-between py-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors rounded"
                  >
                    <span className="flex items-center gap-1.5">
                      {group.region}
                      {count > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {count}
                        </Badge>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5 pb-2 pl-1">
                          {group.locations.map((location) => (
                            <div key={location} className="flex items-center space-x-2">
                              <Checkbox
                                id={location}
                                checked={filters.locations.includes(location)}
                                onCheckedChange={(checked) =>
                                  handleLocationChange(location, checked as boolean)
                                }
                              />
                              <Label
                                htmlFor={location}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {location}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
