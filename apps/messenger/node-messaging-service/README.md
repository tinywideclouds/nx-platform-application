# **Node Messaging Service**

This service is responsible for managing user-specific address books (contacts) within the platform. It handles fetching a user's contact list and adding new contacts by communicating with the identity-service.

## **Core Features**

* **Contact Management**: Provides API endpoints for users to fetch their address book and add new contacts by email.
* **Secure**: All user-facing API routes are protected using JWT (JSON Web Token) authentication.
* **Service Integration**: Securely communicates with the identity-service using an internal API key to look up user details before adding them as contacts.
* **Cloud Ready**: Uses structured JSON logging (pino) formatted for Google Cloud Logging, including severity and messageKey fields.
* **Database**: Connects to Google Cloud Firestore to store and retrieve address book data.

## **API Endpoints**

### **Health Check**

* **GET /health**
  * **Description**: A public endpoint to verify that the service is running.
  * **Response (200 OK)**:  
    JSON  
    { "status": "ok" }

### **Contacts**

* **GET /api/contacts**
  * **Description**: Fetches the authenticated user's entire address book.
  * **Authentication**: Required (JWT Bearer Token).
  * **Response (200 OK)**:  
    JSON  
    \[  
    { "id": "user-id-123", "email": "contact1@example.com", "alias": "Contact One" },  
    { "id": "user-id-456", "email": "contact2@example.com", "alias": "Contact Two" }  
    \]

* **POST /api/contacts**
  * **Description**: Adds a new contact to the authenticated user's address book. The service first looks up the contact's email in the identity-service and then adds the full contact details to the user's address book in Firestore.
  * **Authentication**: Required (JWT Bearer Token).
  * **Request Body**:  
    JSON  
    { "email": "new.contact@example.com" }

  * **Response (201 Created)**: Returns the full user object of the added contact.  
    JSON  
    { "id": "user-id-789", "email": "new.contact@example.com", "alias": "New Contact" }

  * **Error Responses**:
    * **400 Bad Request**: If the email field is missing from the body.
    * **404 Not Found**: If no user with the specified email exists in the identity-service.

## **Authentication**

This service's protected routes (/api/\*) are secured using the centralized @nx-platform-application/node-auth library.

This middleware is responsible for:

1. Automatically discovering the JSON Web Key Set (JWKS) from the identity-service.
2. Validating the Authorization: Bearer \<token\> JWT on incoming requests.
3. Attaching the decoded user payload to the req.user object, which is then used by the API endpoints.

## **Configuration**

The service is configured using environment variables, which are validated at startup.

| Variable | Description | Default |
| :---- | :---- | :---- |
| PORT | The port the service will run on. | 3001 |
| GCP\_PROJECT\_ID | **(Required)** The Google Cloud Project ID for the Firestore database. | undefined |
| IDENTITY\_SERVICE\_URL | **(Required)** The full base URL of the identity-service (e.g., http://localhost:3000/api). | undefined |
| INTERNAL\_API\_KEY | **(Required)** A shared secret used for server-to-server calls to the identity-service. This must match the key expected by the identity-service. | undefined |

