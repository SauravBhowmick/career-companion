import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, User, Mail, Briefcase, MapPin, Plus, Loader2, FileText, Trash2, CheckCircle, Sparkles, History, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useCVParser } from "@/hooks/useCVParser";
import { useCVHistory } from "@/hooks/useCVHistory";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user } = useAuth();
  const { profile, skills, loading, updateProfile, addSkill, removeSkill, refetch } = useProfile();
  const { parseAndNotify } = useCVParser();
  const { history, addHistoryRecord, updateParsingStatus, refetch: refetchHistory } = useCVHistory();
  const [newSkill, setNewSkill] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    current_title: "",
    preferred_location: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || "",
        current_title: profile.current_title || "",
        preferred_location: profile.preferred_location || "",
      });
      if (profile.cv_url) {
        // Extract filename from URL
        const parts = profile.cv_url.split('/');
        setCvFileName(parts[parts.length - 1]);
      }
    }
  }, [profile]);

  const handleAddSkill = async () => {
    if (newSkill.trim()) {
      await addSkill(newSkill.trim());
      setNewSkill("");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, DOC, or DOCX file");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    let historyRecordId: string | null = null;

    try {
      // Create unique file path: userId/timestamp_filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_resume.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Delete old resume if exists
      if (profile?.cv_url) {
        const oldPath = profile.cv_url.split('/resumes/')[1];
        if (oldPath) {
          await supabase.storage.from('resumes').remove([oldPath]);
        }
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Add to upload history
      historyRecordId = await addHistoryRecord(file.name, filePath, file.size);

      // Update profile with CV URL
      await updateProfile({ cv_url: filePath });
      setCvFileName(file.name);
      toast.success("Resume uploaded successfully!");

      // Trigger AI parsing
      setParsing(true);
      const result = await parseAndNotify(user.id, filePath, () => {
        refetch(); // Refresh profile and skills after parsing
        refetchHistory();
      });
      
      // Update history record with parsing result
      if (historyRecordId) {
        await updateParsingStatus(
          historyRecordId,
          result.success ? "completed" : "failed",
          result.data?.newSkillsAdded || 0
        );
      }
      
      setParsing(false);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload resume");
      
      // Mark as failed in history
      if (historyRecordId) {
        await updateParsingStatus(historyRecordId, "failed", 0);
      }
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!user || !profile?.cv_url) return;

    try {
      const { error } = await supabase.storage
        .from('resumes')
        .remove([profile.cv_url]);

      if (error) throw error;

      await updateProfile({ cv_url: null });
      setCvFileName(null);
      toast.success("Resume deleted");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete resume");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile(formData);
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold">Your Profile</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* CV Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                />
                
{cvFileName ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-success bg-success/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-success">
                          <CheckCircle className="h-5 w-5 text-success-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-success">Resume Uploaded</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {cvFileName.length > 30 ? cvFileName.substring(0, 30) + '...' : cvFileName}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading || parsing}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteResume}
                          className="text-destructive hover:text-destructive"
                          disabled={parsing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {parsing && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        <span className="text-sm font-medium">AI is analyzing your resume...</span>
                        <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                      </div>
                    )}
                    
                    {/* Upload History Toggle */}
                    {history.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full text-muted-foreground"
                      >
                        <History className="h-4 w-4 mr-2" />
                        {showHistory ? "Hide" : "Show"} Upload History ({history.length})
                      </Button>
                    )}

                    {/* Upload History List */}
                    <AnimatePresence>
                      {showHistory && history.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          {history.map((record) => (
                            <div
                              key={record.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  {record.file_name.length > 25
                                    ? record.file_name.substring(0, 25) + "..."
                                    : record.file_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {record.parsing_status === "completed" && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{record.skills_extracted} skills
                                  </Badge>
                                )}
                                {record.parsing_status === "failed" && (
                                  <Badge variant="destructive" className="text-xs">
                                    Failed
                                  </Badge>
                                )}
                                {record.parsing_status === "pending" && (
                                  <Badge variant="outline" className="text-xs">
                                    Pending
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(record.uploaded_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer border-border hover:border-primary"
                  >
                    {uploading ? (
                      <Loader2 className="h-10 w-10 mx-auto mb-3 text-primary animate-spin" />
                    ) : (
                      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    )}
                    <p className="font-medium">
                      {uploading ? "Uploading..." : "Upload your CV/Resume"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, DOC, or DOCX (max 5MB) • AI will extract skills automatically
                    </p>
                  </div>
                )}
                {/* Basic Info */}
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="title" className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Current Title
                    </Label>
                    <Input
                      id="title"
                      placeholder="Senior Developer"
                      value={formData.current_title}
                      onChange={(e) => setFormData({ ...formData, current_title: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Preferred Location
                    </Label>
                    <Input
                      id="location"
                      placeholder="San Francisco, CA"
                      value={formData.preferred_location}
                      onChange={(e) => setFormData({ ...formData, preferred_location: e.target.value })}
                    />
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
                    {skills.length === 0 && (
                      <span className="text-sm text-muted-foreground">No skills added yet</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a skill..."
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                    />
                    <Button variant="outline" size="icon" onClick={handleAddSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button variant="hero" className="w-full" size="lg" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Profile"}
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
