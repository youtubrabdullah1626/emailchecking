export type SchemaFieldType = "required" | "standard" | "follow-up";

export interface SchemaField {
  key: string;
  label: string;
  type: SchemaFieldType;
  description: string;
}

export const UNIVERSAL_SCHEMA: SchemaField[] = [
  { key: "email", label: "Email Address", type: "required", description: "Primary contact email" },
  { key: "firstName", label: "First Name", type: "standard", description: "Prospect's given name" },
  { key: "lastName", label: "Last Name", type: "standard", description: "Prospect's family name" },
  { key: "companyName", label: "Company", type: "standard", description: "Organization name" },
  { key: "title", label: "Job Title", type: "standard", description: "Professional role" },
  { key: "linkedinProfile", label: "LinkedIn URL", type: "standard", description: "Social profile link" },
  { key: "website", label: "Website", type: "standard", description: "Company website" },
  { key: "phone", label: "Phone Number", type: "standard", description: "Direct or office line" },
  { key: "country", label: "Country", type: "standard", description: "Geographic location" },
  { key: "city", label: "City", type: "standard", description: "City or region" },
  // Message Content
  { key: "initialMessage", label: "Initial Message", type: "required", description: "Primary email content" },
  // Optional Follow-ups
  { key: "followUp1", label: "Follow Up 1", type: "follow-up", description: "Custom follow-up block 1" },
  { key: "followUp2", label: "Follow Up 2", type: "follow-up", description: "Custom follow-up block 2" },
  { key: "followUp3", label: "Follow Up 3", type: "follow-up", description: "Custom follow-up block 3" },
];
