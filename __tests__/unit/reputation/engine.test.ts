import { evaluateSafety } from '@/lib/reputation/engine';
import { RecommendationType, SafetyValidationError } from '@/lib/reputation/types';
import { TestFactories } from '../../utils/factories';

describe('Safety & Reputation Protection Engine (Phase 5)', () => {
  it('defaults to SAFE when metrics are below thresholds', () => {
    const context = TestFactories.createSafetyContext();
    const result = evaluateSafety(context);
    
    expect(result.recommendation).toBe(RecommendationType.SAFE);
    expect(result.reasons.length).toBe(0);
  });

  it('escalates to PAUSE on high bounce rate', () => {
    const context = TestFactories.createSafetyContext({
      hardBouncesToday: 10,
      sentToday: 100 // 10% bounce rate, max is 5%
    });
    
    const result = evaluateSafety(context);
    
    expect(result.recommendation).toBe(RecommendationType.PAUSE);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'HARD_BOUNCE_LIMIT' })
      ])
    );
  });

  it('escalates to PAUSE on high complaint rate', () => {
    const context = TestFactories.createSafetyContext({
      complaintsToday: 2,
      sentToday: 100 // 2% complaint rate, max is 1%
    });
    
    const result = evaluateSafety(context);
    
    expect(result.recommendation).toBe(RecommendationType.PAUSE);
  });

  it('recommends AUTO_RESUME_ALLOWED if currently paused and constraints clear', () => {
    const context = TestFactories.createSafetyContext({
      currentStatus: 'PAUSED'
    });
    
    const result = evaluateSafety(context);
    
    expect(result.recommendation).toBe(RecommendationType.AUTO_RESUME_ALLOWED);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AUTO_RESUME_ALLOWED' })
      ])
    );
  });

  it('recommends REMAIN_PAUSED if currently paused and constraints persist', () => {
    const context = TestFactories.createSafetyContext({
      currentStatus: 'PAUSED',
      hardBouncesToday: 10,
      sentToday: 100 // Failing rule
    });
    
    const result = evaluateSafety(context);
    
    expect(result.recommendation).toBe(RecommendationType.REMAIN_PAUSED);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'HARD_BOUNCE_LIMIT' })
      ])
    );
  });

  it('throws validation error on impossible config (Fail-fast)', () => {
    const context = TestFactories.createSafetyContext({
      config: TestFactories.createSafetyConfig({ maxHardBounceRate: 2 }) // > 1 is invalid
    });
    
    expect(() => evaluateSafety(context)).toThrow(SafetyValidationError);
  });
});
