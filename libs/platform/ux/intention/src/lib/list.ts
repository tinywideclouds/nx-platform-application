import { trigger, transition, style, animate } from '@angular/animations';
import { UX_TIMING, UX_INTENT } from './intention';

// 1. Export the Token so tests and components can reference it
export const DISCARD_TRIGGER_NAME = 'discard';
/**
 * DISCARD INTENTION
 * * A semantic wrapper around the Angular Animation Trigger.
 * * Usage:
 * animations: [DiscardIntention]
 * * HTML:
 * @discard
 * * Customization (Optional):
 * <div @discard="{ value: '*', params: { duration: 500 } }">
 */
export const DiscardIntention = trigger('discard', [
  transition(
    ':leave',
    [
      // Starting State: Full height, fully visible
      style({ height: '*', opacity: 1, overflow: 'hidden' }),

      // The Animation: Collapses height and fades out
      // We use interpolation {{ }} to allow parameter overrides while defaulting to our "Confident" law.
      animate(
        '{{duration}}ms {{easing}}',
        style({
          height: '0px',
          opacity: 0,
          paddingTop: 0,
          paddingBottom: 0,
          marginBottom: 0,
        }),
      ),
    ],
    {
      // THE LAW: Default to "Confident" Discard (200ms)
      params: {
        duration: UX_INTENT.DISCARD.CONFIDENT.duration,
        easing: UX_INTENT.DISCARD.CONFIDENT.easing,
      },
    },
  ),
]);
