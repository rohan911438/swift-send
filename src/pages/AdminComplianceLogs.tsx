import { useState, useEffect } from "react";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ComplianceLog {
  id: string;
  userId: string;
  transferId?: string;
  checkType: string;
  status: string;
  riskScore: number;
  flags: string[];
  metadata: Record<string, unknown>;
  checkedAt: string;
  checkedBy: string;
  notes?: string;
}

export default function AdminComplianceLogs() {
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [flaggedLogs, setFlaggedLogs] = useState<ComplianceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
    fetchFlaggedLogs();
  }, [filter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.append("status", filter);
      }
      const response = await apiFetch(
        `/admin/compliance/logs?${params.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch compliance logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlaggedLogs = async () => {
    try {
      const response = await apiFetch("/admin/compliance/flagged");
      if (response.ok) {
        const data = await response.json();
        setFlaggedLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch flagged logs:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Passed
          </Badge>
        );
      case "flagged":
        return (
          <Badge className="bg-yellow-500">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Flagged
          </Badge>
        );
      case "blocked":
        return (
          <Badge className="bg-red-500">
            <XCircle className="h-3 w-3 mr-1" />
            Blocked
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return "text-red-500";
    if (score >= 40) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Compliance & AML Monitoring
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor AML checks and compliance logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Logs</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Logs</TabsTrigger>
          <TabsTrigger value="flagged">
            Flagged Transactions
            {flaggedLogs.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {flaggedLogs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading logs...
              </CardContent>
            </Card>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No compliance logs found
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {logs.map((log) => (
                  <Card key={log.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {getStatusBadge(log.status)}
                            <span className="text-sm font-normal text-muted-foreground">
                              {log.checkType.toUpperCase()}
                            </span>
                          </CardTitle>
                          <CardDescription>
                            User: {log.userId}
                            {log.transferId &&
                              ` • Transfer: ${log.transferId.slice(0, 12)}...`}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-2xl font-bold ${getRiskColor(log.riskScore)}`}
                          >
                            {log.riskScore}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Risk Score
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {log.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {log.flags.map((flag, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {flag.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Checked{" "}
                          {formatDistanceToNow(new Date(log.checkedAt), {
                            addSuffix: true,
                          })}
                        </span>
                        <span>By: {log.checkedBy}</span>
                      </div>
                      {log.notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Notes:</strong> {log.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="flagged" className="space-y-4">
          {flaggedLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No flagged transactions
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {flaggedLogs.map((log) => (
                  <Card key={log.id} className="border-yellow-500/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {getStatusBadge(log.status)}
                            <span className="text-sm font-normal text-muted-foreground">
                              {log.checkType.toUpperCase()}
                            </span>
                          </CardTitle>
                          <CardDescription>
                            User: {log.userId}
                            {log.transferId &&
                              ` • Transfer: ${log.transferId.slice(0, 12)}...`}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-2xl font-bold ${getRiskColor(log.riskScore)}`}
                          >
                            {log.riskScore}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Risk Score
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {log.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {log.flags.map((flag, idx) => (
                            <Badge
                              key={idx}
                              variant="destructive"
                              className="text-xs"
                            >
                              {flag.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Checked{" "}
                          {formatDistanceToNow(new Date(log.checkedAt), {
                            addSuffix: true,
                          })}
                        </span>
                        <span>By: {log.checkedBy}</span>
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <strong>Details:</strong>
                          <pre className="mt-1 overflow-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
