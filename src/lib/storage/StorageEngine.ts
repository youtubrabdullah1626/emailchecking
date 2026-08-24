export interface ImportSessionMetadata {
  sessionId: string;
  campaignName: string;
  fileName: string;
  importDate: string;
  status: "DRAFT" | "COMPLETED" | "FAILED" | "ARCHIVED" | "EXECUTING" | "PAUSED";
  lastCheckpoint: string;
  totalRecords: number;
  validRecords: number;
  duplicateRecords: number;
  estimatedCompletion: string | null;
  storageSizeEstimateBytes: number;
}

export interface HeavyDataset {
  sessionId: string;
  campaignId?: string;
  rawRows?: any[];
  validatedRecords?: any[];
  sequences?: any[];
  executionQueue?: any[];
  queueSummary?: any;
}

const DB_NAME = "SmartLeadImportDB";
const DB_VERSION = 2; // Upgraded for chunked storage
const HEAVY_STORE = "heavyDatasets";
const CHUNK_STORE = "heavyChunks";

export class StorageEngine {
  private db: IDBDatabase | null = null;
  public isFallbackMode = false;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.isFallbackMode) throw new Error("Storage is in fallback mode");
    
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
          this.isFallbackMode = true;
          reject(new Error("IndexedDB connection failed"));
        };
        
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(HEAVY_STORE)) {
            db.createObjectStore(HEAVY_STORE, { keyPath: "sessionId" });
          }
          if (!db.objectStoreNames.contains(CHUNK_STORE)) {
            db.createObjectStore(CHUNK_STORE, { keyPath: "chunkId" });
          }
        };
      } catch (e) {
        this.isFallbackMode = true;
        reject(new Error("IndexedDB access denied (Private Browsing)"));
      }
    });
  }

  // --- Hybrid Approach: Metadata in LocalStorage, Heavy Data in IndexedDB ---

  public saveSessionMetadata(metadata: ImportSessionMetadata): void {
    const sessions = this.getAllSessions();
    const index = sessions.findIndex(s => s.sessionId === metadata.sessionId);
    if (index >= 0) {
      sessions[index] = metadata;
    } else {
      sessions.push(metadata);
    }
    localStorage.setItem("smart_import_sessions", JSON.stringify(sessions));
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("smart_import_active_session_id", metadata.sessionId);
    }
  }

  public getAllSessions(): ImportSessionMetadata[] {
    try {
      const data = localStorage.getItem("smart_import_sessions");
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public getActiveSessionId(): string | null {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem("smart_import_active_session_id");
  }

  public clearActiveSession(): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("smart_import_active_session_id");
    }
  }

  // --- IndexedDB for Heavy Payloads (Chunked Architecture) ---

  private readonly CHUNK_SIZE = 25000;

  public async saveHeavyDataset(sessionId: string, data: Partial<HeavyDataset>): Promise<void> {
    if (this.isFallbackMode) return Promise.reject(new Error("Fallback mode"));
    const db = await this.getDB();
    
    // Process large arrays into chunks
    const chunkReferences: Record<string, number> = {};
    const transaction = db.transaction([HEAVY_STORE, CHUNK_STORE], "readwrite");
    const mainStore = transaction.objectStore(HEAVY_STORE);
    const chunkStore = transaction.objectStore(CHUNK_STORE);

    return new Promise((resolve, reject) => {
      // 1. Get existing to merge
      const getReq = mainStore.get(sessionId);
      
      getReq.onsuccess = () => {
        const existing = getReq.result || { sessionId };
        const merged = { ...existing, ...data };
        
        // 2. Extract arrays and chunk them
        for (const key of ["rawRows", "validatedRecords", "sequences", "executionQueue"] as const) {
          if (Array.isArray(merged[key]) && merged[key]!.length > this.CHUNK_SIZE) {
            const arr = merged[key]!;
            const totalChunks = Math.ceil(arr.length / this.CHUNK_SIZE);
            chunkReferences[key] = totalChunks;
            
            for (let i = 0; i < totalChunks; i++) {
              const chunkData = arr.slice(i * this.CHUNK_SIZE, (i + 1) * this.CHUNK_SIZE);
              chunkStore.put({ chunkId: `${sessionId}_${key}_${i}`, data: chunkData });
            }
            // Remove the raw array from the main record so it doesn't blow up the main store
            merged[key] = null;
          }
        }
        
        // Save chunk references
        merged.chunkReferences = { ...(merged.chunkReferences || {}), ...chunkReferences };
        
        mainStore.put(merged);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error("Failed to write heavy dataset transaction"));
        transaction.onabort = () => reject(new Error("Transaction aborted (possible QuotaExceeded)"));
      };
      
      getReq.onerror = () => reject(new Error("Failed to read heavy dataset for merge"));
    });
  }

  public async loadHeavyDataset(sessionId: string): Promise<HeavyDataset | null> {
    if (this.isFallbackMode) return null;
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([HEAVY_STORE, CHUNK_STORE], "readonly");
      const mainStore = transaction.objectStore(HEAVY_STORE);
      const chunkStore = transaction.objectStore(CHUNK_STORE);
      
      const req = mainStore.get(sessionId);
      
      req.onsuccess = async () => {
        const result = req.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Reassemble chunks
        if (result.chunkReferences) {
          for (const [key, totalChunks] of Object.entries(result.chunkReferences)) {
            result[key] = [];
            for (let i = 0; i < (totalChunks as number); i++) {
              await new Promise<void>((resChunk, rejChunk) => {
                const chunkReq = chunkStore.get(`${sessionId}_${key}_${i}`);
                chunkReq.onsuccess = () => {
                  if (chunkReq.result && chunkReq.result.data) {
                    result[key].push(...chunkReq.result.data);
                  }
                  resChunk();
                };
                chunkReq.onerror = () => rejChunk();
              });
            }
          }
        }
        
        resolve(result as HeavyDataset);
      };
      req.onerror = () => reject(new Error("Failed to load heavy dataset"));
    });
  }

  public deleteSessionSync(sessionId: string): void {
    const sessions = this.getAllSessions().filter(s => s.sessionId !== sessionId);
    localStorage.setItem("smart_import_sessions", JSON.stringify(sessions));
    if (this.getActiveSessionId() === sessionId) {
      this.clearActiveSession();
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    // 1. Remove from localStorage
    this.deleteSessionSync(sessionId);

    // 2. Remove from IndexedDB

    if (this.isFallbackMode) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([HEAVY_STORE, CHUNK_STORE], "readwrite");
      const store = transaction.objectStore(HEAVY_STORE);
      
      // 1. Get the session FIRST to read chunkReferences
      const getReq = store.get(sessionId);
      
      getReq.onsuccess = () => {
         const result = getReq.result;
         if (result && result.chunkReferences) {
           for (const [key, totalChunks] of Object.entries(result.chunkReferences)) {
             for (let i = 0; i < (totalChunks as number); i++) {
               transaction.objectStore(CHUNK_STORE).delete(`${sessionId}_${key}_${i}`);
             }
           }
         }
         
         // 2. Now delete the main record
         store.delete(sessionId);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Failed to delete heavy dataset transaction"));
    });
  }

  public async clearAllSessions(cutoffDate?: Date): Promise<void> {
    const all = this.getAllSessions();
    const toDelete = cutoffDate
      ? all.filter(s => new Date(s.importDate).getTime() >= cutoffDate.getTime())
      : all;

    for (const session of toDelete) {
      await this.deleteSession(session.sessionId).catch(() => {});
    }

    if (!cutoffDate || toDelete.length === all.length) {
      localStorage.removeItem("smart_import_sessions");
      localStorage.removeItem("silaer_active_campaign_id");
      this.clearActiveSession();
    }
  }
}
