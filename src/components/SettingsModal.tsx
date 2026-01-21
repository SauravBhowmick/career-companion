import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Zap, Shield, Sliders, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useJobAlerts } from "@/hooks/useJobAlerts";
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { preferences, loading, updatePreferences } = useProfile();
  const { testJobAlert } = useJobAlerts();
  const [settings, setSettings] = useState({
    auto_apply_enabled: false,
    email_notifications: true,
    instant_notifications: false,
    match_threshold: 75,
  });
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const handleTestEmail = async () => {
    setSendingTest(true);
    await testJobAlert();
    setSendingTest(false);
  };
  useEffect(() => {
    if (preferences) {
      setSettings({
        auto_apply_enabled: preferences.auto_apply_enabled,
        email_notifications: preferences.email_notifications,
        instant_notifications: preferences.instant_notifications,
        match_threshold: preferences.match_threshold,
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    await updatePreferences(settings);
    setSaving(false);
    onClose();
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
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold">Auto-Apply Settings</h2>
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
                {/* Auto Apply */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg gradient-primary">
                      <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <Label className="font-medium">Auto-Apply</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically apply to matching jobs
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.auto_apply_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, auto_apply_enabled: checked })}
                  />
                </div>

                {/* Match Threshold */}
                <div className="p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-accent">
                      <Sliders className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <Label className="font-medium">Match Threshold</Label>
                      <p className="text-sm text-muted-foreground">
                        Only auto-apply to jobs with {settings.match_threshold}%+ match
                      </p>
                    </div>
                  </div>
                  <Slider
                    value={[settings.match_threshold]}
                    onValueChange={([value]) => setSettings({ ...settings, match_threshold: value })}
                    min={50}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>50%</span>
                    <span className="font-semibold text-primary">{settings.match_threshold}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Email Notifications */}
                <div className="p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success">
                        <Bell className="h-5 w-5 text-success-foreground" />
                      </div>
                      <div>
                        <Label className="font-medium">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Get daily digest of new matching jobs
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.email_notifications}
                      onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
                    />
                  </div>
                  {settings.email_notifications && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={handleTestEmail}
                      disabled={sendingTest}
                    >
                      {sendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Test Email
                    </Button>
                  )}
                </div>

                {/* Instant Notifications */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <Shield className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <Label className="font-medium">Instant Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify immediately for 90%+ matches
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.instant_notifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, instant_notifications: checked })}
                  />
                </div>

                <Button variant="hero" className="w-full" size="lg" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Settings"}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
