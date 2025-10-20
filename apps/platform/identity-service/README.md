# **Node.js Identity Service**

## **1. Overview**

The node-identity-service is a centralized, standalone microservice responsible for managing user identity and authentication for the entire application ecosystem. Its sole purpose is to verify a user's identity against trusted external identity providers (e.g., Google) and, upon successful verification, issue a secure, internal JSON Web Token (JWT).

This service acts as the single gateway for user login, abstracting the authentication logic away from all other backend services. This ensures a clean separation of concerns, enhances security, and allows for flexible integration of new authentication methods in the future without impacting other parts of the system.

### **Key Features**

* **External Provider Integration:** Currently supports Google OAuth 2.0 for user authentication.
* **Authorization Check:** Verifies that an authenticated user is listed in a Firestore `authorized_users` collection before granting access.
* **Internal JWT Issuance:** Creates and signs its own internal JWT, which serves as the user's "passport" within our microservices ecosystem.
* **Nested Identity Pattern:** For enhanced security and traceability, the internal JWT "wraps" the original, unmodified ID Token from the external provider.
* **[UPDATED] Persistent Session Management:** Uses `connect-firestore` to persist Express sessions in Firestore, ensuring users remain logged in across server restarts.

## **2. Architecture**

This service is a core component of the "Platform" architecture. It authenticates a user and issues a token, but it does not contain any business logic related to that user.

Other services (e.g., `messenger-service`) will receive this JWT and use it to identify the user, but they must *never* attempt to authenticate a user themselves.

### **Authentication Flow**

1.  **Request:** A user attempts to log in via a frontend application.
2.  **Redirect:** The frontend redirects the user to this service's `/auth/google` endpoint.
3.  **Passport (External):** This service redirects the user to Google's OAuth 2.0 consent screen.
4.  **Callback:** Google redirects the user back to `/auth/google/callback` with a one-time code.
5.  **Verification:** The service exchanges the code for a Google ID Token and user profile.
6.  **Authorization:** It queries the `authorized_users` collection in Firestore using the user's email.
7.  **Session:** If the user is authorized, a persistent session is created for them using `connect-firestore`.
8.  **Token Issuance:** The service generates its own internal, signed JWT (containing the user's ID, alias, and the original Google ID token) and stores it in the user's session.
9.  **Redirect (Success):** The user is redirected back to the frontend's login success page.
10. **Internal API Calls:** The frontend can now call internal API endpoints (e.g., `/api/auth/status`) which will read the user's session, find the internal JWT, and return it. The frontend then uses this JWT in the `Authorization: Bearer` header when calling other microservices.

## **3. API Endpoints**

### **Authentication (Session-Based)**

* `GET /auth/google`: Initiates the Google OAuth 2.0 login flow.
* `GET /auth/google/callback`: The callback URL for Google to redirect to.
* `GET /api/auth/status`: Checks if the user has a valid session. If so, returns their user info and a fresh internal JWT.
* `POST /api/auth/logout`: Logs the user out, destroying their session.

### **Token & Key Endpoints (Public)**

* `GET /.well-known/jwks.json`: Publishes the public key set (JWKS) used to verify the internal JWTs. Other microservices will fetch this to validate tokens.
* `GET /.well-known/oauth-authorization-server`: Provides OIDC-compatible discovery metadata about this service.

### **Internal API (Service-to-Service)**

* `GET /api/users/by-email/:email`: (Protected by API Key) Fetches a user's profile by their email.

## **4. Running the Service**

* For Development:
  npm run dev

* For Production:
  First, build the TypeScript code into JavaScript:
  npm run build

  Then, run the compiled output:
  npm start

## 5 Future Roadmap

This service is foundational. The following roadmap outlines key improvements to enhance its security and functionality.

**Add More Identity providers:** The modular structure in `src/internal/auth/` is designed for this. To add Microsoft, for example, we would:

1.  Create `microsoft.strategy.ts`.
2.  Add the new strategy to `passport.config.ts`.
3.  Add the corresponding routes (`/auth/microsoft`, etc.) to `main.ts`.

**Advanced Token Refresh:** The current `/api/auth/refresh-token` endpoint is a placeholder. A full implementation would involve securely using the `refreshToken` obtained from the initial OAuth flow to request a new `id_token` from the provider, allowing for a more robust and secure refresh of the nested identity.

**Token Revocation:** Implement a mechanism (e.g., a Redis blocklist) to allow for the immediate revocation of a JWT if a user's session needs to be terminated urgently (e.g., if a user changes their password or reports a security issue).
