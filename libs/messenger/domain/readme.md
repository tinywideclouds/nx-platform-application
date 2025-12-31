# Messenger Domain

This directory contains the **Core Business Logic** of the Messenger.
It is organized into **Functional Groups**. Each group consists of a **Facade** (Public) and **Internals** (Private).

## 1. Identity Group

- **Facade:** `identity` (Key Management, Verification)
- **Internal:** `identity-adapter` (Interfaces to Contacts DB)

## 2. Ingestion Group (The "Airlock")

- **Facade:** `ingestion` (Orchestrates the pipeline)
- **Internal:** `quarantine` (Gatekeeper & Jail DB)

## 3. Sending Group (The "Post Office")

- **Facade:** `sending` (Encryption, Routing, Fan-out)
- **Internal:** `outbox` (Task Queue, Worker, IndexedDB)

## 4. Chat Sync

- **Facade:** `chat-sync` (Orchestrates Cloud & Local History)

## 5. Conversation

- **Facade:** `conversation` (Active Chat Logic, Pagination, Cursors)

---

## Architecture Rule

The Application Layer (State/UI) should **only import from the Facade libraries**.
The Internal libraries should only be used by their specific Facade parent.
