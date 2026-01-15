# ⚙️ messenger-infrastructure-local-settings

**Type:** Infrastructure (Persistence)
**Scope:** Messenger Domain
**Storage:** IndexedDB (`settings` table)

This library is the system of record for **User Intent** and **Active Choices**.

## 🧠 Philosophy: "The Active Choice"

This library is **not** for caching transient state (like "is the sidebar open?") or system configuration (like "API URL").

It is the home for decisions the user has **actively made** about how they want the application to behave. These choices must persist across sessions, device reboots, and updates. They represent a "Contract" between the user and the app.

### The "Consent & Intent" Model

We treat settings as a record of explicit user actions:

1.  **Authorization:** "I agree to link my Google Drive." (vs just having the token).
2.  **Workflow:** "I have finished the onboarding wizard." (Don't show it again).
3.  **Frequency:** "I want to sync data only on WiFi."
4.  **Privacy:** "I want to block incoming messages from strangers."

## 📦 Key Features

### `LocalSettingsService`

A type-safe facade over the `settings` table in `MessengerDatabase`. It abstracts the raw Key-Value storage into semantic methods.

#### Current Settings

- **Wizard State:** Tracks if the user has completed the onboarding flow (`ui_wizard_seen`).
- **Theme:** Tracks Light/Dark/System preference (`ui_theme`).

#### Future Settings (Planned)

- **Drive Consent:** Explicit acceptance/rejection of the BYOS model.
- **Sync Strategy:** Frequency preferences (e.g., "Daily", "Manual Only").

## 🛠️ Usage

```typescript
// Inject the service
constructor(private settings: LocalSettingsService) {}

// Check a preference (Read Intent)
async checkOnboarding() {
  const hasSeenWizard = await this.settings.getWizardSeen();
  if (!hasSeenWizard) {
    this.router.navigate(['/onboarding']);
  }
}

// Set a preference (Record Intent)
async finishOnboarding() {
  // The user has actively clicked "Finish"
  await this.settings.setWizardSeen(true);
}

```

## ⚠️ Anti-Patterns (What NOT to put here)

- **Auth Tokens:** Do NOT store JWTs here. Use `platform-infrastructure-auth`.
- **Encryption Keys:** Do NOT store private keys here. Use `infrastructure-key-storage`.
- **Session State:** Do NOT store "which conversation is selected". That belongs in URL/Router state or a specific View Store.
- **Default Config:** If the user hasn't chosen it, it's not a setting. Defaults belong in the code constants.
