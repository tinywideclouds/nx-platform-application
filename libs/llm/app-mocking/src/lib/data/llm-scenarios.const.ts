import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmMessage, LlmSession } from '@nx-platform-application/llm-types';

export interface LlmScenarioData {
  sessions: LlmSession[];
  messages: LlmMessage[];
}

// --- Helpers ---
const encoder = new TextEncoder();
const now = Temporal.Now.instant();

function createMsg(
  i: number,
  sessionId: URN,
  role: 'user' | 'model',
  text: string,
): LlmMessage {
  return {
    id: URN.create('message', `msg-${i}`, 'llm'),
    sessionId,
    role,
    typeId: URN.parse('urn:llm:message-type:text'),
    payloadBytes: encoder.encode(text),
    // Spread them out by 1 minute to test time grouping
    timestamp: now
      .subtract({ minutes: 100 - i })
      .toString() as ISODateTimeString,
  };
}

const SESSION_1 = URN.parse('urn:llm:session:coding-help');

// --- Scenarios ---

export const LLM_SCENARIOS: Record<string, LlmScenarioData> = {
  // 1. FRESH START
  empty: {
    sessions: [],
    messages: [],
  },

  // 2. STANDARD CONVERSATION
  'basic-chat': {
    sessions: [
      {
        id: SESSION_1,
        title: 'Angular Architecture Review',
        lastModified: now.toString() as ISODateTimeString,
      },
    ],
    messages: [
      createMsg(1, SESSION_1, 'user', 'How do I architect a chat app?'),
      createMsg(2, SESSION_1, 'model', 'You should use the "Sink" pattern...'),
      createMsg(3, SESSION_1, 'user', 'What about the storage layer?'),
      createMsg(4, SESSION_1, 'model', 'Use Dexie with strict Mappers.'),
    ],
  },

  // 3. SCROLL STRESS TEST (100+ Items)
  'heavy-history': {
    sessions: [
      {
        id: SESSION_1,
        title: 'Long Context Window Test',
        lastModified: now.toString() as ISODateTimeString,
      },
    ],
    messages: Array.from({ length: 100 }, (_, i) =>
      createMsg(
        i,
        SESSION_1,
        i % 2 === 0 ? 'user' : 'model',
        `This is message number ${i}. It is long enough to verify the wrapping behavior of the row component.`,
      ),
    ),
  },
};
