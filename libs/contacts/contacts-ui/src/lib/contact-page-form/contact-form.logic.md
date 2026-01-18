# Component Logic: Contact Form

**Component:** `ContactFormComponent`
**Type:** Presentational / Form
**Stories:** [UX-04: The Traffic Light](../../../../../../apps/contacts-e2e/src/docs/test-matrix.md#traffic-light)

## 1. Context Requirements (The "LLM Check")

_Before refactoring this component, you MUST acquire the following context:_

- **The Validators:** [LLM: Fetch Platform Validators](@nx-platform-application/platform-ui-forms)
  - _Reason:_ We use strict regex for emails; do not use standard Angular validators.
- **The State:** [LLM: Check Input Signals](@nx-platform-application/contacts-types)
  - _Reason:_ Form uses `input.required` signals. Do not convert to `@Input`.

## 2. Interaction Physics (The "Feel")

### A. The "Traffic Light" System

- **User Feeling:** "The app is guiding me, not yelling at me."
- **Behavior:**
  - **Empty:** No icon (unless touched).
  - **Typing:** Amber `priority_high` icon (Validating/Incomplete).
  - **Valid:** Green `check_circle` icon (Safe to proceed).
  - **Error:** Red `error` icon (Stop).
- **Constraint:** Do not remove the "Amber" state. It provides crucial feedback that the field is "active" but not "done".

### B. The "Semi-Active" Save Button

- **User Feeling:** "I know where to click next."
- **Behavior:** The Save button is never fully hidden.
  - **Disabled:** If form is completely empty.
  - **Semi-Transparent:** If form has data but is invalid.
  - **Solid:** Ready to save.

### C. The "Breadcrumb Trail" (UX-09)

- **User Feeling:** "I know what I have changed."
- **Problem:** In a long form, users forget if they actually modified a field or just clicked inside it.
- **Behavior:**
  - Compare `currentValue` vs `originalValue` (from the Input).
  - **Visual Cue:** If different, show a distinct indicator (e.g., a Blue vertical bar or "Modified" icon).
  - **Restoration:** If the user changes it back to the original value, the indicator must disappear.
- **Constraint:** This is distinct from "Touched" (Focus/Blur). A field can be Touched but not Modified, and vice-versa.
