import React from "react";
import { AuditLogEvent } from "./types";
import { StatusBadge, ActionBadge } from "./badges";
import { InfoCard, MetadataGrid } from "./InfoCard";
import { X, CalendarDays, Activity, ShieldAlert, MonitorSmartphone, KeyRound, Server, Network } from "lucide-react";

interface AuditEventDrawerProps {
  event: AuditLogEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditEventDrawer({ event, isOpen, onClose }: AuditEventDrawerProps) {
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
              <InfoCard label="Resource ID" value={event.resourceId} monospace />
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
              <InfoCard label="IP Address" value={event.ipAddress} monospace />
              <InfoCard label="Country" value={event.country} />
              <InfoCard label="Device" value={event.device} />
              <InfoCard label="Browser" value={event.browser} />
              <InfoCard label="Operating System" value={event.os} />
              <InfoCard label="Environment" value={event.environment} />
            </MetadataGrid>
          </section>

          {/* System Context */}
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Server className="w-4 h-4" />
              System Context
            </h3>
            <MetadataGrid>
              <InfoCard label="Session ID" value={event.sessionId} monospace />
              <InfoCard label="Request ID" value={event.requestId} monospace />
              <InfoCard label="API Source" value={event.apiSource} />
            </MetadataGrid>
          </section>

          {/* Changes / Metadata */}
          {(event.oldValues || event.newValues || event.metadata || event.errorMsg) && (
            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Payload & Details
              </h3>
              
              {event.errorMsg && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <span className="text-xs font-semibold uppercase text-destructive tracking-wider block mb-2">Error Message</span>
                  <code className="text-sm text-destructive font-mono whitespace-pre-wrap">{event.errorMsg}</code>
                </div>
              )}

              {event.oldValues && event.newValues && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/20 border border-border rounded-md">
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block mb-2">Previous State</span>
                    <pre className="text-sm text-foreground font-mono overflow-x-auto">
                      {JSON.stringify(event.oldValues, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                    <span className="text-xs font-semibold uppercase text-primary tracking-wider block mb-2">New State</span>
                    <pre className="text-sm text-foreground font-mono overflow-x-auto">
                      {JSON.stringify(event.newValues, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {event.metadata && (
                <div className="p-4 bg-muted/30 border border-border rounded-md">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider block mb-2">Event Metadata</span>
                  <pre className="text-sm text-foreground font-mono overflow-x-auto">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* Timeline Placeholder */}
          <section className="flex flex-col gap-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Network className="w-4 h-4" />
              Related Activity
            </h3>
            <div className="p-6 border border-dashed border-border rounded-md text-center bg-muted/10">
              <p className="text-sm text-muted-foreground">
                Timeline and related events feature will be available after backend integration.
              </p>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
