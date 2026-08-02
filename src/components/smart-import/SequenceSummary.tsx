"use client";

import React, { useState } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Users, Layers, AlertCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function SequenceSummary() {
  const { sequenceSummary, getRecords } = useImport() as any;
  const [isOpen, setIsOpen] = useState(false);

  if (!sequenceSummary) return null;

  const records = getRecords ? getRecords() : [];
  const invalidLeads = records.filter((r: any) => !r.isValid);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <p className="text-sm font-medium">Valid Sequences</p>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{sequenceSummary.totalLeads.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Ready for execution
          </p>
        </CardContent>
      </Card>
      
      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <p className="text-sm font-medium">Total Emails</p>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{sequenceSummary.totalEmails.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Across all steps
          </p>
        </CardContent>
      </Card>
      
      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-y-0 pb-2">
            <p className="text-sm font-medium">Avg. Length</p>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{sequenceSummary.averageEmailsPerLead}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Emails per sequence
          </p>
        </CardContent>
      </Card>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Card className="border-border shadow-sm relative group cursor-pointer hover:border-amber-500/50 hover:bg-amber-50/50 transition-all overflow-hidden">
            <div className="absolute inset-0 bg-amber-500/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-[1px]">
              <div className="bg-background/90 text-amber-700 text-sm font-semibold py-1.5 px-4 rounded-full shadow-sm flex items-center gap-2 border border-amber-200">
                <Eye className="h-4 w-4" /> View Details
              </div>
            </div>
            
            <CardContent className="p-6 relative z-0 group-hover:opacity-30 transition-opacity">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium">Invalid Leads</p>
                <AlertCircle className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-amber-600">{sequenceSummary.skippedInvalidLeads.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Skipped due to missing data
              </p>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" /> 
              Skipped Leads Details
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 flex-1 overflow-hidden flex flex-col">
            <p className="text-sm text-muted-foreground mb-4">
              These {invalidLeads.length} records were skipped because they did not meet our quality standards. They have been safely excluded from your campaign to protect your sender reputation.
            </p>
            <div className="border rounded-md overflow-hidden flex-1 flex flex-col bg-background h-[400px]">
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[60%]">Contact Information</TableHead>
                      <TableHead>Reason for Skipping</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalidLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                          No invalid leads found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invalidLeads.map((lead: any, i: number) => {
                        const emailDisplay = lead.email || lead.customFields?.email || lead.customFields?.Email || lead.customFields?.["Email Address"];
                        const nameDisplay = `${lead.firstName || lead.customFields?.["First Name"] || ""} ${lead.lastName || lead.customFields?.["Last Name"] || ""}`.trim();
                        const companyDisplay = lead.companyName || lead.customFields?.Company || "";
                        
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              <div className="truncate max-w-[400px]">
                                {emailDisplay ? emailDisplay : <span className="text-muted-foreground italic">No Email Provided</span>}
                              </div>
                              {(nameDisplay || companyDisplay) && (
                                <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[400px]">
                                  {nameDisplay} {companyDisplay ? `(${companyDisplay})` : ""}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1.5">
                                {lead.errors.map((err: string, j: number) => {
                                  // Humanize common technical errors
                                  let friendlyError = err;
                                  if (err.includes("Missing required field: Email")) friendlyError = "No email address found";
                                  if (err.includes("Invalid email format")) friendlyError = "Email format is incorrect";
                                  
                                  return (
                                    <Badge key={j} variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 font-medium shadow-none w-fit">
                                      {friendlyError}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
