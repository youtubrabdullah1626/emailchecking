"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_GROUPS } from "@/lib/timezones";
import type { Prospect } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface FieldErrors {
  name?: string;
  company?: string;
  email?: string;
  timezone?: string;
  notes?: string;
  general?: string;
}

interface ProspectFormProps {
  mode: "create" | "edit";
  initialData?: Partial<Prospect>;
  prospectId?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

function clientValidate(data: {
  name: string;
  company: string;
  email: string;
  timezone: string;
  notes: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.name.trim()) errors.name = "Name is required.";
  if (!data.company.trim()) errors.company = "Company is required.";
  if (!data.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!data.timezone) errors.timezone = "Timezone is required.";
  return errors;
}

function ProspectFormComponent({ mode, initialData, prospectId }: ProspectFormProps) {
  const router = useRouter();

  const [name, setName]         = useState(initialData?.name ?? "");
  const [company, setCompany]   = useState(initialData?.company ?? "");
  const [email, setEmail]       = useState(initialData?.email ?? "");
  const [timezone, setTimezone] = useState(initialData?.timezone ?? "");
  const [notes, setNotes]       = useState(initialData?.notes ?? "");

  const [errors, setErrors]     = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const clientErrors = clientValidate({ name, company, email, timezone, notes });
      if (Object.keys(clientErrors).length > 0) {
        setErrors(clientErrors);
        return;
      }

      setIsSubmitting(true);

      try {
        const url = mode === "create" ? "/api/prospects" : `/api/prospects/${prospectId}`;
        const method = mode === "create" ? "POST" : "PUT";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, company, email, timezone, notes }),
        });

        const json = await res.json();

        if (!res.ok) {
          if (json.errors && Array.isArray(json.errors)) {
            const serverErrors: FieldErrors = {};
            for (const err of json.errors as { field: string; message: string }[]) {
              serverErrors[err.field as keyof FieldErrors] = err.message;
            }
            setErrors(serverErrors);
          } else {
            toast.error(json.error ?? "Something went wrong. Please try again.");
          }
          setIsSubmitting(false);
          return;
        }

        if (mode === "create") {
          toast.success("Prospect saved successfully.");
          router.push(`/prospects/${json.data.id}`);
        } else {
          toast.success("Prospect updated successfully.");
          router.push(`/prospects/${prospectId}`);
          router.refresh();
        }
      } catch (err) {
        toast.error("Network error. Check your connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, company, email, timezone, notes, mode, prospectId, router]
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="prospect-name" className="text-sm font-medium">
            Full Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="prospect-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setErrors(p => ({ ...p, name: name.trim() ? undefined : "Name is required." }))}
            placeholder="Jane Smith"
            disabled={isSubmitting}
            autoComplete="name"
            maxLength={100}
          />
          {errors.name && <span className="text-xs text-destructive">{errors.name}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="prospect-company" className="text-sm font-medium">
            Company <span className="text-destructive">*</span>
          </label>
          <Input
            id="prospect-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onBlur={() => setErrors(p => ({ ...p, company: company.trim() ? undefined : "Company is required." }))}
            placeholder="Acme Corp"
            disabled={isSubmitting}
            autoComplete="organization"
            maxLength={100}
          />
          {errors.company && <span className="text-xs text-destructive">{errors.company}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="prospect-email" className="text-sm font-medium">
            Email Address <span className="text-destructive">*</span>
          </label>
          <Input
            id="prospect-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => {
              if (!email.trim()) setErrors(p => ({ ...p, email: "Email address is required." }));
              else if (!EMAIL_REGEX.test(email.trim())) setErrors(p => ({ ...p, email: "Enter a valid email address." }));
              else setErrors(p => ({ ...p, email: undefined }));
            }}
            placeholder="jane@acmecorp.com"
            disabled={isSubmitting}
            autoComplete="email"
          />
          {errors.email && <span className="text-xs text-destructive">{errors.email}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="prospect-timezone" className="text-sm font-medium">
            Timezone <span className="text-destructive">*</span>
          </label>
          <span className="text-xs text-muted-foreground">Choose their local timezone. This is used to schedule emails at the right time.</span>
          <select
            id="prospect-timezone"
            value={timezone}
            className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setTimezone(e.target.value);
              if (e.target.value) setErrors(p => ({ ...p, timezone: undefined }));
            }}
            disabled={isSubmitting}
          >
            <option value="">— Select a timezone —</option>
            {TIMEZONE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.timezone && <span className="text-xs text-destructive">{errors.timezone}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="prospect-notes" className="text-sm font-medium">
            Notes <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <span className="text-xs text-muted-foreground">Context about this prospect — how you found them, what to mention, etc.</span>
          <Textarea
            id="prospect-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Met at SaaS conference. CTO of a 50-person startup. Interested in our enterprise plan."
            disabled={isSubmitting}
            maxLength={2000}
            rows={4}
          />
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">{notes.length} / 2000</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "create" ? "Adding..." : "Saving..."}
              </>
            ) : (
              mode === "create" ? "Add Prospect" : "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default React.memo(ProspectFormComponent);
