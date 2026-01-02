# 📱 @nx-platform-application/messenger-device-pairing

This library handles the **Device Authorization** protocol, allowing users to securely link new devices (Targets) to their existing account (Source) using End-to-End Encryption.

## 🏛️ Architecture: Dual-Mode Pairing

We support two distinct pairing modes to accommodate different user scenarios (e.g., Desktop vs. Mobile).

### 1. Receiver-Hosted Mode (Default)

**Best for:** Desktop/Web clients.

- **Target (New Device):** Displays a QR code containing an ephemeral RSA Public Key.
- **Source (Logged-in Device):** Scans the QR, encrypts its Identity Keys with the RSA Public Key, and sends them to the "Hot Queue" (a dedicated MQTT topic or polling inbox).
- **Result:** The Target polls the Hot Queue, decrypts the message, and imports the keys.

### 2. Sender-Hosted Mode ("Dead Drop")

**Best for:** Mobile clients where scanning the screen is hard.

- **Source (Logged-in Device):** Generates a QR code containing a reference to a "Dead Drop" (encrypted payload stored on the server).
- **Target (New Device):** Scans the QR, retrieves the encrypted payload from the server, and decrypts it.

## 📦 Services

### `DevicePairingService` (Facade)

The unified entry point for the UI. Delegates to the appropriate flow strategy.

### `ReceiverHostedFlowService`

Implements the RSA-based "Trojan Horse" strategy.

- Uses `MessengerCryptoService` for ephemeral key generation.
- Uses `HotQueueMonitor` to spy on incoming messages for the sync payload.

### `SenderHostedFlowService`

Implements the AES-based "Dead Drop" strategy.
