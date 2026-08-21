"use client";

import React from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { useWarmup } from "@/components/providers/WarmupProvider";
import { UNIVERSAL_SCHEMA } from "@/lib/import/schema/UniversalSchema";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle } from "lucide-react";

export function ManualMappingWorkspace() {
  const { parsedHeaders, mappingConfig, updateMapping, applyMappingConfig } = useImport() as any; 

  // Check if email is mapped (required)
  const isEmailMapped = Object.values(mappingConfig).includes("email");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/5 border-b border-border">
          <CardTitle className="text-base font-semibold">Map Columns</CardTitle>
          <CardDescription>
            We&apos;ve automatically detected some columns. Please review and map the remaining fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40%]">File Column Header</TableHead>
                <TableHead className="w-[10%]"></TableHead>
                <TableHead className="w-[50%]">Import Schema Property</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsedHeaders.map((header: string) => {
                const currentMapping = mappingConfig[header] || "";
                return (
                  <TableRow key={header}>
                    <TableCell className="font-medium text-sm text-foreground">{header}</TableCell>
                    <TableCell className="text-muted-foreground"><ArrowRight className="h-4 w-4 mx-auto" /></TableCell>
                    <TableCell>
                      <Select 
                        value={currentMapping === "" ? "custom" : currentMapping} 
                        onValueChange={(val) => updateMapping(header, val === "custom" ? "" : val)}
                      >
                        <SelectTrigger className="w-full max-w-sm h-8 text-xs">
                          <SelectValue placeholder="Do not import (Custom)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom" className="text-muted-foreground italic">Save as Custom Field</SelectItem>
                          {UNIVERSAL_SCHEMA.map(schemaField => (
                            <SelectItem key={schemaField.key} value={schemaField.key}>
                              {schemaField.label} {schemaField.type === "required" && "*"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <div className="flex flex-col items-end gap-2">
          {!isEmailMapped && (
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              Email mapping is required
            </div>
          )}
          <div className="flex items-center gap-4">
            <Button onClick={applyMappingConfig} disabled={!isEmailMapped} className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground">
              Continue to Setup <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
