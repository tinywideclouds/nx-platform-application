import { MessengerScenarioData } from '../types';
import { URN } from '@nx-platform-application/platform-types';

/**
 * A partial scenario definition used to modify a base state.
 * Arrays (like messages) in the modifier REPLACE the base arrays.
 * Objects (like auth) are merged deeply.
 */
export type ScenarioModifier = {
  [K in keyof MessengerScenarioData]?: {
    [P in keyof MessengerScenarioData[K]]?: Partial<
      MessengerScenarioData[K][P]
    >;
  };
};

/**
 * COMPOSITOR: The "Builder" for World States.
 *
 * Usage:
 * const FLIGHT_MODE = composeScenarios(ACTIVE_USER, {
 * remote_server: { network: { queuedMessages: [...] } }
 * });
 */
export function composeScenarios(
  base: MessengerScenarioData,
  ...modifiers: ScenarioModifier[]
): MessengerScenarioData {
  // ⚠️ FIX: structuredClone() strips class prototypes (methods like .equals()).
  // We use a custom clone that respects our Value Objects (URNs).
  let result = customDeepClone(base);

  for (const mod of modifiers) {
    result = mergeDeep(result, mod);
  }

  return result;
}

// --- Internal Deep Merge Logic ---

function mergeDeep(target: any, source: any): any {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (Array.isArray(sourceValue)) {
      // RULE: Arrays are REPLACED, not merged.
      // If you want to add a message, you provide the full new array.
      target[key] = sourceValue;
    } else if (isObject(sourceValue)) {
      if (!targetValue) {
        Object.assign(target, { [key]: {} });
      }
      mergeDeep(target[key], sourceValue);
    } else {
      Object.assign(target, { [key]: sourceValue });
    }
  }

  return target;
}

/**
 * Determines if an item is a plain object that should be deeply merged.
 * We treat Value Objects (like URNs) as SCALARS, so they return false.
 */
function isObject(item: any): boolean {
  return (
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    // 🌟 CRITICAL: If it has an .equals method (URN), treat it as a primitive/scalar.
    typeof item.equals !== 'function'
  );
}

/**
 * A safe deep cloner that preserves Domain Objects (URNs).
 */
function customDeepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 1. Preserve Value Objects (URNs, Dates, etc.)
  // If it is a URN (instance check or duck typing), return reference.
  if (obj instanceof URN || typeof (obj as any).equals === 'function') {
    return obj;
  }

  // 2. Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => customDeepClone(item)) as any;
  }

  // 3. Handle Plain Objects
  const clone: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = customDeepClone((obj as any)[key]);
    }
  }

  return clone;
}
