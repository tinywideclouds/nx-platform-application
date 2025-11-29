// libs/platform/cloud-access/src/lib/tokens/cloud-provider.token.spec.ts

import { TestBed } from '@angular/core/testing';
import { CLOUD_PROVIDERS } from './cloud-providers.token';
import { InMemoryCloudProvider } from '../providers/in-memory-cloud.provider';

describe('CLOUD_PROVIDERS Token', () => {
  it('should be able to register multiple providers', () => {
    TestBed.configureTestingModule({
      providers: [
        InMemoryCloudProvider, // The implementation
        {
          provide: CLOUD_PROVIDERS,
          useExisting: InMemoryCloudProvider,
          multi: true,
        },
      ],
    });

    const providers = TestBed.inject(CLOUD_PROVIDERS);

    expect(providers).toBeTruthy();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBe(1);
    expect(providers[0] instanceof InMemoryCloudProvider).toBe(true);
    expect(providers[0].providerId).toBe('in-memory');
  });
});
