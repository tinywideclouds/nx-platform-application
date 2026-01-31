// libs/messenger/domain/message-content/src/lib/factories/message-payload.factory.spec.ts

import { describe, it, expect } from 'vitest';
import { MessagePayloadFactory } from './message-payload.factory';
import { URN } from '@nx-platform-application/platform-types';

describe('MessagePayloadFactory', () => {
  const groupUrn = URN.parse('urn:messenger:group:test-1');
  const inviterUrn = URN.parse('urn:identity:google:me');
});
