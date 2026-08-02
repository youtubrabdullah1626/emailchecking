import prisma from "@/lib/prisma";
import { LegacyEmptyState as EmptyState, LegacyBadge as Badge, LegacyPageHeader as PageHeader } from "@/components/ui/legacy-adapters";
import { Card, CardContent, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui";

export const dynamic = "force-dynamic";

async function getAuditLogs() {
  try {
    let userLogs: any[] = [];
    try {
      userLogs = await prisma.auditLog.findMany({
        orderBy: { created_at: "desc" },
        take: 50,
      });
    } catch(e) {}

    let systemLogs: any[] = [];
    try {
      systemLogs = await prisma.emailEvent.findMany({
        orderBy: { occurred_at: "desc" },
        take: 50,
        include: {
          step: {
            select: {
              subject: true,
              sequence: {
                select: {
                  prospect: { select: { email: true, name: true } }
                }
              }
            }
          }
        }
      });
    } catch(e) {}

    const formattedUserLogs = userLogs.map(log => ({
      id: log.id,
      time: log.created_at,
      source: "USER_ACTION",
      action: log.action,
      detail: JSON.stringify(log.metadata),
      isError: false
    }));

    const formattedSystemLogs = systemLogs.map(log => {
      let detail = log.step?.subject || "Unknown subject";
      if (log.step?.sequence?.prospect) {
        detail = `${log.step.sequence.prospect.name} (${log.step.sequence.prospect.email}) - ${detail}`;
      }

      return {
        id: log.id,
        time: log.occurred_at,
        source: "SYSTEM_EVENT",
        action: log.event_type,
        detail,
        isError: log.event_type === "FAILED" || log.event_type === "CANCELLED"
      };
    });

    const allLogs = [...formattedUserLogs, ...formattedSystemLogs].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 50);
    return allLogs;
  } catch (error) {
    console.error("Failed to load audit logs:", error);
    throw new Error("Audit Trail Engine Error: Unable to retrieve system events.");
  }
}

export default async function AuditPage() {
  const logs = await getAuditLogs();

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <PageHeader
        title="Enterprise Audit Trail"
        description="Complete operational timeline and compliance logging."
        actions={
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-background border border-border text-foreground rounded-md shadow-sm text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Filters
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
          </div>
        }
      />

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-muted/30">
          <div className="relative flex-1 w-full max-w-md">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search events, prospects, or sequence IDs..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select className="w-full sm:w-auto border border-border rounded-md px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-primary">
            <option>Last 24 Hours</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {logs.length === 0 ? (
              <div className="p-8">
                <EmptyState 
                  title="No Audit Logs Found" 
                  description="There are currently no user actions or system events recorded in the database."
                  icon={<span className="text-4xl">🗄️</span>}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Timestamp</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Action / Event</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(log.time).toISOString().replace("T", " ").substring(0, 19)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.source === "USER_ACTION" ? "info" : "success"}>
                          {log.source.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-semibold ${log.isError ? "text-destructive" : "text-foreground"}`}>
                        {log.action}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground truncate block max-w-lg" title={log.detail}>
                          {log.detail}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
        
        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground bg-muted/30">
          <span>Showing {logs.length} most recent records</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-border rounded-md text-muted-foreground bg-muted/50 cursor-not-allowed">Previous</button>
            <button className="px-3 py-1 border border-border rounded-md text-foreground bg-background hover:bg-muted transition-colors">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
