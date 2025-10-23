# **Platform Node.js Auth Library**

libs/platform/node-auth

This is a scope:platform library, part of the monorepo's core foundation.

Its purpose is to provide a single, standardized, reusable **Express middleware** for authenticating and parsing JWTs issued by the identity-service.

This library is intended for consumption by any **Node.js Resource Server** (like the node-messaging-service) that needs to protect its API routes.

---

## **How It Works**

This is not a traditional auth library; it is a **JWT consumer**. Its logic is based on the [OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) standard:

1. **Service Discovery:** On startup, the middleware makes a single axios call to the identity-service's /.well-known/oauth-authorization-server endpoint.
2. **Key Fetching:** It extracts the jwks\_uri from the metadata.
3. **Verification:** It uses jose.createRemoteJWKSet to create a key client. For every incoming request, jose.jwtVerify uses this client to validate the token's signature against the public keys.
4. **User Injection:** If the token is valid, the middleware parses its claims and attaches a User object to req.user.

---

## **Usage**

In your Node.js application (e.g., apps/messenger/node-messaging-service/src/main.ts), import and use the factory function.

TypeScript

// 1\. Import your app config and the new middleware  
import { config } from './config.js';  
import { createJwtAuthMiddleware } from '@nx-platform-application/platform-node-auth';

// ...  
async function startServer() {  
// ...

// \--- 5\. CREATE EXPRESS APP & MIDDLEWARE \---  
const app \= express();  
app.use(helmet());  
app.use(express.json());

// 2\. Create the middleware instance, passing in the  
//    URL of the identity-service from your config.  
const authMiddleware \= createJwtAuthMiddleware(config.identityServiceUrl);

// \--- 6\. DEFINE API ROUTES \---

// This health check is unprotected  
app.get('/health', (\_req, res) \=\> {  
res.status(200).json({ status: 'ok' });  
});

// 3\. Apply the middleware to protect all /api routes  
app.get('/api/contacts', authMiddleware, async (req, res, next) \=\> {  
// 4\. The user is now available\!  
const owner \= req.user as User;  
// ...  
});

// ...  
}

---

## **Type Augmentation**

This library uses **module augmentation** to automatically add the user property to the express.Request interface.

By simply importing this library, TypeScript will understand that req.user is a valid property of type User, which you can use in all your protected routes.

TypeScript

// This type is added automatically  
// (from libs/platform/node-auth/src/lib/express.d.ts)

declare module 'express-serve-static-core' {  
interface Request {  
user?: User;  
}  
}

---

## **Running Tests**

To run the library's local unit tests:

Bash

npx nx test node-auth  
