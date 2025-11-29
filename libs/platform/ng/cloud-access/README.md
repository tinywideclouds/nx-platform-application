# ☁️ libs/platform/cloud-access

**Type:** Utility Library
**Scope:** Platform (Shared across all domains)

This library provides a generic abstraction layer for Cloud Storage Providers (Google Drive, iCloud, AWS S3). It allows domain libraries (like `chat` or `contacts`) to upload/download files without knowing the implementation details of the underlying storage vendor.

## 🏗 Architecture

This library implements the **Strategy Pattern**. The application injects a specific provider implementation, but consumers interact only with the `CloudStorageProvider` interface.

### Key Interfaces

#### `CloudStorageProvider`

The contract that all storage vendors must implement.

```typescript
export interface CloudStorageProvider {
  readonly providerId: 'google' | 'apple' | 'aws';

  // Security: Check/Request OAuth scopes
  hasPermission(): boolean;
  requestAccess(): Promise<boolean>;

  // CRUD
  uploadBackup(content: unknown, filename: string): Promise<CloudBackupMetadata>;
  listBackups(query?: string): Promise<CloudBackupMetadata[]>;
  downloadBackup<T>(fileId: string): Promise<T>;
}
```

🔌 Configuration
To use this library, you must provide the configuration token in your application root (e.g., app.config.ts).

```TypeScript

import { PLATFORM_CLOUD_CONFIG } from '@nx-platform-application/platform-cloud-access';

export const appConfig: ApplicationConfig = {
providers: [
{
provide: PLATFORM_CLOUD_CONFIG,
useValue: {
googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com'
}
},
// ... other providers
]
};
```

## 📦 Supported Providers

Google Drive (GoogleDriveService)
Auth: Uses Google Identity Services (GIS) SDK v2.

Scope: drive.file (Incremental auth). This grants access only to files created by this app, not the user's entire drive.

Transport: Uses standard REST API via fetch.

🚀 Usage Example

```TypeScript

import { CLOUD_PROVIDERS } from '@nx-platform-application/platform-cloud-access';

@Injectable()
export class MyService {
  // Inject all available providers
  private providers = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  async saveFile() {
    const google = this.providers.find(p => p.providerId === 'google');
    await google.uploadBackup({ hello: 'world' }, 'test.json');
  }
}
```
