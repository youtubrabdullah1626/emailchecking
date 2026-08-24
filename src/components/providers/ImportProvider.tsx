"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";
import { ImportRecord, ImportSummary, ImportStatus, ParsedFileResult } from "@/lib/import/ImportService";
import { getImportService } from "@/lib/import/RealImportService";

import { CampaignSequence, SequenceSummaryData, SequenceBuilderEngine } from "@/lib/import/engines/SequenceBuilderEngine";
import { SchedulingEngine } from "@/lib/scheduler/SchedulingEngine";
import { getWarmupService } from "@/lib/warmup/WarmupService";

import { ExecutionQueueItem, QueueSummary } from "@/lib/scheduler/SchedulingTypes";
import { CampaignConfig } from "@/lib/import/engines/ForecastEngine";

import { SessionRecoveryEngine, ImportCheckpoint } from "@/lib/recovery/SessionRecoveryEngine";
import { StorageEngine } from "@/lib/storage/StorageEngine";
import { DiagnosticsEngine, DiagnosticIssue } from "@/lib/diagnostics/DiagnosticsEngine";
import { PerformanceMonitor, PerformanceMetrics } from "@/lib/performance/PerformanceMonitor";

// Bulk import progress — tracks live chunked upload state
export interface BulkImportProgress {
  jobId: string | null;
  campaignId: string | null;
  totalChunks: number;
  chunksLoaded: number;
  totalRows: number;
  successCount: number;
  failureCount: number;
  isComplete: boolean;
  isAborted: boolean;
}

interface ImportContextType {
  status: ImportStatus;
  errorMessage: string | null;
  summary: ImportSummary | null;
  uploadedFile: File | null;
  parsedHeaders: string[];
  mappingConfig: Record<string, string>;
  sequenceSummary: SequenceSummaryData | null;
  queueSummary: QueueSummary | null;
  diagnostics: DiagnosticIssue[];
  performanceMetrics: PerformanceMetrics | null;
  sessionId: string | null;
  bulkProgress: BulkImportProgress | null;
  getRecords: () => ImportRecord[];
  getSequences: () => CampaignSequence[];
  getExecutionQueue: () => ExecutionQueueItem[];
  campaignConfig: CampaignConfig | null;
  setCampaignConfig: React.Dispatch<React.SetStateAction<CampaignConfig | null>>;
  handleFileUpload: (file: File) => Promise<void>;
  updateMapping: (fileHeader: string, schemaKey: string) => void;
  setMappingConfig: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  applyMappingConfig: () => Promise<void>;
  proceedToPlanning: () => void;
  startSequenceBuild: (config: CampaignConfig) => Promise<void>;
  startScheduling: (warmupStatus: any, warmupSettings: any, configOverride?: CampaignConfig, allowDuplicates?: boolean) => Promise<void>;
  fastTrackAppend: () => Promise<void>;
  approveImport: () => Promise<void>;
  resetImport: () => Promise<void>;
  closeSession: () => void;
  runDiagnostics: () => void;
  removeSequencesByEmail: (emails: string[]) => void;
  updateQueueItemState: (queueId: string, liveStatus: any, lastEventTime: string) => Promise<void>;
  rescheduleQueueItem: (queueId: string, newDate: string, newTime: string) => Promise<void>;
  deleteQueueItem: (queueId: string) => Promise<void>;
  appendTargetSessionId: string | null;
  setAppendTargetSessionId: (id: string | null) => void;
  undo: () => void;
  canUndo: boolean;
  openCampaignDashboard: (id: string) => Promise<void>;
}


