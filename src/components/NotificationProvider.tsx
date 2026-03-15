import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NotificationContext, type AppNotification } from '@/hooks/useNotifications';

let idSeq = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prevUserRef = useRef<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Push a local notification (no DB write needed)
  const push = useCallback(
    (n: Omit<AppNotification, 'id' | 'read' | 'created_at'>) => {
      const notif: AppNotification = {
        ...n,
        id: `local-${++idSeq}-${Date.now()}`,
        read: false,
        created_at: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    // Persist to DB if it's a server-side notification (non-local)
    if (!id.startsWith('local-')) {
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to mark notification as read:', error);
        });
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) {
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .then(({ error }) => {
          if (error) console.error('Failed to mark all read:', error);
        });
    }
  }, [user]);

  // Fetch DB notifications + create welcome notification on login
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      prevUserRef.current = null;
      return;
    }

    const justLoggedIn = prevUserRef.current !== user.id;
    prevUserRef.current = user.id;

    const fetchFromDb = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          const dbNotifs: AppNotification[] = data.map((row: any) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            body: row.body,
            read: row.read,
            href: row.metadata?.href,
            created_at: row.created_at,
          }));
          setNotifications((prev) => {
            const locals = prev.filter((n) => n.id.startsWith('local-'));
            return [...locals, ...dbNotifs].slice(0, 50);
          });
        }
      } catch {
        // Table may not exist yet — that's OK
      } finally {
        setLoading(false);
      }
    };

    fetchFromDb();

    if (justLoggedIn) {
      // Always push a local welcome so there's content immediately
      setNotifications((prev) => {
        if (prev.some((n) => n.type === 'welcome')) return prev;
        const welcome: AppNotification = {
          id: `local-${++idSeq}-welcome`,
          type: 'welcome',
          title: 'Welcome to JobFlow!',
          body: 'Upload your CV, set preferences, and fetch real jobs to get started.',
          read: false,
          href: '/',
          created_at: new Date().toISOString(),
        };
        return [welcome, ...prev];
      });
    }
  }, [user]);

  // Realtime subscription for server-pushed notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          const notif: AppNotification = {
            id: row.id,
            type: row.type,
            title: row.title,
            body: row.body,
            read: row.read,
            href: row.metadata?.href,
            created_at: row.created_at,
          };
          setNotifications((prev) => [notif, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, push, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
