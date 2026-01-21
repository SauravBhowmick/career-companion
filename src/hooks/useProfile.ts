import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  current_title: string | null;
  preferred_location: string | null;
  experience_years: number | null;
  cv_url: string | null;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  auto_apply_enabled: boolean;
  email_notifications: boolean;
  instant_notifications: boolean;
  match_threshold: number;
  preferred_job_types: string[];
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPreferences();
      fetchSkills();
    } else {
      setProfile(null);
      setPreferences(null);
      setSkills([]);
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching profile:", error);
    }
    setProfile(data);
    setLoading(false);
  };

  const fetchPreferences = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching preferences:", error);
    }
    setPreferences(data);
  };

  const fetchSkills = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("user_skills")
      .select("skill")
      .eq("user_id", user.id);
    
    if (error) {
      console.error("Error fetching skills:", error);
    }
    setSkills(data?.map(s => s.skill) || []);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    
    if (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } else {
      toast.success("Profile updated!");
      fetchProfile();
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return;
    
    const { error } = await supabase
      .from("user_preferences")
      .update(updates)
      .eq("user_id", user.id);
    
    if (error) {
      toast.error("Failed to update preferences");
      console.error(error);
    } else {
      toast.success("Settings saved!");
      fetchPreferences();
    }
  };

  const addSkill = async (skill: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from("user_skills")
      .insert({ user_id: user.id, skill });
    
    if (error) {
      if (error.code === "23505") {
        toast.error("Skill already exists");
      } else {
        toast.error("Failed to add skill");
        console.error(error);
      }
    } else {
      fetchSkills();
    }
  };

  const removeSkill = async (skill: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from("user_skills")
      .delete()
      .eq("user_id", user.id)
      .eq("skill", skill);
    
    if (error) {
      toast.error("Failed to remove skill");
      console.error(error);
    } else {
      fetchSkills();
    }
  };

  return {
    profile,
    preferences,
    skills,
    loading,
    updateProfile,
    updatePreferences,
    addSkill,
    removeSkill,
    refetch: () => {
      fetchProfile();
      fetchPreferences();
      fetchSkills();
    },
  };
}
