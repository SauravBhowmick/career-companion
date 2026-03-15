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

  // Fetch DB notifications on login / user change
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      prevUserRef.current = null;
      return;
    }

    prevUserRef.current = user.id;
    const userId = user.id;
    let cancelled = false;

    const fetchFromDb = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled || prevUserRef.current !== userId) return;

        if (error) {
          const isRelationMissing =
            typeof error.message === 'string' &&
            error.message.includes('relation') &&
            error.message.includes('does not exist');
          if (!isRelationMissing) {
            console.error('Failed to fetch notifications:', error);
          }
          return;
        }

        if (data) {
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
      } catch (err) {
        if (!cancelled) {
          console.error('Notification fetch error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFromDb();

    return () => {
      cancelled = true;
    };
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
