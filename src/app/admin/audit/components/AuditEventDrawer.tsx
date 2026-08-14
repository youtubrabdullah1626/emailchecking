import React from "react";
import useSWR from "swr";
import { AuditLogEvent } from "./types";
import { StatusBadge, ActionBadge } from "./badges";
import { InfoCard, MetadataGrid } from "./InfoCard";
import { X, CalendarDays, Activity, ShieldAlert, MonitorSmartphone, KeyRound, Server, Network, Loader2 } from "lucide-react";

interface AuditEventDrawerProps {
  event: AuditLogEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load details");
  return res.json();
};

export function AuditEventDrawer({ event, isOpen, onClose }: AuditEventDrawerProps) {
  const { data, isLoading } = useSWR(
    isOpen && event ? `/api/admin/audit/${event.id}` : null,
    fetcher
  );

  if (!isOpen || !event) return null;

  const date = new Date(event.time);
  const formattedDate = date.toLocaleDateString([], { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString([], { 
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
  });

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border sticky top-0 bg-card/95 backdrop-blur z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">{event.action}</h2>
              <StatusBadge status={event.status} />
              {event.severity === "CRITICAL" && (
                <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-wider">
                  Critical
                </span>
              )}
              {event.severity === "WARNING" && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-xs font-semibold uppercase tracking-wider">
                  High Risk
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {formattedDate} at {formattedTime}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-8 p-6">
          
          {/* Overview Section */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Event Overview
            </h3>
            <MetadataGrid>
              <InfoCard label="Performed By" value={`${event.actorName} (${event.actorEmail})`} />
              <InfoCard label="Category" value={<ActionBadge action={event.action} category={event.category} />} />
              <InfoCard label="Resource Type" value={event.resourceType} />
              <InfoCard label="Resource Name" value={event.resourceName} />
              {event.resourceId && <InfoCard label="Resource ID" value={event.resourceId} monospace />}
              <InfoCard label="Status" value={event.status} />
            </MetadataGrid>
          </section>

          {/* Device & Network Section */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4" />
              Device & Network
            </h3>
            <MetadataGrid>
              <InfoCard label="IP Address" value={event.ipAddress || "Not Recorded (System Action)"} monospace={!!event.ipAddress} />
              {event.country && <InfoCard label="Country" value={event.country} />}
              {event.device && event.device !== "Unknown Device" && <InfoCard label="Device" value={event.device} />}
              {event.browser && <InfoCard label="Browser" value={event.browser} />}
              {event.os && <InfoCard label="Operating System" value={event.os} />}
              {event.environment && <InfoCard label="Environment" value={event.environment} />}
            </MetadataGrid>
          </section>

          {/* System Context */}
          {(event.sessionId || event.requestId || event.apiSource) ? (
            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Server className="w-4 h-4" />
                System Context
              </h3>
              <MetadataGrid>
                {event.sessionId && <InfoCard label="Session ID" value={event.sessionId} monospace />}
                {event.requestId && <InfoCard label="Request ID" value={event.requestId} monospace />}
                {event.apiSource && <InfoCard label="API Source" value={event.apiSource} />}
              </MetadataGrid>
            </section>
          ) : null}

          {/* Changes / Metadata */}
          {(event.oldValues || event.newValues || event.metadata || event.errorMsg) && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Payload & Details
                </h3>
                {event.oldValues && (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(event.oldValues, null, 2));
                    }}
                    className="text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 rounded-md transition-colors"
                  >
                    Copy Restoration Payload
                  </button>
                )}
              </div>
              
              {event.errorMsg && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <span className="text-xs font-semibold uppercase text-destructive tracking-wider block mb-2">Error Message</span>
                  <code className="text-sm text-destructive font-mono whitespace-pre-wrap">{event.errorMsg}</code>
                </div>
              )}

              {event.oldValues && event.newValues && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">Previous State</span>
                      <div className="flex flex-col bg-muted/20 rounded-md border border-border p-3 gap-2">
                        {Object.entries(event.oldValues).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="font-medium text-slate-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase text-primary tracking-wider block">New State</span>
                      <div className="flex flex-col bg-primary/5 rounded-md border border-primary/20 p-3 gap-2">
                        {Object.entries(event.newValues).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="font-medium text-slate-900">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {event.metadata && Object.keys(event.metadata).filter(k => !['resourceName', 'country', 'browser', 'os'].includes(k)).length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block">Additional Details</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(event.metadata)
                      .filter(([k]) => !['resourceName', 'country', 'browser', 'os'].includes(k))
                      .map(([key, value]) => (
                        <div key={key} className="flex flex-col bg-muted/20 p-3 rounded-md border border-border">
                          <span className="text-[11px] font-medium uppercase text-muted-foreground tracking-wider mb-1">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="text-[13px] font-medium text-slate-700">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Timeline Placeholder */}
          <section className="flex flex-col gap-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Network className="w-4 h-4" />
              Related Activity Timeline
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : data?.relatedEvents && data.relatedEvents.length > 0 ? (
              <div className="relative border-l-2 border-muted ml-3 space-y-6 pb-4 pt-2">
                {data.relatedEvents.map((relatedEvent: any) => {
                  const rDate = new Date(relatedEvent.created_at || relatedEvent.time);
                  const isCurrent = relatedEvent.id === event.id;
                  
                  return (
                    <div key={relatedEvent.id} className="relative pl-6 group">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-card transition-colors ${
                        isCurrent ? 'bg-primary scale-110' : 
                        relatedEvent.status === 'FAILURE' ? 'bg-destructive' : 
                        relatedEvent.severity === 'WARNING' ? 'bg-orange-500' : 'bg-muted-foreground'
                      }`} />
                      
                      <div className={`flex flex-col p-3 rounded-md border ${isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card shadow-sm hover:border-primary/20 transition-colors'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                            {relatedEvent.action}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {rDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {relatedEvent.actor_email || relatedEvent.actorEmail}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 border border-dashed border-border rounded-md text-center bg-muted/10">
                <p className="text-sm text-muted-foreground">
                  No related activity found for this event.
                </p>
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  );
}
