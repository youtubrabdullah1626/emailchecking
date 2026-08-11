"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { ImportRecord, ImportSummary, ImportStatus, ParsedFileResult } from "@/lib/import/ImportService";
import { getImportService } from "@/lib/import/RealImportService";

import { CampaignSequence, SequenceSummaryData } from "@/lib/import/engines/SequenceBuilderEngine";

import { ExecutionQueueItem, QueueSummary } from "@/lib/scheduler/SchedulingTypes";
import { CampaignConfig } from "@/lib/import/engines/ForecastEngine";

import { SessionRecoveryEngine, ImportCheckpoint } from "@/lib/recovery/SessionRecoveryEngine";
import { StorageEngine } from "@/lib/storage/StorageEngine";
import { DiagnosticsEngine, DiagnosticIssue } from "@/lib/diagnostics/DiagnosticsEngine";
import { PerformanceMonitor, PerformanceMetrics } from "@/lib/performance/PerformanceMonitor";

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
  updateQueueItemState: (queueId: string, liveStatus: any, lastEventTime: string) => Promise<void>;
  rescheduleQueueItem: (queueId: string, newDate: string, newTime: string) => Promise<void>;
  deleteQueueItem: (queueId: string) => Promise<void>;
  appendTargetSessionId: string | null;
  setAppendTargetSessionId: (id: string | null) => void;
  undo: () => void;
  canUndo: boolean;
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
  const [appendTargetSessionId, setAppendTargetSessionIdState] = useState<string | null>(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("smart_import_append_target");
    }
    return null;
  });

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
      const { SequenceBuilderEngine } = await import("@/lib/import/engines/SequenceBuilderEngine");
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
      const { SequenceBuilderEngine } = await import("@/lib/import/engines/SequenceBuilderEngine");
      const builder = new SequenceBuilderEngine();
      await new Promise(resolve => setTimeout(resolve, 300));
      const seqResult = builder.buildSequences(recordsRef.current);
      sequencesRef.current = seqResult.sequences;
      setSequenceSummary(seqResult.summary);

      // 3. Fetch Warmup Data
      const { getWarmupService } = await import("@/lib/warmup/WarmupService");
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
      const { SchedulingEngine } = await import("@/lib/scheduler/SchedulingEngine");
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
    // We defer setting status to EXECUTING until AFTER the merge is complete
    // so the LiveExecutionDashboard doesn't mount and read a partial queueRef.
    
    // If appending, we need to merge queues into the TARGET session
    if (appendTargetSessionId) {
      // 1. Load target session heavy data
      const targetData = await recoveryEngine.restoreSession(appendTargetSessionId);
      const targetHeavyData = targetData?.heavyData || {};
      
      // Merge Queue
      const existingQ = targetHeavyData.executionQueue || [];
      const existingIds = new Set(existingQ.map((i: any) => i.queueId));
      const existingQClean = existingQ.map((i: any) => ({ ...i, isNew: false }));
      
      const newUniqueItems = queueRef.current
        .filter(i => !existingIds.has(i.queueId))
        .map(i => ({ ...i, isNew: true }));
        
      const mergedQueue = [...existingQClean, ...newUniqueItems];
      
      // Merge Records
      const existingRecords = targetHeavyData.validatedRecords || [];
      const existingRecEmails = new Set(existingRecords.map((i: any) => i.email));
      const newUniqueRecords = recordsRef.current.filter(i => !existingRecEmails.has(i.email));
      const mergedRecords = [...existingRecords, ...newUniqueRecords];

      // Merge Sequences
      const existingSeq = targetHeavyData.sequences || [];
      const existingSeqIds = new Set(existingSeq.map((i: any) => i.recordId));
      const newUniqueSeq = sequencesRef.current.filter(i => !existingSeqIds.has(i.recordId));
      const mergedSeq = [...existingSeq, ...newUniqueSeq];

      // Recompute summary for target session
      const mergedSummary: QueueSummary = {
        totalItems: mergedQueue.length,
        totalDays: Object.keys(mergedQueue.reduce((acc, item) => ({...acc, [item.scheduledDate]: true}), {})).length,
        startDate: mergedQueue[0]?.scheduledDate || "",
        endDate: mergedQueue[mergedQueue.length - 1]?.scheduledDate || "",
        itemsPerDay: {},
        warmupLimitsHit: []
      };
      
      // IMPORTANT: We must switch the active session BEFORE calling saveCheckpoint!
      const tempSessionId = sessionId;
      await recoveryEngine.restoreSession(appendTargetSessionId);
      setSessionId(appendTargetSessionId);

      // Update in-memory state so the LiveExecutionDashboard shows ALL items
      queueRef.current = mergedQueue;
      recordsRef.current = mergedRecords;
      sequencesRef.current = mergedSeq;
      setQueueSummary(mergedSummary);

      // 2. Save merged data directly to the TARGET session
      await recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
        status: "EXECUTING",
        heavyData: { 
          ...targetHeavyData, 
          executionQueue: mergedQueue,
          validatedRecords: mergedRecords,
          sequences: mergedSeq,
          queueSummary: mergedSummary 
        }
      });
      
      // 3. Delete the temporary continuation session from history
      if (tempSessionId && tempSessionId !== appendTargetSessionId) {
        const storage = new StorageEngine();
        await storage.deleteSession(tempSessionId);
      }
      
      // 4. Clear the append target so future uploads start fresh
      setAppendTargetSessionId(null);
    } else {
      await recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
        status: "EXECUTING"
      });
    }

    // Now that in-memory refs and database are fully merged and saved, 
    // safely trigger the UI transition to mount the Live Execution Dashboard
    setStatus("EXECUTING");
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

  const rescheduleQueueItem = async (queueId: string, newDate: string, newTime: string) => {
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
    setDiagnostics([]);
    setPerformanceMetrics(null);
  };

  const deleteQueueItem = async (queueId: string) => {
    const itemIndex = queueRef.current.findIndex(item => item.queueId === queueId);
    if (itemIndex >= 0) {
      queueRef.current = queueRef.current.filter(item => item.queueId !== queueId);
      await recoveryEngine.saveCheckpoint("EXECUTION_STARTED", {
        status: "EXECUTING",
        heavyData: { executionQueue: queueRef.current, queueSummary: queueSummary! }
      });
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
        updateQueueItemState,
        rescheduleQueueItem,
        deleteQueueItem,
        appendTargetSessionId,
        setAppendTargetSessionId,
        undo,
        canUndo
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
