import { evaluateOptimization } from '@/lib/optimization/engine';
import { ActivityScore } from '@/lib/optimization/types';
import { TestFactories } from '../../utils/factories';

describe('Activity Optimization Engine (Phase 6)', () => {
  it('determines VERY_HIGH score for historical replies', () => {
    const context = TestFactories.createOptimizationContext({
      recipientStats: TestFactories.createRecipientStats({ historicalReplies: 1 })
    });
    
    const result = evaluateOptimization(context);
    expect(result.score).toBe(ActivityScore.VERY_HIGH);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'HIGH_HISTORICAL_REPLIES' }),
        expect.objectContaining({ code: 'DEFAULT_BUSINESS_HOURS' })
      ])
    );
  });

  it('determines LOW score for no prior engagement', () => {
    const context = TestFactories.createOptimizationContext({
      recipientStats: TestFactories.createRecipientStats()
    });
    
    const result = evaluateOptimization(context);
    expect(result.score).toBe(ActivityScore.LOW);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NO_PRIOR_ENGAGEMENT' })
      ])
    );
  });

  it('recommends correct business hours', () => {
    const context = TestFactories.createOptimizationContext({ recipientTimezone: 'America/New_York' });
    const result = evaluateOptimization(context);
    
    expect(result.deliveryWindows.length).toBe(1);
    expect(result.deliveryWindows[0]).toEqual({
      startHour: 9,
      endHour: 17,
      timezone: 'America/New_York'
    });
  });

  it('preserves immutable context inputs and produces identical outputs (Idempotency)', () => {
    const context = TestFactories.createOptimizationContext();
    Object.freeze(context); // Guarantee absolute immutability of input
    
    const result1 = evaluateOptimization(context);
    const result2 = evaluateOptimization(context);
    
    // Validate output deep equality rather than string serialization
    expect(result1).toEqual(result2);
  });

  it('executes deterministically under configurable performance thresholds (Performance)', () => {
    const context = TestFactories.createOptimizationContext();
    const ITERATIONS = process.env.TEST_PERFORMANCE_ITERATIONS ? parseInt(process.env.TEST_PERFORMANCE_ITERATIONS) : 1000;
    const MAX_DURATION_MS = process.env.TEST_PERFORMANCE_MAX_MS ? parseInt(process.env.TEST_PERFORMANCE_MAX_MS) : 500;
    
    const start = performance.now();
    
    for (let i = 0; i < ITERATIONS; i++) {
      evaluateOptimization(context);
    }
    
    const end = performance.now();
    expect(end - start).toBeLessThan(MAX_DURATION_MS);
  });
});
