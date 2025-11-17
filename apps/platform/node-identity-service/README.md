# **Node.js Identity Service**

## 1. Overview

The `node-identity-service` is a standalone microservice responsible for managing user authentication. Its sole purpose is to act as a **federated identity voucher**. It verifies a user's identity against trusted external identity providers (e.g., Google, Apple) and, upon successful verification, issues a secure, short-lived JSON Web Token (JWT) that attests to that specific authentication event.

This service acts as the single gateway for user login, abstracting the authentication logic away from all other backend services.

### Key Features

* **Federated Identity:** Issues identity URNs based on the authentication provider (e.g., `urn:auth:google:...`), rather than a central, internal ID. This provides strong, provable provenance.
* **No Identity Linking:** The service is "dumb" by design. It does not link or merge identities. `user@google.com` and `user@apple.com` are treated as two completely distinct, separate identities.
* **Pluggable Authorization Policies:** The logic for *who* is allowed to log in is not hard-coded. It is determined by a pluggable policy set via an environment variable (`AUTH_POLICY`).
* **Internal JWT Issuance:** Creates and signs its own internal JWT, which serves as the user's "passport" within our microservices ecosystem. The `sub` (subject) of this JWT is the user's full federated identity URN.
* **Persistent Session Management:** Uses `connect-firestore` to persist Express sessions, ensuring users remain logged in across server restarts.

---

## 2. Core Philosophy: Provable, Federated Identity

This service explicitly rejects the traditional model of a centralized identity provider that links all external login methods to a single "master" account.

* **Centralized Model (Rejected):** A user logs in with Google, and the service maps them to an internal ID like `urn:platform:user:12345`. This breaks provenance, as a signature from `urn:platform:user:12345` does not prove *how* the user authenticated.
* **Our Federated Model (Adopted):** A user logs in with Google. The service issues a token for `urn:auth:google:1098...`. This identity is provable and non-repudiable. Any action taken (like signing a message) is cryptographically tied to the fact that the user was authenticated *by Google*.

### Identity URN Specification

All identities are formatted as a **Uniform Resource Name (URN)**. This URN is the `sub` (subject) claim in all JWTs issued by this service.

**Format:** `urn:auth:<provider>:<provider-specific-id>`

* **`urn`**: The standard URN scheme.
* **`auth`**: The namespace, identifying this as an authentication URN.
* **`<provider>`**: A short name for the external identity provider (e.g., `google`, `apple`).
* **`<provider-specific-id>`**: The stable, unique ID issued by that provider.

**Examples:**
* `urn:auth:google:109876543210987654321`
* `urn:auth:apple:001234.a1b2c3d4e5f6.0078`

---

## 3. Pluggable Authorization Policies

The service's authorization logic is not fixed. It is determined at startup by the `AUTH_POLICY` environment variable.

* **`ALLOW_ALL` (Default):**
    * **Policy:** Any user who successfully authenticates with an external provider is allowed in.
    * **Alias:** The user's alias is taken from their public provider profile (e.g., Google Display Name).
* **`MEMBERSHIP`:**
    * **Policy:** Only users whose email address exists in the `authorized_users` Firestore collection are allowed in.
    * **Alias:** The user's alias is taken from the `alias` field in the `authorized_users` collection.
* **`BLOCK`:**
    * **Policy:** All users are allowed *except* for those whose email address exists in the `blocked_users` Firestore collection.
    * **Alias:** The user's alias is taken from their public provider profile.

---

## 4. Authentication Flow

1.  **Request:** A user attempts to log in via a frontend (e.g., `/auth/google`).
2.  **Passport (External):** The service redirects the user to Google's OAuth 2.0 consent screen.
3.  **Callback:** Google redirects the user back to `/auth/google/callback` with their profile.
4.  **Authorization:** The service consults the currently active **Authorization Policy** (e.g., `MembershipPolicy`). The policy checks the user's profile (e.g., `user@google.com`) and returns a decision: `{ isAuthorized: true, alias: 'Bob' }`.
5.  **Identity Minting:** If authorized, the service constructs the new **Federated Identity URN** (e.g., `urn:auth:google:1098...`) using the `profile.id` from Google.
6.  **Token Issuance:** The service generates its own internal JWT. The `sub` claim is set to the federated URN (`urn:auth:google:1098...`), and the `alias` claim is set to the alias from the policy's decision.
7.  **Session:** The service serializes the full `User` object (containing the federated `URN` and the token) into the persistent Firestore session.
8.  **Redirect (Success):** The user is redirected back to the frontend's login success page.
9.  **Internal API Calls:** The frontend can now call `/api/auth/status`. This endpoint reads the user's session, finds the `User` object, and returns it (including the token). The frontend uses this JWT in the `Authorization: Bearer` header to call other microservices.

---

## 5. API Endpoints

### Authentication (Session-Based)

* `GET /auth/google`: Initiates the Google OAuth 2.0 login flow.
* `GET /auth/google/callback`: The callback URL for Google to redirect to.
* `GET /api/auth/status`: Checks if the user has a valid session. If so, returns their federated `User` object (with URN) and the JWT.
* `POST /api/auth/logout`: Logs the user out, destroying their session.

### Token & Key Endpoints (Public)

* `GET /.well-known/jwks.json`: Publishes the public key set (JWKS) used to verify the internal JWTs. Other microservices will fetch this to validate tokens.
* `GET /.well-known/oauth-authorization-server`: Provides OIDC-compatible discovery metadata about this service.

### Internal API (Service-to-Service)

* `GET /api/users/by-email/:email`: (Protected by API Key) Fetches a user's profile data from the `authorized_users` collection. This is used by the `MembershipPolicy` and can be used by other internal admin tools.

---

## 6. Running the Service

### Environment Variables

Before running, ensure your `.env` file is configured. Key variables include:

* `GCP_PROJECT_ID`: Your Google Cloud project ID.
* `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
* `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
* `JWT_PRIVATE_KEY`: Your service's private RSA key for signing JWTs.
* `SESSION_SECRET`: A secure random string for encrypting sessions.
* **`AUTH_POLICY`**: (Optional) Sets the authorization strategy.
    * `ALLOW_ALL` (Default)
    * `MEMBERSHIP`
    * `BLOCK`

### Commands

* **Development:** `nx serve node-identity-service`
* **Production:** `nx build node-identity-service` and run the output from `dist/`.

---

## 7. Example: Messenger App Integration

This service's design enables high-trust applications like a **Sealed Sender Messenger App**.

1.  **Login & Keys:** Bob logs into the app with Google. The app receives a JWT for `urn:auth:google:bob-123`. The app generates a key pair and uploads the public key to a Key Service, associating it with `urn:auth:google:bob-123`.
2.  **Sending:** Bob sends a message to Alice. His app signs the message with the **private key** for `urn:auth:google:bob-123`.
3.  **Verifying:** Alice's app receives the message. It sees the sender is `urn:auth:google:bob-123`. It fetches the public key for this specific URN and verifies the signature. She now has cryptographic proof the message came from Bob *as authenticated by Google*.
4.  **User-Controlled Linking:** If Bob later logs in with Apple (`urn:auth:apple:bob-789`), he appears as a *new person*. To link them, Bob must send a special "link identity" message to Alice. This message, containing his new Apple URN, must be **signed by his trusted Google key**. Alice's app can then verify this request and *locally* associate the two URNs with her "Bob" contact, allowing her app to display both identities in a single thread. The server remains unaware of this link.