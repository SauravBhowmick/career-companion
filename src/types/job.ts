export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  location: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Remote' | 'Hybrid';
  salary: string;
  description: string;
  requirements: string[];
  tags: string[];
  postedAt: string;
  website?: string;
  source?: string;
  isNew?: boolean;
  isFeatured?: boolean;
  matchScore?: number;
  matchReason?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  title: string;
  skills: string[];
  experience: string;
  preferredRoles: string[];
  preferredLocations: string[];
  cvUrl?: string;
}

export interface ApplicationPreferences {
  autoApply: boolean;
  emailNotifications: boolean;
  matchThreshold: number;
  preferredJobTypes: string[];
}