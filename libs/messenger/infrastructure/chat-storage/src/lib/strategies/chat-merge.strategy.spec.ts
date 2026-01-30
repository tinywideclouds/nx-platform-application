import { ChatMergeStrategy } from './chat-merge.strategy';
import { Conversation } from '@nx-platform-application/messenger-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

describe('ChatMergeStrategy', () => {
  // Strict 4-part URN: urn:messenger:conversation:id
  const TEST_URN = URN.parse('urn:messenger:conversation:test-id-1');

  const base: Conversation = {
    conversationUrn: TEST_URN,
    name: 'Test Chat',
    snippet: 'Hello',
    lastActivityTimestamp: '2024-06-01T12:00:00Z' as ISODateTimeString,
    unreadCount: 0,
    genesisTimestamp: '2024-01-01T00:00:00Z' as ISODateTimeString,
    lastModified: '2024-06-01T12:00:00Z' as ISODateTimeString,
  };

  it('should adopt Remote genesis if it is OLDER (discovered history)', () => {
    const local = {
      ...base,
      genesisTimestamp: '2024-01-01T00:00:00Z' as ISODateTimeString,
    };
    const remote = {
      ...base,
      genesisTimestamp: '2023-01-01T00:00:00Z' as ISODateTimeString, // Older
      lastModified: '2024-06-01T12:00:00Z' as ISODateTimeString,
    };

    const result = ChatMergeStrategy.merge(local, remote);

    // Expecting 2023 because it is historically older (min)
    expect(result.genesisTimestamp).toBe(remote.genesisTimestamp);
  });

  it('should keep Local genesis if it is OLDER than Remote (remote is partial)', () => {
    const local = {
      ...base,
      genesisTimestamp: '2020-01-01T00:00:00Z' as ISODateTimeString, // Older
    };
    const remote = {
      ...base,
      genesisTimestamp: '2024-01-01T00:00:00Z' as ISODateTimeString,
    };

    const result = ChatMergeStrategy.merge(local, remote);

    expect(result.genesisTimestamp).toBe(local.genesisTimestamp);
  });

  it('should correctly handle null genesis (non-null wins)', () => {
    const local = { ...base, genesisTimestamp: null };
    const remote = {
      ...base,
      genesisTimestamp: '2022-01-01T00:00:00Z' as ISODateTimeString,
    };

    const result = ChatMergeStrategy.merge(local, remote);
    expect(result.genesisTimestamp).toBe(remote.genesisTimestamp);
  });

  it('should update mutable fields from Remote if Remote is newer', () => {
    const local = {
      ...base,
      snippet: 'Old Message',
      lastModified: '2024-06-01T10:00:00Z' as ISODateTimeString,
    };
    const remote = {
      ...base,
      snippet: 'New Message',
      lastModified: '2024-06-01T11:00:00Z' as ISODateTimeString, // Newer
    };

    const result = ChatMergeStrategy.merge(local, remote);

    expect(result.snippet).toBe('New Message');
    expect(result.lastModified).toBe(remote.lastModified);
  });
});