const recoveryEngine = new SessionRecoveryEngine();
const perfMonitor = new PerformanceMonitor();
const diagEngine = new DiagnosticsEngine();

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ImportStatus>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // State for Mapping Phase
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [mappingConfig, setMappingConfig] = useState<Record<string, string>>({});

  // State for Review Phase
  const recordsRef = React.useRef<ImportRecord[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // State for Sequence Phase (Memory Optimized: Ref holds full array, state holds summary)
  const sequencesRef = React.useRef<CampaignSequence[]>([]);
  const [sequenceSummary, setSequenceSummary] = useState<SequenceSummaryData | null>(null);

  // State for Scheduling Phase (Memory Optimized)
  const queueRef = React.useRef<ExecutionQueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig | null>(null);

  // Phase 15 Enterprise State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticIssue[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);

  // Enterprise Bulk Progress (chunked upload tracking)
  const [bulkProgress, setBulkProgress] = useState<BulkImportProgress | null>(null);
  const CHUNK_SIZE = 500; // 500 sequences per chunk — ultra-fast single payload for most imports
  const [appendTargetSessionId, setAppendTargetSessionIdState] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      const target = sessionStorage.getItem("smart_import_append_target");
      if (target) setAppendTargetSessionIdState(target);
    }
  }, []);

  const setAppendTargetSessionId = (id: string | null) => {
    setAppendTargetSessionIdState(id);
    if (typeof sessionStorage !== "undefined") {
      if (id) {
        sessionStorage.setItem("smart_import_append_target", id);
      } else {
        sessionStorage.removeItem("smart_import_append_target");
      }
    }
  };


  const canUndo = ["MAPPING", "REVIEW", "PLANNING", "PREVIEW", "APPROVED", "EXECUTING"].includes(status);

  const undo = async () => {
    let rollbackCheckpoint: any = null;
    let rollbackStatus: any = null;

    switch (status) {
      case "MAPPING":
        closeSession();
        return;
      case "REVIEW":
        setStatus("MAPPING");
        recordsRef.current = [];
        setSummary(null);
        rollbackCheckpoint = "FILE_UPLOADED";
        rollbackStatus = "DRAFT";
        break;
      case "PLANNING":
        setStatus("REVIEW");
        // No persistent rollback needed since PLANNING is a UI state over VALIDATION_COMPLETED
        break;
      case "PREVIEW":
        setStatus("PLANNING");
        sequencesRef.current = [];
        setSequenceSummary(null);
        rollbackCheckpoint = "VALIDATION_COMPLETED";
        rollbackStatus = "DRAFT";
        break;
      case "APPROVED":
        setStatus("PREVIEW");
        queueRef.current = [];
        setQueueSummary(null);
        rollbackCheckpoint = "SEQUENCE_GENERATED";
        rollbackStatus = "DRAFT";
        break;
      case "EXECUTING":
        setStatus("APPROVED");
        rollbackCheckpoint = "SCHEDULING_COMPLETED";
        rollbackStatus = "APPROVED";
        break;
      default:
        break;
    }

    if (rollbackCheckpoint) {
      await recoveryEngine.saveCheckpoint(rollbackCheckpoint, {
        status: rollbackStatus,
      });
    }
  };



  const importService = getImportService();

  // --- RECOVERY HOOK ---
  React.useEffect(() => {
    const meta = recoveryEngine.getActiveSessionMetadata();
    // Allow all sessions (including ARCHIVED) to be restored so users can "View Details"
    if (meta) {
      recoveryEngine.restoreSession(meta.sessionId).then(data => {
        if (data) {
          setSessionId(meta.sessionId);
          if (data.parsedHeaders) setParsedHeaders(data.parsedHeaders);
          if (data.mappingConfig) setMappingConfig(data.mappingConfig);
          if (data.campaignConfig) setCampaignConfig(data.campaignConfig);
          
          if (data.heavyData?.validatedRecords) recordsRef.current = data.heavyData.validatedRecords;
          if (data.heavyData?.sequences) sequencesRef.current = data.heavyData.sequences;
          if (data.heavyData?.executionQueue) queueRef.current = data.heavyData.executionQueue;
          if (data.heavyData?.queueSummary) setQueueSummary(data.heavyData.queueSummary);
          
          setStatus(data.status);
        }
      });
    }
  }, []);

  const isUploading = React.useRef(false);

  const handleFileUpload = async (file: File) => {
    if (isUploading.current) return;
    isUploading.current = true;
    perfMonitor.startPhase();
    try {
      setErrorMessage(null);
      setStatus("PARSING");
      setUploadedFile(file);
      const parsed = await importService.parseFile(file);
      setParsedHeaders(parsed.headers);
      
      const autoMap = importService.generateAutoMapping(parsed.headers);
      setMappingConfig(autoMap);
      setStatus("MAPPING");
      perfMonitor.endPhase("parsingTimeMs");

      // Phase 15 Checkpoint
      const meta = recoveryEngine.initializeSession(file.name, parsed.rawRows.length);
      setSessionId(meta.sessionId);
      await recoveryEngine.saveCheckpoint("FILE_UPLOADED", {
        status: "MAPPING",
        parsedHeaders: parsed.headers,
        heavyData: { rawRows: parsed.rawRows }
      });

    } catch (error: any) {
      console.error("Parse failed", error);
      setErrorMessage(error.message || "Failed to process file.");
      setStatus("ERROR");
    } finally {
      isUploading.current = false;
    }
  };

  const updateMapping = (fileHeader: string, schemaKey: string) => {
    setMappingConfig(prev => ({
      ...prev,
      [fileHeader]: schemaKey
    }));
  };

  const applyMappingConfig = async () => {
    perfMonitor.startPhase();
    try {
      setStatus("VALIDATING");
      
      let rawRowsToMap: any[] = [];
      
      if (uploadedFile) {
        const parsed = await importService.parseFile(uploadedFile);
        rawRowsToMap = parsed.rawRows;
      } else if (sessionId) {
        // If uploadedFile is null (e.g. after a page reload), fetch the original rawRows from the recovery engine
        const sessionData = await recoveryEngine.restoreSession(sessionId);
        if (sessionData && sessionData.heavyData && sessionData.heavyData.rawRows) {
          rawRowsToMap = sessionData.heavyData.rawRows;
        } else {
          throw new Error("Session data lost: Original file is missing. Please restart the import.");
        }
      } else {
        throw new Error("Invalid state: No file or session found.");
      }

      const mapped = importService.applyMapping(rawRowsToMap, mappingConfig);
      
      const { validatedRecords, summary } = await importService.validateRecords(mapped);
      recordsRef.current = validatedRecords;
      setSummary(summary);
      setStatus("REVIEW");
      perfMonitor.endPhase("mappingTimeMs");

      // Phase 15 Checkpoint
      await recoveryEngine.saveCheckpoint("VALIDATION_COMPLETED", {
        status: "REVIEW",
        mappingConfig,
        heavyData: { validatedRecords }
      });

    } catch (error: any) {
      console.error("Mapping/Validation failed", error);
      setErrorMessage(error.message || "Mapping failed");
      setStatus("ERROR");
      throw error;
    }
  };

  const proceedToPlanning = () => {
    setStatus("PLANNING");
  };

  const getRecords = () => recordsRef.current;
  const getSequences = () => sequencesRef.current;
  const getExecutionQueue = () => queueRef.current;

  const startSequenceBuild = async (config: CampaignConfig) => {
    perfMonitor.startPhase();
    try {
      setCampaignConfig(config);
      setStatus("BUILDING");
      const builder = new SequenceBuilderEngine();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = builder.buildSequences(recordsRef.current);
      sequencesRef.current = result.sequences;
      setSequenceSummary(result.summary);
      
      setStatus("PREVIEW");
      perfMonitor.endPhase("sequenceGenTimeMs");

      // Phase 15 Checkpoint
      await recoveryEngine.saveCheckpoint("SEQUENCE_GENERATED", {
        status: "PREVIEW",
        campaignConfig: config,
        heavyData: { sequences: result.sequences }
      });

    } catch (error: any) {
      console.error("Sequence build failed", error);
      setErrorMessage(error.message || "Sequence generation failed");
      setStatus("ERROR");
      throw error;
    }
  };

  const fastTrackAppend = async () => {
    if (!appendTargetSessionId) return;
    perfMonitor.startPhase();
    try {
      // 1. Get Target Config
      const targetData = await recoveryEngine.restoreSession(appendTargetSessionId);
      if (!targetData || !targetData.campaignConfig) throw new Error("Target campaign configuration not found.");
      const config = targetData.campaignConfig;
      setCampaignConfig(config);

      // Restore active session back to the temporary one so we don't overwrite target data during sequence/schedule gen
      if (sessionId) {
        await recoveryEngine.restoreSession(sessionId);
      }

      // 2. Build Sequences
      setStatus("BUILDING");
      const builder = new SequenceBuilderEngine();
      await new Promise(resolve => setTimeout(resolve, 300));
      const seqResult = builder.buildSequences(recordsRef.current);
      sequencesRef.current = seqResult.sequences;
      setSequenceSummary(seqResult.summary);

      // 3. Fetch Warmup Data
      const warmupService = getWarmupService();
      const [wSettings, wStatus] = await Promise.all([
        warmupService.getSettings(),
        warmupService.getStatus()
      ]);

      // 4. Start Scheduling
      await startScheduling(wStatus, wSettings, config);
      
      perfMonitor.endPhase("fastTrackAppendTimeMs");
    } catch (error: any) {
      console.error("Fast track append failed", error);
      setErrorMessage(error.message || "Fast track append failed");
      setStatus("ERROR");
    }
  };

  const startScheduling = async (warmupStatus: any, warmupSettings: any, configOverride?: CampaignConfig, allowDuplicates: boolean = false) => {
    const activeConfig = configOverride || campaignConfig;
    if (!activeConfig) return;
    perfMonitor.startPhase();
    try {
      setStatus("SCHEDULING");
      const engine = new SchedulingEngine();

      queueRef.current = [];
      const summary: QueueSummary = {
        totalItems: 0,
        totalDays: 0,
        startDate: "",
        endDate: "",
        itemsPerDay: {},
        warmupLimitsHit: []
      };

      // If appending, load the existing heavy dataset to get the existing queue
      let existingQueue: ExecutionQueueItem[] = [];
      let finalCampaignId = "campaign_" + Date.now();

      if (appendTargetSessionId) {
        const existingData = await recoveryEngine.restoreSession(appendTargetSessionId);
        if (existingData?.heavyData?.executionQueue) {
          existingQueue = existingData.heavyData.executionQueue;
          finalCampaignId = existingQueue[0]?.campaignId || finalCampaignId;
        }
        // Restore active session back to the temporary one so we don't overwrite target data when saving the scheduling checkpoint
        if (sessionId) {
          await recoveryEngine.restoreSession(sessionId);
        }
      }

      // Compile Global Queue for capacity, deduplication, and timestamp staggering
      const allSessions = recoveryEngine.getAllSessions();
      let globalQueue: ExecutionQueueItem[] = [];
      
      for (const session of allSessions) {
        if (session.status === "EXECUTING") {
           // Skip if this is the append target, as it's already in existingQueue
           if (session.sessionId === appendTargetSessionId) continue;
           
           const sessionData = await recoveryEngine.restoreSession(session.sessionId);
           if (sessionData?.heavyData?.executionQueue) {
             globalQueue = globalQueue.concat(sessionData.heavyData.executionQueue);
           }
        }
      }
      
      // Restore active session back again just in case the above restores overwrote the active reference
      if (sessionId) {
        await recoveryEngine.restoreSession(sessionId);
      }

      const generator = engine.generateSchedule(
        finalCampaignId,
        sequencesRef.current,
        activeConfig,
        warmupStatus,
        warmupSettings,
        existingQueue,
        globalQueue,
        allowDuplicates
      );

      let result = generator.next();
      while (!result.done) {
        if (result.value) {
          const { date, items, isWarmupThrottled, existingQueueMetrics } = result.value;
          
          if (existingQueueMetrics && !summary.existingQueueMetrics) {
            summary.existingQueueMetrics = existingQueueMetrics;
          }

          if (items.length > 0) {
            queueRef.current.push(...items);
            summary.totalItems += items.length;
            summary.totalDays++;
            summary.itemsPerDay[date] = items.length;
            if (!summary.startDate) summary.startDate = date;
            summary.endDate = date;
            if (isWarmupThrottled) {
              summary.warmupLimitsHit.push(date);
            }
          }
        }
        result = generator.next();
      }

      if (!summary.existingQueueMetrics && existingQueue.length > 0) {
        summary.existingQueueMetrics = {
          totalExistingScheduled: existingQueue.length,
          skippedDuplicates: 0
        };
      }

      setQueueSummary(summary);
      setStatus("APPROVED");
      perfMonitor.endPhase("schedulingTimeMs");
      perfMonitor.setMemoryEstimate(recordsRef.current.length, sequencesRef.current.length, queueRef.current.length);
      setPerformanceMetrics(perfMonitor.getMetrics());

      // Phase 15 Checkpoint
      await recoveryEngine.saveCheckpoint("SCHEDULING_COMPLETED", {
        status: "APPROVED",
        heavyData: { executionQueue: queueRef.current, queueSummary: summary }
      });
    } catch (error: any) {
      console.error("Scheduling failed", error);
      setErrorMessage(error.message || "Scheduling failed");
      setStatus("ERROR");
      throw error;
    }
  };

  const runDiagnostics = () => {
    const issues = diagEngine.runDiagnostics(
      mappingConfig,
      recordsRef.current,
      sequencesRef.current,
      queueRef.current
    );
    setDiagnostics(issues);
  };

  const approveImport = async () => {
    perfMonitor.startPhase();
    const sequences = sequencesRef.current || [];
    const executionQueue = queueRef.current || [];
    const totalRows = Math.max(1, sequences.length > 0 ? sequences.length : (recordsRef.current?.length || 1));

    // Dynamic chunk sizing — safe up to 3.5MB payload
    const MAX_SAFE_PAYLOAD_BYTES = 3_500_000;
    const MIN_CHUNK_SIZE = 50;
    let dynamicChunkSize = CHUNK_SIZE;
    if (sequences.length > 0) {
      try {
        const sampleCount = Math.min(5, sequences.length);
        const sampleSeqs = sequences.slice(0, sampleCount);
        const sampleIds = new Set(sampleSeqs.map((s: any) => s.recordId));
        const sampleQueue = executionQueue.filter((q: any) => sampleIds.has(q.recordId));
        const sampleBytes = new TextEncoder().encode(
          JSON.stringify({ sequences: sampleSeqs, executionQueue: sampleQueue })
        ).length;
        const bytesPerRow = sampleBytes / sampleCount;
        const calculated = Math.floor(MAX_SAFE_PAYLOAD_BYTES / bytesPerRow);
        dynamicChunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(CHUNK_SIZE, calculated));
      } catch { dynamicChunkSize = 250; }
    }
    const totalChunks = Math.max(1, Math.ceil(totalRows / dynamicChunkSize));

    try {
      // ── PHASE 1: Create the job + campaign in the DB (Resilient Retry) ───────
      let jobRes: Response | null = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          jobRes = await fetch("/api/smart-import/create-job", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: uploadedFile?.name || "bulk-import.pdf",
              totalRows,
              campaignName: uploadedFile?.name?.replace(/\.[^/.]+$/, "") || "Smart Import Campaign",
              chunksTotal: totalChunks,
            })
          });
          if (jobRes.ok) break;
          // Retry on 502/503 or transient 401 during server restart
          if (jobRes.status >= 500 || jobRes.status === 401) {
            await new Promise(r => setTimeout(r, 600 * attempt));
          } else {
            break;
          }
        } catch (err) {
          lastErr = err;
          await new Promise(r => setTimeout(r, 600 * attempt));
        }
      }

      if (!jobRes || !jobRes.ok) {
        const e = jobRes ? await jobRes.json().catch(() => ({})) : {};
        if (jobRes?.status === 401) {
          throw new Error("Your session expired. Please refresh the page to continue.");
        }
        throw new Error(e.error || lastErr?.message || "Failed to initialize import session. Please try again.");
      }

      const { jobId, campaignId } = await jobRes.json();

      // Initialize live progress state
      const progress: BulkImportProgress = {
        jobId, campaignId, totalChunks, chunksLoaded: 0,
        totalRows, successCount: 0, failureCount: 0,
        isComplete: false, isAborted: false,
      };
      setBulkProgress({ ...progress });

      // ── PHASE 2: Parallel Chunk Upload (Blazing Fast) ───────────────────────
      const chunkUploadPromises = Array.from({ length: totalChunks }, async (_, i) => {
        const start = i * dynamicChunkSize;
        const chunkSequences = sequences.slice(start, start + dynamicChunkSize);
        const chunkIds = new Set(chunkSequences.map((s: any) => s.recordId));
        const chunkQueue = executionQueue.filter((q: any) => chunkIds.has(q.recordId));

        let chunkRes: Response | null = null;
        for (let chunkAttempt = 1; chunkAttempt <= 2; chunkAttempt++) {
          try {
            chunkRes = await fetch("/api/smart-import/upload-chunk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jobId,
                chunkIndex: i,
                totalChunks,
                campaignId,
                sequences: chunkSequences,
                executionQueue: chunkQueue,
              })
            });
            if (chunkRes.ok) break;
            if (chunkRes.status >= 500) {
              await new Promise(r => setTimeout(r, 500 * chunkAttempt));
            }
          } catch {
            await new Promise(r => setTimeout(r, 500 * chunkAttempt));
          }
        }

        if (!chunkRes || !chunkRes.ok) {
          const e = chunkRes ? await chunkRes.json().catch(() => ({})) : {};
          console.error(`[import] Chunk ${i} failed:`, e.error);
          progress.failureCount += chunkSequences.length;
        } else {
          const result = await chunkRes.json();
          progress.successCount += result.saved || 0;
          progress.failureCount += result.failed || 0;
        }


        progress.chunksLoaded += 1;
        setBulkProgress({ ...progress });
      });

      await Promise.all(chunkUploadPromises);

      // ── PHASE 3: Mark complete & bind authoritative campaign ID ───────────────
      progress.isComplete = true;
      perfMonitor.endPhase("handoffTimeMs");

      if (typeof window !== "undefined") {
        localStorage.setItem("silaer_active_campaign_id", campaignId);
      }

      // Save checkpoint asynchronously (non-blocking for UI)
      if (sessionId) {
        recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
          status: "EXECUTING",
          heavyData: { campaignId, executionQueue }
        }).catch(() => {});
        setSessionId(null);
      }

      setBulkProgress(null);
      // Switch to EXECUTING instantly
      setStatus("EXECUTING");
      toast.success("Campaign launched successfully!", {
        description: `${progress.successCount || totalRows} contacts saved — dispatching emails now...`,
        duration: 4000,
      });

      // ── PHASE 4: Immediately trigger scheduler so due steps go NOW ────────────
      fetch("/api/scheduler/run", { method: "POST" }).catch(() => {});

    } catch (error: any) {
      console.error("[approveImport] Failed:", error);
      setErrorMessage(error.message || "Failed to start import.");
      setStatus("ERROR");
      setBulkProgress(null);
    }
  };


  const updateQueueItemState = async (queueId: string, liveStatus: any, lastEventTime: string) => {
    let updated = false;
    queueRef.current = queueRef.current.map(item => {
      if (item.queueId === queueId) {
        updated = true;
        return { ...item, liveStatus, lastEventTime };
      }
      return item;
    });

    if (updated) {
      // Re-save checkpoint to persist the updated queue status
      await recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
        status: "EXECUTING",
        heavyData: { executionQueue: queueRef.current, queueSummary: queueSummary! }
      });
    }
  };

  const rescheduleQueueItem = async (queueId: string, newDate: string, newTime: string, stepId?: string) => {
    let updated = false;
    queueRef.current = queueRef.current.map(item => {
      if (item.queueId === queueId) {
        updated = true;
        return { ...item, scheduledDate: newDate, scheduledTime: newTime };
      }
      return item;
    });

    if (updated) {
      await recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
        status: "EXECUTING",
        heavyData: { executionQueue: queueRef.current, queueSummary: queueSummary! }
      });

      // Synchronize with backend database
      fetch("/api/steps/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          queueId,
          newDate,
          newTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      }).catch(() => {});
    }
  };

  const resetImport = async () => {
    await recoveryEngine.abandonSession();
    closeSession();
  };

  const closeSession = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("smart_import_active_session_id");
      sessionStorage.removeItem("smart_import_append_target");
    }
    setSessionId(null);
    setAppendTargetSessionId(null);
    setStatus("IDLE");
    setErrorMessage(null);
    setUploadedFile(null);
    setParsedHeaders([]);
    setMappingConfig({});
    recordsRef.current = [];
    sequencesRef.current = [];
    queueRef.current = [];
    setSummary(null);
    setQueueSummary(null);
    setDiagnostics([]);
    setPerformanceMetrics(null);
    setBulkProgress(null);
  };

  const removeSequencesByEmail = (emailsToRemove: string[]) => {
    if (!emailsToRemove || emailsToRemove.length === 0) return;
    
    const emailSet = new Set(emailsToRemove.map(e => e.toLowerCase()));
    
    // Filter out sequences
    sequencesRef.current = sequencesRef.current.filter(seq => {
      return !emailSet.has(seq.recipientEmail.toLowerCase());
    });
    
    // Filter out records just in case
    recordsRef.current = recordsRef.current.filter(rec => {
      const anyRec = rec as any;
      const email = anyRec['Email'] || anyRec['email'] || anyRec['Email Address'] || anyRec['email_address'];
      if (!email) return true;
      return !emailSet.has(email.toLowerCase());
    });
    
    // Note: We don't filter queueRef here because startScheduling() must be called again
    // to rebuild the queue based on the new sequencesRef and warmup limits!
    // The UI should call startScheduling() after calling this.
  };

  const deleteQueueItem = async (queueId: string, stepId?: string) => {
    const itemIndex = queueRef.current.findIndex(item => item.queueId === queueId);
    if (itemIndex >= 0) {
      queueRef.current = queueRef.current.filter(item => item.queueId !== queueId);
      await recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
        status: "EXECUTING",
        heavyData: { executionQueue: queueRef.current, queueSummary: queueSummary! }
      });

      // Synchronize with backend database
      fetch("/api/steps/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, queueId })
      }).catch(() => {});
    }
  };

  const openCampaignDashboard = async (targetSessionId: string) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("smart_import_active_session_id", targetSessionId);
    }
    try {
      const data = await recoveryEngine.restoreSession(targetSessionId).catch(() => null);
      if (data) {
        setSessionId(targetSessionId);
        if (data.parsedHeaders) setParsedHeaders(data.parsedHeaders);
        if (data.mappingConfig) setMappingConfig(data.mappingConfig);
        if (data.campaignConfig) setCampaignConfig(data.campaignConfig);
        if (data.heavyData?.validatedRecords) recordsRef.current = data.heavyData.validatedRecords;
        if (data.heavyData?.sequences) sequencesRef.current = data.heavyData.sequences;
        if (data.heavyData?.executionQueue) queueRef.current = data.heavyData.executionQueue;
        if (data.heavyData?.queueSummary) setQueueSummary(data.heavyData.queueSummary);
      }
      setStatus("EXECUTING");
    } catch {
      setStatus("EXECUTING");
    }
  };

  return (

    <ImportContext.Provider
      value={{
        status,
        errorMessage,
        summary,
        uploadedFile,
        parsedHeaders,
        mappingConfig,
        sequenceSummary,
        queueSummary,
        diagnostics,
        performanceMetrics,
        sessionId,
        bulkProgress,
        getRecords,
        getSequences,
        getExecutionQueue,
        campaignConfig,
        setCampaignConfig,
        handleFileUpload,
        updateMapping,
        setMappingConfig,
        applyMappingConfig,
        proceedToPlanning,
        startSequenceBuild,
        startScheduling,
        fastTrackAppend,
        approveImport,
        resetImport,
        closeSession,
        runDiagnostics,
        removeSequencesByEmail,
        updateQueueItemState,
        rescheduleQueueItem,
        deleteQueueItem,
        appendTargetSessionId,
        setAppendTargetSessionId,
        undo,
        canUndo,
        openCampaignDashboard
      }}
    >
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error("useImport must be used within an ImportProvider");
  }
  return context;
}
