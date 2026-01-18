# Component Logic: Contact List

**Component:** `ContactListComponent`
**Type:** Smart Container / UI List
**Stories:** [UX-02: The Polished Exit](../../../../../apps/contacts-e2e/src/docs/test-matrix.md#polished-exit)

## 1. Context Requirements (The "LLM Check")

_Before refactoring this component, you MUST acquire the following context:_

- **The Data Model:** [LLM: Fetch Contact Interface](@nx-platform-application/contacts-types)
  - _Why:_ You need to know if `id` is a string or a `URN` object (It is a URN!).
- **The State Manager:** [LLM: Check Facade Methods](@nx-platform-application/contacts-state)
  - _Why:_ You need to know if `deleteContact()` returns a Promise or an Observable.

## 2. Interaction Physics (The "Feel")

### A. The "Polished Exit" (Animation)

- **Behavior:** When an item is removed, it must fade out over 300ms.
- **Constraint:** Do NOT remove `provideNoopAnimations()` from test setups.
- **Mechanism:** `@trigger('deleteAnimation')` on `:leave`.

### B. Accordion Locking

- **Behavior:** Swiping Row A open must immediately reset Row B.
- **Constraint:** The list maintains a `activeItem` reference.

# Previous revision:

# Component Logic: Contact List

**Component:** `ContactListComponent`
**Type:** Smart Container / UI List
**Stories:**

- [The Polished Exit](../../../../../apps/contacts-e2e/src/docs/stories.md#polished-exit)
- [The One-at-a-Time Rule](../../../../../apps/contacts-e2e/src/docs/stories.md#one-at-a-time)

## 1. State Mechanics (Unit Tests)

_These define the strict input/output contracts._

| Input/Event  | Condition       | Expected Outcome                       | Test Ref                     |
| :----------- | :-------------- | :------------------------------------- | :--------------------------- |
| `contacts`   | `[]` (Empty)    | Render `[data-testid="empty-list"]`    | `should render empty state`  |
| `selectedId` | Matches Contact | Apply `.bg-blue-50` and `.border-l-4`  | `should highlight selected`  |
| `(delete)`   | Output Event    | **Must** emit `Contact` object, not ID | `should emit contact object` |

## 2. Interaction Physics (The "Feel")

_These are critical UX patterns that must not be refactored away._

### A. The "Polished Exit" (Animation)

- **Behavior:** When an item is removed, it must fade out over 300ms.
- **Constraint:** Do NOT remove `provideNoopAnimations()` from test setups.
- **Mechanism:** `@trigger('deleteAnimation')` on `:leave`.

### B. Accordion Locking

- **Behavior:** Swiping Row A open must immediately reset Row B.
- **Constraint:** The list maintains a `activeItem` reference.
