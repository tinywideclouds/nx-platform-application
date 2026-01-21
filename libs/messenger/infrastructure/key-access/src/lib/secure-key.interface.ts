import { URN, PublicKeys } from '@nx-platform-application/platform-types';

export abstract class ISecureKeyService {
  abstract getKey(userId: URN): Promise<PublicKeys>;
  abstract storeKeys(userUrn: URN, keys: PublicKeys): Promise<void>;
  abstract clearCache(): void;
}
