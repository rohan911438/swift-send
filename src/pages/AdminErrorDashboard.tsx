import { useState, useEffect } from "react";
import { AlertCircle, TrendingUp, Activity, Server, Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface ErrorLog {
  id: string;
  source: string;
  severity: string;
  category: string;
  message: string;
  stack?: string;
  userId?: string;
  url?: string;
  occurredAt: string;
  resolved: boolean;
}

interface ErrorStats {
  total: number;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  unresolved: number;
  last24Hours: number;
}

export default function AdminErrorDashboard() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, []);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/admin/errors?limit=100");
      if (response.ok) {
        const data = await response.json();
        setErrors(data);
      }
    } catch (error) {
      console.error("Failed to fetch errors:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiFetch("/admin/errors/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch error stats:", error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-600">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "frontend":
        return <Globe className="h-4 w-4" />;
      case "backend":
        return <Server className="h-4 w-4" />;
      case "stellar":
        return <Activity className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertCircle className="h-8 w-8" />
            Error Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Track and monitor system errors across all services
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Errors
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {stats.unresolved}
              </div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Last 24 Hours
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.last24Hours}</div>
              <p className="text-xs text-muted-foreground">Recent errors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {stats.bySeverity.critical || 0}
              </div>
              <p className="text-xs text-muted-foreground">High priority</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Errors</TabsTrigger>
          <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
          <TabsTrigger value="critical">Critical</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading errors...
              </CardContent>
            </Card>
          ) : errors.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No errors found
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {errors.map((error) => (
                  <Card
                    key={error.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      !error.resolved ? "border-red-500/50" : ""
                    }`}
                    onClick={() => setSelectedError(error)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(error.severity)}
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {getSourceIcon(error.source)}
                              {error.source}
                            </Badge>
                            <Badge variant="secondary">{error.category}</Badge>
                            {!error.resolved && (
                              <Badge variant="destructive">Unresolved</Badge>
                            )}
                          </div>
                          <CardTitle className="text-base">
                            {error.message}
                          </CardTitle>
                          <CardDescription>
                            {error.userId && `User: ${error.userId} • `}
                            {formatDistanceToNow(new Date(error.occurredAt), {
                              addSuffix: true,
                            })}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    {error.url && (
                      <CardContent>
                        <div className="text-xs text-muted-foreground truncate">
                          URL: {error.url}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="unresolved" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {errors
                .filter((e) => !e.resolved)
                .map((error) => (
                  <Card
                    key={error.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50 border-red-500/50"
                    onClick={() => setSelectedError(error)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(error.severity)}
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {getSourceIcon(error.source)}
                              {error.source}
                            </Badge>
                            <Badge variant="secondary">{error.category}</Badge>
                          </div>
                          <CardTitle className="text-base">
                            {error.message}
                          </CardTitle>
                          <CardDescription>
                            {formatDistanceToNow(new Date(error.occurredAt), {
                              addSuffix: true,
                            })}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="critical" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {errors
                .filter((e) => e.severity === "critical")
                .map((error) => (
                  <Card
                    key={error.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50 border-red-600"
                    onClick={() => setSelectedError(error)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(error.severity)}
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {getSourceIcon(error.source)}
                              {error.source}
                            </Badge>
                            <Badge variant="secondary">{error.category}</Badge>
                            {!error.resolved && (
                              <Badge variant="destructive">Unresolved</Badge>
                            )}
                          </div>
                          <CardTitle className="text-base">
                            {error.message}
                          </CardTitle>
                          <CardDescription>
                            {formatDistanceToNow(new Date(error.occurredAt), {
                              addSuffix: true,
                            })}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
