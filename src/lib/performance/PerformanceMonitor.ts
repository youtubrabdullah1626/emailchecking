export interface PerformanceMetrics {
  parsingTimeMs: number;
  mappingTimeMs: number;
  validationTimeMs: number;
  sequenceGenTimeMs: number;
  schedulingTimeMs: number;
  fastTrackAppendTimeMs: number;
  handoffTimeMs: number;
  totalTimeMs: number;
  memoryEstimateMB: number;
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private startTime: number = 0;

  public startPhase() {
    this.startTime = performance.now();
  }

  public endPhase(phase: keyof PerformanceMetrics) {
    if (this.startTime > 0) {
      this.metrics[phase] = performance.now() - this.startTime;
      this.startTime = 0;
    }
  }

  public setMemoryEstimate(recordsCount: number, sequencesCount: number, queueCount: number) {
    // Rough enterprise approximations:
    // Raw Record ~ 200 bytes
    // Sequence Object ~ 500 bytes
    // Queue Item ~ 300 bytes
    const bytes = (recordsCount * 200) + (sequencesCount * 500) + (queueCount * 300);
    this.metrics.memoryEstimateMB = Math.round((bytes / 1024 / 1024) * 100) / 100;
  }

  public getMetrics(): PerformanceMetrics {
    const total = 
      (this.metrics.parsingTimeMs || 0) +
      (this.metrics.mappingTimeMs || 0) +
      (this.metrics.validationTimeMs || 0) +
      (this.metrics.sequenceGenTimeMs || 0) +
      (this.metrics.schedulingTimeMs || 0);

    return {
      parsingTimeMs: this.metrics.parsingTimeMs || 0,
      mappingTimeMs: this.metrics.mappingTimeMs || 0,
      validationTimeMs: this.metrics.validationTimeMs || 0,
      sequenceGenTimeMs: this.metrics.sequenceGenTimeMs || 0,
      schedulingTimeMs: this.metrics.schedulingTimeMs || 0,
      fastTrackAppendTimeMs: this.metrics.fastTrackAppendTimeMs || 0,
      handoffTimeMs: this.metrics.handoffTimeMs || 0,
      totalTimeMs: total,
      memoryEstimateMB: this.metrics.memoryEstimateMB || 0,
    };
  }
}
