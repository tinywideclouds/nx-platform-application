# Component Logic: Contact Page

**Component:** `ContactPageComponent`
**Type:** Smart / Feature Page
**Stories:**

- [UX-07: The Physical Transition](../../../../../apps/contacts-e2e/src/docs/test-matrix.md#physical-transition)
- [UX-08: The Reading Room](../../../../../apps/contacts-e2e/src/docs/test-matrix.md#reading-room)
- [UX-10: The Command Center](../../../../../apps/contacts-e2e/src/docs/test-matrix.md#command-center)
- **New:** UX-13 (The Active Save)

## 1. Context Requirements (The "LLM Check")

_Before refactoring this component, you MUST acquire the following context:_

- **The Routing:** [LLM: Check Router Params](@angular/router)
  - _Reason:_ The page state is derived from a complex merge of `Route Params` (Deep Link) and `Inputs` (Master-Detail Selection).
- **The Toolbar:** [LLM: Check Toolbar Component](@nx-platform-application/contacts-ui)
  - _Reason:_ The toolbar is responsive and adapts its buttons based on the page state.

## 2. Interaction Physics (The "Feel")

### A. The "Physical Transition" (UX-07)

- **Status:** _Planned / Future_
- **User Feeling:** "I turned the page."
- **Behavior:**
  - When `selectedId` changes, the content should not snap instantly.
  - **Requirement:** Trigger a rapid (150ms) cross-fade or slide animation.
  - **Constraint:** The new data must NOT render until the old data has started exiting.

### B. The "Reading Room" (UX-08)

- **User Feeling:** "I am reading a profile, not filling out a tax return."
- **Behavior:**
  - **Read Mode:** Inputs should look like plain text (no borders, no backgrounds).
  - **Edit Mode:** Inputs reveal their "Chrome" (borders, labels, floating hints).
  - **Mechanism:** Toggled via the `isEditMode` signal.

### C. The "Command Center" (UX-10 & UX-13)

- **User Feeling:** "I am in control. The app guides me, it doesn't block me."
- **Behavior:**
  - The Toolbar is the source of truth for Actions.
  - **Close Action:** Must emit `cancelled`. It should feel like "putting the file back," not "destroying it."
  - **The "Active Save" (UX-13):**
    - The Save button is **ALWAYS clickable**, even if invalid.
    - **Visuals:** Primary (Valid) vs Warn (Invalid/Issues).
    - **Action:** Clicking "Issues (N)" forces the form to reveal errors and jump focus.

## 3. Data Resolution Logic

The page determines its state (`isNew` vs `isEditMode`) by merging Route Params and Inputs.

| Priority     | Source                  | Condition      | Resulting Mode                        |
| :----------- | :---------------------- | :------------- | :------------------------------------ |
| **1 (High)** | `[selectedUrn]` (Input) | Value exists   | **View/Edit** (Master-Detail context) |
| **2**        | `route.params.id`       | Value exists   | **View/Edit** (Deep Link context)     |
| **3 (Low)**  | `route.params.id`       | Null/Undefined | **New** (Creation context)            |

}
