import { TestBed } from '@angular/core/testing';
import { ChatKeyService } from './chat-key.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

describe('ChatKeyService (Domain: Them)', () => {
  let service: ChatKeyService;

  const mockKeyService = {
    hasKeys: vi.fn(),
  };

  const mockResolver = {
    resolveToHandle: vi.fn(),
  };

  const contactUrn = URN.parse('urn:contacts:user:alice');
  const handleUrn = URN.parse('urn:lookup:email:alice@test.com');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatKeyService,
        MockProvider(KeyCacheService, mockKeyService),
        MockProvider(IdentityResolver, mockResolver),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatKeyService);
  });

  describe('checkRecipientKeys', () => {
    it('should resolve identity via Resolver and check KeyService', async () => {
      mockResolver.resolveToHandle.mockResolvedValue(handleUrn);
      mockKeyService.hasKeys.mockResolvedValue(true);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(mockResolver.resolveToHandle).toHaveBeenCalledWith(contactUrn);
      expect(mockKeyService.hasKeys).toHaveBeenCalledWith(handleUrn);
      expect(result).toBe(true);
    });

    it('should return false if keys are missing', async () => {
      mockResolver.resolveToHandle.mockResolvedValue(handleUrn);
      mockKeyService.hasKeys.mockResolvedValue(false);

      const result = await service.checkRecipientKeys(contactUrn);

      expect(result).toBe(false);
    });

    it('should skip check for Groups/System URNs', async () => {
      const groupUrn = URN.parse('urn:messenger:group:123');
      const result = await service.checkRecipientKeys(groupUrn);

      expect(result).toBe(true);
      expect(mockResolver.resolveToHandle).not.toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockResolver.resolveToHandle.mockRejectedValue(new Error('Network Fail'));

      const result = await service.checkRecipientKeys(contactUrn);

      expect(result).toBe(false);
    });
  });
});
