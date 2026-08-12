/**
 * Configuration Validation Engine
 * Uses snake_case Prisma types from `platform_configs` and `feature_flags` models.
 */

import { feature_flags, platform_configs } from "@prisma/client";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ConfigValidationService {
  validateConfigValue(config: platform_configs, newValue: any): ValidationResult {
    const errors: string[] = [];

    switch (config.data_type) {
      case "NUMBER": {
        const num = Number(newValue);
        if (isNaN(num)) { errors.push(`Value must be a number`); break; }
        const rules = config.validation_rules as { min?: number; max?: number } | null;
        if (rules?.min !== undefined && num < rules.min) errors.push(`Value ${num} is below minimum ${rules.min}`);
        if (rules?.max !== undefined && num > rules.max) errors.push(`Value ${num} exceeds maximum ${rules.max}`);
        break;
      }
      case "BOOLEAN":
        if (typeof newValue !== "boolean") errors.push(`Value must be a boolean`);
        break;
      case "STRING":
        if (typeof newValue !== "string" || !newValue.trim()) errors.push(`Value must be a non-empty string`);
        break;
      case "ENUM": {
        const rules = config.validation_rules as { options?: string[] } | null;
        if (rules?.options && !rules.options.includes(String(newValue))) {
          errors.push(`Value '${newValue}' not valid. Allowed: ${rules.options.join(", ")}`);
        }
        break;
      }
      case "JSON":
        if (typeof newValue !== "object" || newValue === null) errors.push(`Value must be a JSON object`);
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  validateProviderValue(allowedValues: string[], newProvider: string): ValidationResult {
    const errors: string[] = [];
    if (!allowedValues.includes(newProvider)) {
      errors.push(`Provider '${newProvider}' not allowed. Valid options: ${allowedValues.join(", ")}`);
    }
    return { valid: errors.length === 0, errors };
  }

  validateDependencies(
    flag: feature_flags,
    allFlags: feature_flags[],
    newEnabledState: boolean
  ): ValidationResult {
    const errors: string[] = [];
    if (!newEnabledState) return { valid: true, errors: [] };

    const flagMap = new Map(allFlags.map((f) => [f.key, f]));

    for (const depKey of flag.depends_on) {
      const dep = flagMap.get(depKey);
      if (!dep) { errors.push(`Dependency '${depKey}' does not exist`); continue; }
      if (!dep.enabled) {
        errors.push(`Cannot enable '${flag.name}'. Required dependency '${dep.name}' is disabled.`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  detectCircularDependencies(allFlags: feature_flags[]): string[] {
    const flagMap = new Map(allFlags.map((f) => [f.key, f]));
    const errors: string[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (key: string, path: string[]): void => {
      if (inStack.has(key)) { errors.push(`Circular dependency: ${[...path, key].join(" → ")}`); return; }
      if (visited.has(key)) return;
      visited.add(key);
      inStack.add(key);
      const flag = flagMap.get(key);
      if (flag) { for (const dep of flag.depends_on) dfs(dep, [...path, key]); }
      inStack.delete(key);
    };

    for (const flag of allFlags) dfs(flag.key, []);
    return errors;
  }

  validateRolloutPercent(percent: number): ValidationResult {
    const errors: string[] = [];
    if (percent < 0 || percent > 100) errors.push(`Rollout percent must be 0–100, got: ${percent}`);
    return { valid: errors.length === 0, errors };
  }
}

export const configValidationService = new ConfigValidationService();
