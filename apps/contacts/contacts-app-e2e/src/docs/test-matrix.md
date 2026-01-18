# 🛡️ Application Test Matrix

**Scope:** `contacts-app`
**Status:** Living Document

## 1. The Philosophy: Why We Test (Read This First)

_To the Developer: You are not testing code; you are protecting the user's focus._

Our users are often distracted, tired, or in a hurry. They rely on "muscle memory" and "physics" to navigate our app.

- **When an animation is missing**, the app feels "broken" or "disjointed."
- **When a menu snaps shut too fast**, the user feels disorientated or confused: "what just happened".
- **When data vanishes instantly**, the user panics ("Did I delete the wrong one?").

We write tests to lock in these **Feelings**. A functional test proves the feature works; a UX test proves the feature is _pleasant_. If you refactor a component and remove a 200ms delay, you haven't "optimized" the code—you have degraded the human experience.

**Do not delete "inefficient" code without checking the User Story first.**

---

## 2. User-i-Stories (The "Why")

_Global interaction patterns that define our app's personality._

| ID        | Story Name              | The User Reality                      | Technical Guardrail                                                                                     |
| :-------- | :---------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **UX-01** | **The Forgiving Mouse** | Users accidentally leave hover areas. | [LLM: Check 'smart hover' timers](@nx-platform-application/contacts-ui) -> `ContactListItem`            |
| **UX-02** | **The Polished Exit**   | Instant deletion feels glitchy.       | [LLM: Verify @deleteAnimation triggers](@nx-platform-application/contacts-ui) -> `ContactListComponent` |
| **UX-03** | **Data Persistence**    | Users hate losing form data.          | [LLM: Check Signals State](@nx-platform-application/contacts-state) -> `ContactsStateService`           |

## 3. Testing Coverage Map

### Feature: Contact Management

- **E2E Spec:** `user-lifecycle.spec.ts`
- **Page Object:** `ContactsPage` (Shell)

| Journey Step     | Logic Source (Lib)                                                              | Critical Check                                   |
| :--------------- | :------------------------------------------------------------------------------ | :----------------------------------------------- |
| **List Display** | [LLM: Read contact-list.logic.md](@nx-platform-application/contacts-ui)         | Empty states, Selection highlighting.            |
| **Creation**     | [LLM: Read contact-form.logic.md](@nx-platform-application/contacts-ui)         | Validation "Traffic Lights", Save button states. |
| **Deletion**     | [LLM: Read swipeable-item.logic.md](@nx-platform-application/platform-ui-lists) | Swipe thresholds, Animation timing.              |
| **Data Types**   | [LLM: MUST Validate Interfaces](@nx-platform-application/contacts-types)        | Ensure `Contact` object matches API.             |

## 4. Playwright Scenario Catalog

_Database states available via `?scenario=...` query param._

- `empty`: No contacts, fresh account.
- `populated`: 10 seed contacts (Alice, Bob...).
- `error-state`: API returns 500 on Save (for Toast testing).

# Previous revision:

# 🛡️ Application Test Matrix

**Scope:** `contacts-app`
**Status:** Living Document

## 1. User-i-Stories (The "Why")

_Global interaction patterns that define our app's personality._

| ID        | Story Name              | The User Reality                      | Technical Guardrail                                    |
| :-------- | :---------------------- | :------------------------------------ | :----------------------------------------------------- |
| **UX-01** | **The Forgiving Mouse** | Users accidentally leave hover areas. | Context Menu has 200ms close delay.                    |
| **UX-02** | **The Polished Exit**   | Instant deletion feels glitchy.       | List items fade out (opacity 1->0) before DOM removal. |
| **UX-03** | **Data Persistence**    | Users hate losing form data.          | Edit mode persists even if `selectedId` changes URL.   |

## 2. Testing Coverage Map

### Feature: Contact Management

- **E2E Spec:** `user-lifecycle.spec.ts`
- **Page Object:** `ContactsPage` (Shell)

| Journey Step     | Logic Source (Lib)                                                                        | Critical Check                                   |
| :--------------- | :---------------------------------------------------------------------------------------- | :----------------------------------------------- |
| **List Display** | [Contact List Logic](../../libs/contacts/ui/src/lib/contact-list/contact-list.logic.md)   | Empty states, Selection highlighting.            |
| **Creation**     | [Contact Form Logic](../../libs/contacts/ui/src/lib/contact-form/contact-form.logic.md)   | Validation "Traffic Lights", Save button states. |
| **Deletion**     | [Swipe Item Logic](../../libs/platform/ui/src/lib/swipeable-item/swipeable-item.logic.md) | Swipe thresholds, Animation timing.              |

## 3. Playwright Scenario Catalog

_Database states available via `?scenario=...` query param._

- `empty`: No contacts, fresh account.
- `populated`: 10 seed contacts (Alice, Bob...).
- `error-state`: API returns 500 on Save (for Toast testing).
