import { Temporal } from '@js-temporal/polyfill';
import { Resource, URN } from '@nx-platform-application/platform-types';
import {
  ScrollItem,
  ScrollAlignment,
} from '@nx-platform-application/scrollspace-types';

export interface TimeSeriesOptions<T> {
  // Extract the precise instant from your data
  getTimestamp: (item: T) => Temporal.Instant;

  // Who owns this item? (For alignment continuity)
  // We use string here because the Viewport compares simple strings for the 'cluster' check
  getActorId: (item: T) => string;

  // Where should it sit?
  getAlignment: (item: T) => ScrollAlignment;

  // Context for "Day" calculations
  timeZone: Temporal.TimeUnit | string;

  // Optional: Inject the "New Items" red line (Using strict URN)
  newItemsMarkerId?: URN | null;
}

export class TimeSeries {
  /**
   * Transforms a domain resource list into a visual ScrollItem list.
   * Returns a Union Array so we strictly type the 'data' payload for every row type.
   */
  static transform<T extends Resource>(
    rawItems: T[],
    options: TimeSeriesOptions<T>,
  ): Array<ScrollItem<T> | ScrollItem<string> | ScrollItem<null>> {
    const results: Array<
      ScrollItem<T> | ScrollItem<string> | ScrollItem<null>
    > = [];

    let lastDate: Temporal.PlainDate | null = null;
    let lastActorId: string | null = null;

    for (const item of rawItems) {
      const instant = options.getTimestamp(item);

      // 1. New Items Marker Injection
      // We use URN equality check provided by your class
      if (
        options.newItemsMarkerId &&
        item.id.equals(options.newItemsMarkerId)
      ) {
        const markerItem: ScrollItem<null> = {
          id: 'marker-new-items',
          type: 'new-items-marker',
          timestamp: instant,
          layout: {
            alignment: 'stretch',
            isContinuous: false,
            fullWidth: true,
          },
          renderingWeight: 0,
          data: null,
        };
        results.push(markerItem);
        lastActorId = null; // Break continuity
      }

      // 2. Date Header Injection
      const zdt = instant.toZonedDateTimeISO(options.timeZone);
      const currentDate = zdt.toPlainDate();

      if (!lastDate || !currentDate.equals(lastDate)) {
        const headerItem: ScrollItem<string> = {
          id: `date-${currentDate.toString()}`,
          type: 'date-header',
          timestamp: instant,
          layout: { alignment: 'center', isContinuous: false },
          renderingWeight: 0,
          data: currentDate.toString(),
        };
        results.push(headerItem);
        lastDate = currentDate;
        lastActorId = null;
      }

      // 3. Content Item
      const actorId = options.getActorId(item);
      const align = options.getAlignment(item);
      const isContinuous = lastActorId === actorId;

      const contentItem: ScrollItem<T> = {
        id: item.id.toString(), // Viewport needs string ID for trackBy
        type: 'content',
        timestamp: instant,
        layout: { alignment: align, isContinuous },
        renderingWeight: 1,
        data: item,
      };

      results.push(contentItem);

      lastActorId = actorId;
    }

    return results;
  }
}
