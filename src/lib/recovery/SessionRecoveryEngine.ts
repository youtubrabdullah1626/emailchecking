import { StorageEngine, ImportSessionMetadata, HeavyDataset } from "@/lib/storage/StorageEngine";
import { ImportStatus } from "@/lib/import/ImportService";
import { CampaignConfig } from "@/lib/import/engines/ForecastEngine";

export type { ImportSessionMetadata };

export type ImportCheckpoint = 
  | "INIT" 
  | "FILE_UPLOADED" 
  | "MAPPING_COMPLETED" 
  | "VALIDATION_COMPLETED" 
  | "PLANNING_COMPLETED" 
  | "SEQUENCE_GENERATED" 
  | "SCHEDULING_COMPLETED"
  | "EXECUTION_STARTED"
  | "PAUSED"
  | "COMPLETED";

export interface CheckpointData {
  status: ImportStatus;
  parsedHeaders?: string[];
  mappingConfig?: Record<string, string>;
  campaignConfig?: CampaignConfig | null;
  heavyData?: Partial<HeavyDataset>;
}

export class SessionRecoveryEngine {
  private storage = new StorageEngine();
  private currentSessionId: string | null = null;

  public initializeSession(fileName: string, totalRecords: number): ImportSessionMetadata {
    this.currentSessionId = `session_${Date.now()}`;
    const meta: ImportSessionMetadata = {
      sessionId: this.currentSessionId,
      campaignName: "Draft Campaign",
      fileName,
      importDate: new Date().toISOString(),
      status: "DRAFT",
      lastCheckpoint: "INIT",
      totalRecords,
      validRecords: 0,
      duplicateRecords: 0,
      estimatedCompletion: null,
      storageSizeEstimateBytes: 0,
    };
    this.storage.saveSessionMetadata(meta);
    return meta;
  }

  public getAllSessions(): ImportSessionMetadata[] {
    return this.storage.getAllSessions();
  }

  public getActiveSessionMetadata(): ImportSessionMetadata | null {
    const id = this.storage.getActiveSessionId();
    if (!id) return null;
    const sessions = this.storage.getAllSessions();
    return sessions.find(s => s.sessionId === id) || null;
  }

  public async saveCheckpoint(checkpoint: ImportCheckpoint, data: CheckpointData): Promise<void> {
    const meta = this.getActiveSessionMetadata();
    if (!meta) return;

    try {
      // Save HeavyData to IndexedDB atomically FIRST
      if (data.heavyData) {
        await this.storage.saveHeavyDataset(meta.sessionId, data.heavyData);
      }

      // If IndexedDB write succeeds (or was skipped), advance the pointer
      meta.lastCheckpoint = checkpoint;
      if (data.status === "APPROVED") meta.status = "COMPLETED";
      else if (data.status === "EXECUTING") meta.status = "EXECUTING";
      else meta.status = "DRAFT";
      
      if (data.heavyData?.queueSummary?.endDate) {
        meta.estimatedCompletion = data.heavyData.queueSummary.endDate;
      }
      
      this.storage.saveSessionMetadata(meta);

      // Save lightweight config to localStorage under a specific session key
      if (data.parsedHeaders) {
        localStorage.setItem(`session_${meta.sessionId}_headers`, JSON.stringify(data.parsedHeaders));
      }
      if (data.mappingConfig) {
        localStorage.setItem(`session_${meta.sessionId}_mapping`, JSON.stringify(data.mappingConfig));
      }
      if (data.campaignConfig) {
        if (data.campaignConfig.campaignName) {
          meta.campaignName = data.campaignConfig.campaignName;
          this.storage.saveSessionMetadata(meta);
        }
        localStorage.setItem(`session_${meta.sessionId}_config`, JSON.stringify(data.campaignConfig));
      }
    } catch (err) {
      console.error("Critical Checkpoint Failure: Aborted saving state to prevent corruption.", err);
      // We do not advance the pointer. The session remains at the previous valid checkpoint.
    }
  }

  public async restoreSession(sessionId: string): Promise<CheckpointData | null> {
    const sessions = this.storage.getAllSessions();
    const meta = sessions.find(s => s.sessionId === sessionId);
    if (!meta) return null;

    this.currentSessionId = sessionId;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("smart_import_active_session_id", sessionId);
    }

    // Rehydrate Lightweight Config
    const headersStr = localStorage.getItem(`session_${sessionId}_headers`);
    const mappingStr = localStorage.getItem(`session_${sessionId}_mapping`);
    const configStr = localStorage.getItem(`session_${sessionId}_config`);

    const parsedHeaders = headersStr ? JSON.parse(headersStr) : [];
    const mappingConfig = mappingStr ? JSON.parse(mappingStr) : {};
    const campaignConfig = configStr ? JSON.parse(configStr) : null;

    // Rehydrate Heavy Data
    const heavyData = await this.storage.loadHeavyDataset(sessionId);

    // Map Checkpoint to Status (simple recovery logic)
    let status: ImportStatus = "IDLE";
    switch (meta.lastCheckpoint) {
      case "FILE_UPLOADED": status = "MAPPING"; break;
      case "MAPPING_COMPLETED": status = "VALIDATING"; break; // Mid-flight mapping
      case "VALIDATION_COMPLETED": status = "REVIEW"; break;
      case "PLANNING_COMPLETED": status = "BUILDING"; break;
      case "SEQUENCE_GENERATED": status = "PREVIEW"; break;
      case "SCHEDULING_COMPLETED": status = "APPROVED"; break;
      case "EXECUTION_STARTED": status = "EXECUTING"; break;
      case "PAUSED": status = "EXECUTING"; break;
      case "COMPLETED": status = "EXECUTING"; break;
    }

    if (["PAUSED", "EXECUTING", "COMPLETED"].includes(meta.status as string)) {
      status = "EXECUTING";
    }

    return {
      status,
      parsedHeaders,
      mappingConfig,
      campaignConfig,
      heavyData: heavyData || {},
    };
  }

  public async abandonSession(): Promise<void> {
    const id = this.storage.getActiveSessionId();
    if (id) {
      const meta = this.getActiveSessionMetadata();
      // If the session was never launched into live execution, completely purge it so it doesn't pollute history or create ghost drafts
      if (meta && meta.lastCheckpoint !== "EXECUTION_STARTED" && meta.status !== "COMPLETED") {
        await this.storage.deleteSession(id).catch(() => {});
      } else {
        this.storage.clearActiveSession();
      }
      this.currentSessionId = null;
    }
  }
}
