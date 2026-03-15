import { motion } from "framer-motion";
import { Settings, User, Zap, LogOut, Briefcase } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { NotificationPanel } from "@/components/NotificationPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
}

export function Header({ onOpenProfile, onOpenSettings, onOpenAuth }: HeaderProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl"
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary"
            >
              <Zap className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <span className="font-display text-xl font-bold">JobFlow</span>
          </Link>
          <Badge variant="secondary" className="ml-2 text-xs">
            AI-Powered
          </Badge>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors ${
              isActive("/") ? "text-primary" : "text-foreground/80 hover:text-foreground"
            }`}
          >
            Jobs
          </Link>
          <Link
            to="/applications"
            className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isActive("/applications") ? "text-primary" : "text-foreground/80 hover:text-foreground"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Applications
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationPanel />
              <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                <Settings className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onOpenProfile}>
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="hero" onClick={onOpenAuth}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
