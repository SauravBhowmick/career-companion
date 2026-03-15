import { createContext, useContext } from 'react';

export interface AppNotification {
  id: string;
  type: 'welcome' | 'job_alert' | 'digest' | 'application' | 'match' | 'info';
  title: string;
  body: string | null;
  read: boolean;
  href?: string;
  created_at: string;
}

export interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  push: (n: Omit<AppNotification, 'id' | 'read' | 'created_at'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  push: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}
