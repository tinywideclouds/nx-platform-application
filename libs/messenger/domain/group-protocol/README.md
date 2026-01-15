# 🤝 Messenger Group Protocol

**Domain:** `group-protocol`
**Responsibility:** Upgrading Lists to Networks, Consensus Management.

This library manages the lifecycle of **Network Groups** (Shared Consensus) as opposed to **Local Groups** (Personal Distribution Lists).

## 🧠 Philosophy: The Ownerless Group

In Messenger, groups do not have an "Admin" or "Owner" in the traditional database sense.

1.  **Consensus Based:** A group exists because a set of peers _agree_ that it exists.
2.  **Graph Authority:** There is no central server table defining "Members of Group X." The membership list is derived from the **Union of all valid Invitations and Join responses** found in the message history.
3.  **Upgrade Flow:** Users start with a private list (Address Book). To collaborate, they "Upgrade" this list to a Network Group, inviting the peers to join a shared context.

## 🚀 Workflows

### 1. The Upgrade (Genesis)

**User Action:** "Create Group Chat" from a personal list.

1.  **Minting:** The initiator generates a new, random UUID (`urn:messenger:group:{uuid}`).
2.  **Bootstrap:** The initiator saves this Group URN to their local Address Book with `scope: 'messenger'` and adds all participants as `invited`.
3.  **Broadcast:** The initiator sends a `MessageGroupInvite` to the new Group URN.
    - _Note:_ The `NetworkGroupStrategy` (in `domain-sending`) sees the local 'invited' members and fans out the encrypted invite to each of them.

### 2. The Handshake (Joining)

**Peer Action:** "Accept Invite".

1.  **Receipt:** Peer receives `MessageGroupInvite`. The UI renders an "Accept/Decline" banner.
2.  **Response:** Peer sends a `MessageGroupInviteResponse` back to the Group URN.
    - **Payload:** `{ status: 'joined', groupUrn: ... }`
3.  **Ingestion:** All members (including the initiator) receive this response. Their `IngestionService` updates the local Roster: "Alice is now Joined."

## 📦 Key Components

- **`GroupProtocolService`:** The high-level orchestrator.
  - `upgradeGroup(localUrn)`: Performs the Mint -> Save -> Broadcast sequence.
  - `acceptInvite(msg)`: Sends the 'Joined' signal.
  - `rejectInvite(msg)`: Sends the 'Declined' signal.

## ⚠️ Dependencies

- **`contacts-api`:** To read the initial list and save the new Network Group state.
- **`domain-sending`:** To transport the protocol messages.
- **`domain-message-content`:** Defines the `GroupInvite` and `GroupResponse` schemas.
