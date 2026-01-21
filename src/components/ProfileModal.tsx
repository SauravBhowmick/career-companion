import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, User, Mail, Briefcase, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [skills, setSkills] = useState(["React", "TypeScript", "Node.js", "Python"]);
  const [newSkill, setNewSkill] = useState("");
  const [cvUploaded, setCvUploaded] = useState(false);

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold">Your Profile</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* CV Upload */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  cvUploaded ? "border-success bg-success/5" : "border-border hover:border-primary"
                }`}
                onClick={() => setCvUploaded(true)}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 ${cvUploaded ? "text-success" : "text-muted-foreground"}`} />
                <p className="font-medium">{cvUploaded ? "CV Uploaded!" : "Upload your CV"}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {cvUploaded ? "resume_2024.pdf" : "PDF, DOC, or DOCX (max 5MB)"}
                </p>
              </div>

              {/* Basic Info */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </Label>
                  <Input id="name" placeholder="John Doe" defaultValue="John Doe" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input id="email" type="email" placeholder="john@example.com" defaultValue="john@example.com" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="title" className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Current Title
                  </Label>
                  <Input id="title" placeholder="Senior Developer" defaultValue="Senior Frontend Developer" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Preferred Location
                  </Label>
                  <Input id="location" placeholder="San Francisco, CA" defaultValue="Remote" />
                </div>
              </div>

              {/* Skills */}
              <div className="grid gap-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      onClick={() => removeSkill(skill)}
                    >
                      {skill}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  />
                  <Button variant="outline" size="icon" onClick={addSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button variant="hero" className="w-full" size="lg">
                Save Profile
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
