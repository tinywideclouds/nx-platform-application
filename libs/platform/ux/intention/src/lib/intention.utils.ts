// libs/platform/ux/intention/src/testing/intention.utils.ts
import { Type } from '@angular/core';

/**
 * Compliance Utility: Extracts configured animations from an Angular Component.
 * Hides the internal 'ɵcmp' and 'data.animation' complexity from the test suite.
 */
export function getComponentAnimations(component: Type<unknown>): any[] {
  // 1. Access Internal Definition
  const def = (component as any).ɵcmp;

  if (!def) {
    throw new Error(
      `[Intention Check] Could not read component definition for ${component.name}. ` +
        `Are you sure it is a Component?`,
    );
  }

  // 2. The "Shotgun" Selector (Handles AOT, JIT, and Test Modes)
  // Angular sometimes stores it as 'animation' (singular) or 'animations' (plural)
  const animations =
    def.data?.animation || def.data?.animations || def.animations || [];

  return Array.isArray(animations) ? animations : [animations];
}

/**
 * Verify that a component implements a specific Intention Trigger.
 */
export function expectIntention(component: Type<unknown>, triggerName: string) {
  const animations = getComponentAnimations(component);
  const hasTrigger = animations.some(
    (trigger: any) => trigger.name === triggerName,
  );

  if (!hasTrigger) {
    const found = animations.map((a: any) => `@${a.name}`).join(', ');
    throw new Error(
      `[Physics Violation] ${component.name} is missing the "@${triggerName}" intention.\n` +
        `Found: [ ${found || 'None'} ]\n` +
        `Expected: @${triggerName}`,
    );
  }

  return true; // Pass
}
