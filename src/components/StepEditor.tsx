"use client";

import React, { memo } from "react";
import { TIMEZONE_GROUPS } from "@/lib/timezones";
import { Card, CardContent } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Clock, X, Copy, ArrowUp, ArrowDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StepFormData {
  step_number: number;
  subject: string;
  body: string;
  send_time: string;    // "HH:MM"
  timezone: string;     // IANA
  send_date: string;    // "YYYY-MM-DD" — step 1 only
  delay_days: string;   // numeric string — steps 2–4
}

export interface StepErrors {
  subject?: string;
  body?: string;
  send_time?: string;
  timezone?: string;
  send_date?: string;
  delay_days?: string;
}

interface StepEditorProps {
  step: StepFormData;
  index: number;
  errors: StepErrors;
  disabled: boolean;
  onUpdate: (updated: StepFormData) => void;
  onRemove: () => void;
  canRemove: boolean;
  onDuplicate?: () => void;
  canDuplicate?: boolean;
  onMoveUp?: () => void;
  canMoveUp?: boolean;
  onMoveDown?: () => void;
  canMoveDown?: boolean;
}

const STEP_LABELS = [
  "Initial Outreach",
  "Follow-up #1",
  "Follow-up #2",
  "Follow-up #3",
];

function StepEditorComponent({
  step,
  index,
  errors,
  disabled,
  onUpdate,
  onRemove,
  canRemove,
  onDuplicate,
  canDuplicate,
  onMoveUp,
  canMoveUp,
  onMoveDown,
  canMoveDown,
}: StepEditorProps) {
  const label = STEP_LABELS[index] ?? `Email ${index + 1}`;
  const fieldId = (name: string) => `step-${index}-${name}`;

  function set(patch: Partial<StepFormData>) {
    onUpdate({ ...step, ...patch });
  }

  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center mt-1">
        <div className={cn(
          "h-12 w-12 rounded-full border-2 flex items-center justify-center bg-card shadow-sm transition-colors",
          "border-primary text-primary"
        )}>
          <span className="font-bold">{index + 1}</span>
        </div>
      </div>
      
      <Card id={`step-card-${index}`} className="flex-1 border-border shadow-sm hover:shadow-md transition-all duration-200">
        <CardContent className="p-5 flex flex-col gap-4">
          {/* Step header / badge */}
          <div className="flex justify-between items-start mb-2">
            <StatusBadge status="neutral" label={label} className="uppercase text-xs font-semibold tracking-wide" />
            
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted/30 px-2 py-1 rounded-md border border-border/50 mr-2">
                <Clock className="h-3 w-3" />
                Scheduling
              </span>
              
              <div className="flex items-center bg-muted/20 border border-border/40 rounded-md">
                {canMoveUp && onMoveUp && (
                  <Button
                    aria-label={`Move ${label} up`}
                    onClick={onMoveUp}
                    disabled={disabled}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-none rounded-l-md text-muted-foreground hover:text-foreground hover:bg-muted/50 border-r border-border/40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canMoveDown && onMoveDown && (
                  <Button
                    aria-label={`Move ${label} down`}
                    onClick={onMoveDown}
                    disabled={disabled}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-none rounded-r-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {canDuplicate && onDuplicate && (
                <Button
                  aria-label={`Duplicate ${label}`}
                  onClick={onDuplicate}
                  disabled={disabled}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              
              {canRemove && (
                <Button
                  aria-label={`Remove ${label}`}
                  onClick={onRemove}
                  disabled={disabled}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Scheduling row */}
          <div className="flex flex-wrap items-start gap-4 p-3 bg-muted/10 rounded-md border border-border/40">
            {index === 0 ? (
              <div className="flex-[1_1_200px] flex flex-col gap-1.5">
                <Label htmlFor={fieldId("date")}>Send on *</Label>
                <Input
                  id={fieldId("date")}
                  type="date"
                  value={step.send_date}
                  onChange={(e) => set({ send_date: e.target.value })}
                  disabled={disabled}
                  className={errors.send_date ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.send_date && <p className="text-sm font-medium text-destructive">{errors.send_date}</p>}
              </div>
            ) : (
              <div className="flex-[1_1_200px] flex flex-col gap-1.5">
                <Label htmlFor={fieldId("delay")}>Send after (days) *</Label>
                <Input
                  id={fieldId("delay")}
                  type="number"
                  min={1}
                  max={365}
                  value={step.delay_days}
                  onChange={(e) => set({ delay_days: e.target.value })}
                  disabled={disabled}
                  className={errors.delay_days ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.delay_days && <p className="text-sm font-medium text-destructive">{errors.delay_days}</p>}
              </div>
            )}

            <div className="flex-[1_1_200px] flex flex-col gap-1.5">
              <Label htmlFor={fieldId("time")}>At *</Label>
              <Input
                id={fieldId("time")}
                type="time"
                value={step.send_time}
                onChange={(e) => set({ send_time: e.target.value })}
                disabled={disabled}
                className={errors.send_time ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.send_time && <p className="text-sm font-medium text-destructive">{errors.send_time}</p>}
            </div>

            <div className="flex-[1_1_250px] flex flex-col gap-1.5">
              <Label htmlFor={fieldId("tz")}>Timezone</Label>
              <Select value={step.timezone} onValueChange={(val) => set({ timezone: val })} disabled={disabled}>
                <SelectTrigger id={fieldId("tz")} className={errors.timezone ? "border-destructive focus:ring-destructive" : ""}>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_GROUPS.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.options.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label} ({tz.offset})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {errors.timezone && <p className="text-sm font-medium text-destructive">{errors.timezone}</p>}
            </div>
          </div>

          {/* Subject */}
          <div className="mt-2 flex flex-col gap-1.5">
            <Label htmlFor={fieldId("subject")}>Subject *</Label>
            <Input
              id={fieldId("subject")}
              type="text"
              value={step.subject}
              onChange={(e) => set({ subject: e.target.value })}
              placeholder={
                index === 0
                  ? "Quick question about [topic]"
                  : "Re: Quick question about [topic]"
              }
              disabled={disabled}
              maxLength={200}
              className={errors.subject ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.subject && <p className="text-sm font-medium text-destructive">{errors.subject}</p>}
          </div>

          {/* Body */}
          <div className="mt-1 flex flex-col gap-1.5">
            <Label htmlFor={fieldId("body")}>Email Body *</Label>
            <div className="relative">
              <Textarea
                id={fieldId("body")}
                value={step.body}
                onChange={(e) => set({ body: e.target.value })}
                placeholder={
                  index === 0
                    ? "Hi {{name}},\n\nI came across your company and wanted to reach out…"
                    : "Hi {{name}},\n\nJust following up on my previous email…"
                }
                disabled={disabled}
                maxLength={10000}
                rows={8}
                className={errors.body ? "border-destructive focus-visible:ring-destructive pb-6" : "pb-6"}
              />
              <div className="absolute bottom-2 right-3 text-xs text-muted-foreground bg-background px-1 rounded">
                {step.body.length} / 10,000
              </div>
            </div>
            {errors.body && <p className="text-sm font-medium text-destructive">{errors.body}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(StepEditorComponent);
