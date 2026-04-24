import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UserNotification } from '@/types/activity';
import { formatDistanceToNow } from 'date-fns';

interface NotificationFeedProps {
  notifications: UserNotification[];
  unreadCount: number;
}

const notificationStyles = {
  success: {
    icon: CheckCircle2,
    badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800',
  },
  error: {
    icon: XCircle,
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800',
  },
  info: {
    icon: Info,
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800',
  },
} as const;

export function NotificationFeed({ notifications, unreadCount }: NotificationFeedProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-primary" />
            Alerts & Notifications
          </CardTitle>
          <Badge variant="secondary">{unreadCount} unread</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Transfer confirmations and failure alerts will appear here.
          </div>
        ) : (
          notifications.map((notification) => {
            const style = notificationStyles[notification.type];
            const Icon = style.icon;
            const sentChannels = notification.deliveries.filter((delivery) => delivery.status === 'sent');

            return (
              <div key={notification.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="mt-0.5 rounded-full bg-muted p-2">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{notification.title}</p>
                        {!notification.readAt && (
                          <Badge variant="outline" className={style.badge}>
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{formatDistanceToNow(notification.createdAt, { addSuffix: true })}</span>
                        {sentChannels.some((delivery) => delivery.channel === 'email') && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email sent
                          </span>
                        )}
                        {sentChannels.some((delivery) => delivery.channel === 'sms') && (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            SMS sent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
