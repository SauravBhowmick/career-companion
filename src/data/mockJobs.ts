import { Job } from "@/types/job";

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Senior Frontend Developer",
    company: "TechFlow Inc.",
    companyLogo: "https://ui-avatars.com/api/?name=TF&background=3b82f6&color=fff&size=80",
    location: "San Francisco, CA",
    type: "Remote",
    salary: "$140,000 - $180,000",
    description: "We're looking for a Senior Frontend Developer to join our team and help build the next generation of our product. You'll work with React, TypeScript, and modern web technologies.",
    requirements: [
      "5+ years of frontend development experience",
      "Expert in React and TypeScript",
      "Experience with state management (Redux, Zustand)",
      "Strong understanding of web performance optimization"
    ],
    tags: ["React", "TypeScript", "Tailwind CSS", "Next.js"],
    postedAt: "2 hours ago",
    isNew: true,
    isFeatured: true,
    matchScore: 95
  },
  {
    id: "2",
    title: "Full Stack Engineer",
    company: "DataDrive",
    companyLogo: "https://ui-avatars.com/api/?name=DD&background=10b981&color=fff&size=80",
    location: "New York, NY",
    type: "Hybrid",
    salary: "$130,000 - $160,000",
    description: "Join our engineering team to build scalable data solutions. You'll work across the stack with Node.js, React, and PostgreSQL.",
    requirements: [
      "4+ years of full stack development",
      "Experience with Node.js and Express",
      "Proficiency in SQL databases",
      "Knowledge of cloud services (AWS/GCP)"
    ],
    tags: ["Node.js", "React", "PostgreSQL", "AWS"],
    postedAt: "5 hours ago",
    isNew: true,
    matchScore: 88
  },
  {
    id: "3",
    title: "React Native Developer",
    company: "MobileFirst",
    companyLogo: "https://ui-avatars.com/api/?name=MF&background=8b5cf6&color=fff&size=80",
    location: "Austin, TX",
    type: "Full-time",
    salary: "$120,000 - $150,000",
    description: "Build beautiful mobile applications for iOS and Android using React Native. Join a team passionate about mobile UX.",
    requirements: [
      "3+ years of React Native experience",
      "Published apps on App Store/Play Store",
      "Experience with native modules",
      "Understanding of mobile design patterns"
    ],
    tags: ["React Native", "iOS", "Android", "TypeScript"],
    postedAt: "1 day ago",
    matchScore: 82
  },
  {
    id: "4",
    title: "Backend Engineer",
    company: "CloudScale",
    companyLogo: "https://ui-avatars.com/api/?name=CS&background=f59e0b&color=fff&size=80",
    location: "Seattle, WA",
    type: "Remote",
    salary: "$150,000 - $190,000",
    description: "Design and build high-performance backend systems. Work with microservices, Kubernetes, and modern DevOps practices.",
    requirements: [
      "5+ years of backend development",
      "Experience with Go or Rust",
      "Strong knowledge of distributed systems",
      "Experience with container orchestration"
    ],
    tags: ["Go", "Kubernetes", "gRPC", "Redis"],
    postedAt: "2 days ago",
    isFeatured: true,
    matchScore: 75
  },
  {
    id: "5",
    title: "UI/UX Designer & Developer",
    company: "DesignLab",
    companyLogo: "https://ui-avatars.com/api/?name=DL&background=ec4899&color=fff&size=80",
    location: "Los Angeles, CA",
    type: "Hybrid",
    salary: "$100,000 - $130,000",
    description: "Blend design and development skills to create stunning user experiences. Work closely with product and engineering teams.",
    requirements: [
      "3+ years of UI/UX design experience",
      "Proficiency in Figma and design systems",
      "Frontend development skills (React preferred)",
      "Strong portfolio showcasing web/mobile projects"
    ],
    tags: ["Figma", "React", "CSS", "Design Systems"],
    postedAt: "3 days ago",
    matchScore: 70
  },
  {
    id: "6",
    title: "DevOps Engineer",
    company: "InfraStack",
    companyLogo: "https://ui-avatars.com/api/?name=IS&background=06b6d4&color=fff&size=80",
    location: "Denver, CO",
    type: "Remote",
    salary: "$135,000 - $165,000",
    description: "Build and maintain cloud infrastructure at scale. Implement CI/CD pipelines and ensure system reliability.",
    requirements: [
      "4+ years of DevOps experience",
      "Expert in AWS or GCP",
      "Experience with Terraform and IaC",
      "Strong scripting skills (Python, Bash)"
    ],
    tags: ["AWS", "Terraform", "Docker", "CI/CD"],
    postedAt: "4 days ago",
    matchScore: 65
  }
];
