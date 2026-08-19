"use client";

import React, { useRef, useState } from "react";
import { useImport } from "@/components/providers/ImportProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

export function ImportDropZone() {
  const { handleFileUpload, status, uploadedFile, resetImport } = useImport();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  if (status === "PARSING" || status === "VALIDATING") {
    return (
      <Card className="border-border shadow-sm border-dashed bg-muted/5">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <UploadCloud className="h-10 w-10 text-muted-foreground animate-pulse" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {status === "PARSING" ? "Parsing file..." : "Validating records..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Please wait while we process the data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadedFile && status === "REVIEW") {
    return (
      <Card className="border border-border shadow-xs bg-card">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-card rounded-full shadow-2xs border border-border">
              <FileIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetImport} className="gap-2">
            <X className="h-4 w-4" />
            Remove File
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`border-2 border-dashed shadow-xs transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-card"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="p-4 bg-muted/30 rounded-full">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drag and drop your file here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse from your computer</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          className="hidden"
        />
        <Button variant="default" onClick={() => fileInputRef.current?.click()}>
          Browse Files
        </Button>
      </CardContent>
    </Card>
  );
}
