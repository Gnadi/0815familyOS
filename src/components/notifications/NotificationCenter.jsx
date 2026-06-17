import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, CheckSquare, Heart, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import { markAllRead, markRead } from '../../services/notifications';

const TYPE_CONFIG = {
  event_reminder: { Icon: Calendar, color: 'text-brand-500', link: '/calendar' },
  task_due:       { Icon: CheckSquare, color: 'text-amber-500', link: '/tasks' },
  vaccination_due: { Icon: Heart, color: 'text-red-500', link: '/health' },
};

export default function NotificationCenter() {
  const { family } = useAuth();
  const { notifications, unreadCount } = useNotifications(family?.id);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  async function handleNotificationClick(n) {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    navigate(n.link);
  }

  async function handleMarkAll() {
    if (family?.id) await markAllRead(family.id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold text-slate-900">Notifications</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-brand-500 hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => {
                const { Icon, color } = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.event_reminder;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                      !n.read ? 'bg-brand-50' : ''
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${color}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-slate-500 leading-snug">{n.body}</p>
                      )}
                      {n.createdAt && (
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    {!n.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
