### 📜 README: @nx-platform-application/messenger-state-identity

This library serves as the **Identity Orchestrator** for the messenger application. It handles the high-stakes "Onboarding Ceremony," cryptographic key management, and cross-device pairing logic.

---

#### 🏛️ Architecture: The Identity Gatekeeper

This library sits in the **State Layer**. It encapsulates the complex state machine required to transition a user from an unauthenticated state to a "Ready" messaging state.

By isolating this logic, we ensure that the primary messaging service is not bloated with "one-time" setup logic that only runs during the first few seconds of a session.

#### 🔑 Key Responsibilities

- **Session Initialization**: Coordinates with `AuthService` to detect if a user is new or returning.
- **Integrity Checking**: Compares local cryptographic keys against the server-side public keys to detect identity conflicts.
- **Onboarding State Machine**: Manages the `OnboardingState` signal (`CHECKING` | `READY` | `GENERATING` | `REQUIRES_LINKING`).
- **Device Pairing (The Ceremony)**: Orchestrates the `DevicePairingService` to link new devices via QR codes or secure tokens.
- **Identity Recovery**: Provides the mechanism to reset identity keys or finalize linking after a successful sync.

---

#### 📦 Public API

| Member                     | Type                      | Description                                              |
| -------------------------- | ------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `onboardingState`          | `Signal<OnboardingState>` | The current phase of the user's identity setup.          |
| `isCeremonyActive`         | `Signal<boolean>`         | True if a device pairing/linking UI should be displayed. |
| `myKeys`                   | `Signal<PrivateKeys       | null>`                                                   | The current active cryptographic keys for the session. |
| `initialize()`             | `Promise<void>`           | The entry point to boot the identity state machine.      |
| `startTargetLinkSession()` | `Promise<Session>`        | Initializes a device as a receiver for linking.          |
| `performIdentityReset()`   | `Promise<void>`           | Wipes local identity and generates new server-side keys. |

---

#### 🛠️ Usage Example

```typescript
// Used by the root ChatService or Onboarding Components
const identity = inject(ChatIdentityFacade);

// Subscribe to state changes
effect(() => {
  if (identity.onboardingState() === 'REQUIRES_LINKING') {
    router.navigate(['/onboarding/link-device']);
  }
});

// Initialize on app boot
await identity.initialize();
```
