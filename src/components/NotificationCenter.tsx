import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  transferId?: string;
}

interface NotificationResponse {
  items: Notification[];
  unreadCount: number;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/notifications?limit=50");
      if (response.ok) {
        const data: NotificationResponse = await response.json();
        setNotifications(data.items);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await apiFetch(`/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, readAt: new Date().toISOString() }
              : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiFetch("/notifications/mark-all-read", {
        method: "POST",
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            readAt: n.readAt || new Date().toISOString(),
          })),
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="w-full"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}

          <ScrollArea className="h-[calc(100vh-200px)]">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border ${
                      notification.readAt ? "bg-muted/30" : "bg-card"
                    } transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${getTypeColor(notification.type)} text-xs`}
                          >
                            {notification.type}
                          </Badge>
                          {!notification.readAt && (
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <h4 className="font-medium text-sm">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            {
                              addSuffix: true,
                            },
                          )}
                        </p>
                      </div>
                      {!notification.readAt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
