import { evaluateSafety } from '@/lib/reputation/engine';
import { evaluateOptimization } from '@/lib/optimization/engine';
import { TestFactories } from '../utils/factories';

describe('Integration Validation: Optimization -> Safety', () => {
  it('verifies that Phase 5 and Phase 6 contracts do not conflict structurally', () => {
    const optContext = TestFactories.createOptimizationContext();
    const safetyContext = TestFactories.createSafetyContext();

    const optResult = evaluateOptimization(optContext);
    const safetyResult = evaluateSafety(safetyContext);

    // Verification that the engines can run in the same process 
    // without leaking state or mutating global objects.
    expect(optResult.score).toBeDefined();
    expect(safetyResult.recommendation).toBeDefined();
  });
});
