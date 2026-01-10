### 📜 README: @nx-platform-application/messenger-state-identity

This library serves as the **Identity Orchestrator** for the messenger application. It handles the high-stakes "Onboarding Ceremony," cryptographic key management, and cross-device pairing logic.

---

#### 🏛️ Architecture: The Identity Gatekeeper

This library sits in the **State Layer**. It encapsulates the complex state machine required to transition a user from an unauthenticated state to a "Ready" messaging state.

By isolating this logic, we ensure that the primary messaging service is not bloated with "one-time" setup logic that only runs during the first few seconds of a session.

#### 🔑 Key Responsibilities

- **Session Initialization**: Coordinates with `AuthService` to detect if a user is new or returning.
- **Integrity Checking**: Compares local cryptographic keys against the server-side public keys to detect identity conflicts.
- **Onboarding State Machine**: Manages the `OnboardingState` signal (`CHECKING` | `READY` | `OFFLINE_READY` | `GENERATING` | `REQUIRES_LINKING`).
- **Device Pairing (The Ceremony)**: Orchestrates the `DevicePairingService` to link new devices via QR codes or secure tokens.
- **Identity Recovery**: Provides the mechanism to reset identity keys or finalize linking after a successful sync.

---

#### 📦 Public API

**State Signals**

| Member             | Type                      | Description                                              |
| ------------------ | ------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `onboardingState`  | `Signal<OnboardingState>` | The current phase of the user's identity setup.          |
| `isCeremonyActive` | `Signal<boolean>`         | True if a device pairing/linking UI should be displayed. |
| `myKeys`           | `Signal<PrivateKeys       | null>`                                                   | The current active cryptographic keys for the session. |

**Lifecycle Actions**

| Method                   | Returns         | Description                                                           |
| ------------------------ | --------------- | --------------------------------------------------------------------- |
| `initialize()`           | `Promise<void>` | The entry point to boot the identity state machine.                   |
| `performIdentityReset()` | `Promise<void>` | **Destructive**: Wipes local keys and generates new server-side keys. |

**Pairing & Linking Actions (The Ceremony)**

| Method                        | Returns            | Description                                                                   |
| ----------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `startTargetLinkSession()`    | `Promise<Session>` | Initializes this device as a **Receiver** (New Device) to generate a QR code. |
| `startSourceLinkSession()`    | `Promise<Session>` | Initializes this device as a **Sender** (Existing Device) to scan a QR code.  |
| `checkForSyncMessage(key)`    | `Promise<boolean>` | Polls for the encrypted sync payload on the Receiver side.                    |
| `linkTargetDevice(qrCode)`    | `Promise<void>`    | Called by the **Sender** to encrypt its identity keys for the target.         |
| `redeemSourceSession(qrCode)` | `Promise<void>`    | Called by the **Receiver** to decrypt the sync payload and finalize setup.    |
| `cancelLinking()`             | `void`             | Aborts the pairing process and resets ceremony state.                         |

---

#### 🛠️ Usage Example

```typescript
// Used by the root AppState or Onboarding Components
const identity = inject(ChatIdentityFacade);

// Subscribe to state changes
effect(() => {
  // Redirect to pairing screen if keys don't match server
  if (identity.onboardingState() === 'REQUIRES_LINKING') {
    router.navigate(['/onboarding/link-device']);
  }
});

// Initialize on app boot
await identity.initialize();
```
