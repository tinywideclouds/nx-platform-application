// libs/messenger/state/app/src/lib/state.engine.ts

import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';

export type BootStage =
  | 'IDLE'
  | 'CHECKING_AUTH'
  | 'STARTING_CHAT_SYNC'
  | 'CHECKING_CLOUD'
  | 'FLUSHING_OUTBOX'
  | 'READY'
  | 'FAILED';

export interface AppDiagnosticState {
  bootStage: BootStage;
  lastBootError?: string;
}

/**
 * The definitive list of states the Chat Window can be in.
 * This drives the UI Switch.
 */
export type PageState =
  | 'LOADING' // Initializing or resolving URN
  | 'ACTIVE_CHAT' // Found in Chat DB with history
  | 'EMPTY_NETWORK_GROUP' // Provisioned Messenger group, no messages yet
  | 'PASSIVE_CONTACT_GROUP' // From Address Book, needs "Upgrade" intro
  | 'PASSIVE_CONTACT_USER' // Individual contact, no history (Empty P2P)
  | 'QUARANTINE_REQUEST' // Found in Quarantine/Gatekeeper
  | 'BLOCKED' // User/Group is on the block list
  | 'NOT_FOUND'; // URN cannot be resolved anywhere

/**
 * The raw inputs required for the engine to make a decision.
 * AppState will be responsible for gathering these from various stores.
 */
export interface StateEngineInputs {
  urn: URN | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isBlocked: boolean;
  isQuarantined: boolean;
}

export class StateEngine {
  /**
   * Pure function that resolves the current PageState based on environmental inputs.
   * Priority: Loading > Security (Block/Quarantine) > Active History > Passive Discovery (URN-based).
   */
  static resolvePageState(inputs: StateEngineInputs): PageState {
    const { urn, isLoading, messages, isBlocked, isQuarantined } = inputs;

    // 1. Critical Overrides
    if (!urn || isLoading) return 'LOADING';
    if (isBlocked) return 'BLOCKED';
    if (isQuarantined) return 'QUARANTINE_REQUEST';

    // 2. Active History
    // If we have messages, it is an active chat regardless of where the URN came from.
    // (e.g. A Contact Group that has been chatted in is now an Active Chat)
    if (messages.length > 0) return 'ACTIVE_CHAT';

    // 3. Structural Logic (Derived directly from URN)
    // We do not need to check "existence" because the URN itself dictates the expected behavior for empty states.

    if (urn.entityType === 'group') {
      // Network Group (Messenger Namespace) -> "Invite Members" / Empty State
      if (urn.namespace === 'messenger') {
        return 'EMPTY_NETWORK_GROUP';
      }

      // Local Group (Contacts Namespace) -> "Upgrade to Network Group"
      if (urn.namespace === 'contacts') {
        return 'PASSIVE_CONTACT_GROUP';
      }
    }

    // 4. User Logic (P2P)
    // Contacts/Messenger User -> Empty P2P Chat
    if (urn.entityType === 'user') {
      return 'PASSIVE_CONTACT_USER';
    }

    return 'NOT_FOUND';
  }
}
