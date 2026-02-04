# 📖 Messenger Infrastructure: Pairing Security

> **Role:** The Handshake Protocol (Device Linking)  
> **Responsibility:** Manages the ephemeral key exchange for linking new devices via QR codes.

This library encapsulates the logic for the **Device Pairing Handshake**. It generates and parses the JSON payloads embedded in QR codes, establishing a secure channel between a "Source" device (e.g., your phone) and a "Target" device (e.g., your desktop).

It does **not** persist any keys. It generates ephemeral sessions that exist only for the duration of the scan.

## Modes

### 1. Receiver Hosted (Mode `rh`)

- **Use Case:** Target device (Desktop) shows the QR code.
- **Mechanism:** Generates an ephemeral **RSA-OAEP** key pair.
- **Flow:** 1. Receiver shows Public Key in QR. 2. Sender scans QR, encrypts secrets with Public Key. 3. Receiver decrypts secrets with Private Key.

### 2. Sender Hosted (Mode `sh`)

- **Use Case:** Source device (Phone) shows the QR code (Reverse Linking).
- **Mechanism:** Generates an ephemeral **AES-GCM** key.
- **Flow:**
  1. Sender shows Symmetric Key in QR.
  2. Receiver scans QR, uses key to decrypt subsequent messages.

## API: `PairingSecurityService`

- **`generateReceiverSession()`**: Creates a new RSA-OAEP session and returns the QR payload string.
- **`generateSenderSession()`**: Creates a new AES-GCM session and returns the QR payload string.
- **`parseQrCode(qrString)`**: Safely parses a raw QR string, detects the mode (`rh` vs `sh`), and imports the contained cryptographic key (Public RSA or Symmetric AES).
