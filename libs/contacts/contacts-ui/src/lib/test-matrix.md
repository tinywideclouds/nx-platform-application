### 🛡️ The UI Logic Testing Matrix

| Feature / Behavior  | **Unit Test (Vitest)**                                                                                                                      | **E2E Test (Playwright)**                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Data Resolution** | **Verify Priority:** Ensure `contactId` signal picks `selectedUrn` (Input) over Route, and correctly defaults to "New" if both are missing. | **Verify Loading:** Open app with `?selectedId=...` and ensure correct data loads. |
| **Save (Create)**   | **Verify Output:** Ensure `saved` emits the object. <br>                                                                                    |

<br> **Verify SnackBar:** Check `snackBar.open` called with "Created". | **Verify Flow:** Click Save URL changes to ID Form stays visible. <br>

<br> **Verify Toast:** Assert "Contact Created" toast appears. |
| **Save (Update)** | **Verify State:** Ensure `state.saveContact` is called. <br>

<br> **Verify SnackBar:** Check `snackBar.open` called with "Updated". | **Verify UX:** Edit Field Save SnackBar "Updated" appears **Form exits Edit Mode** automatically. |
| **Delete** | **Verify Dialog:** Ensure `MatDialog` opens. <br>

<br> **Verify Output:** Ensure `deleted` emits _only_ after dialog confirm. | **Verify Flow:** Click Delete Confirm Dialog URL clears (Back to List). |
| **Navigation (Viewer)** | **Verify Router:** Check `router.navigate` is called with correct params when `(saved)` or `(cancelled)` fires. | **Verify Mobile Back:** Click Mobile Header "Back" URL clears Sidebar visible. |
| **Layout (Scroll)** | _(Not applicable - Unit tests don't render real CSS)_ | **Verify Single Scroll:** Check that `body` is not scrolling, only the `.md-main` container is. (Critical for the double-scrollbar fix). |
| **Group Membership** | **Verify Props:** Ensure `[groups]` input is passed to Form. | **Verify UI:** Create Contact Add to Group Verify Chip appears in Contact Form. |

---

### 🔍 detailed Test Specification

#### 1. Unit Specs (The "Logic" Layer)

_Target Files: `contact-page.component.spec.ts`, `contacts-viewer.component.spec.ts_`

- **Refactor `ContactPage` Spec:**
- **Test:** `should derive contactId from Input over Route`.
- **Test:** `should call SnackBar with 'created' when isNew=true`.
- **Test:** `should call SnackBar with 'updated' when isNew=false`.
- **Test:** `should open Dialog on delete and emit deleted on close(true)`.

- **Refactor `ContactsViewer` Spec:**
- **Test:** `should navigate to { selectedId: id } on (saved)`.
- **Test:** `should navigate to { selectedId: null } on (deleted)`.

#### 2. E2E Specs (The "Experience" Layer)

_Target Files: `user-lifecycle.spec.ts`, `layout.spec.ts_`

- **Update `User Lifecycle`:**
- **Step:** Create Contact `Alice`.
- **Assert:** URL is now `/contacts?selectedId=...`.
- **Assert:** Toast "Contact 'Alice' created" is visible.
- **Action:** Click "Edit", change name to `Alice B.`. Click "Save".
- **Assert:** Toast "Contact 'Alice B.' updated" is visible.
- **Assert:** "Save" button is hidden (Edit mode exited).

- **New `Layout Scroll` Check:**
- **Scenario:** Load a long contact form on Mobile View.
- **Assert:** The `window` scroll Y is 0.
- **Assert:** The `[main]` container `scrollHeight > clientHeight`.
- **Assert:** No other scrollable containers exist (e.g., `contacts-viewer` itself).

### 🛡️ The UI Logic Testing Matrix

#### 1. Contact Entity

| Feature / Behavior  | **Unit Test (Vitest)**                                                                                                      | **E2E Test (Playwright)**                                                                                                                    |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data Resolution** | **Verify Priority:** Ensure `contactId` signal picks `selectedUrn` (Input) over Route, and defaults to "New".               | **Verify Loading:** Open app with `?selectedId=...` and verify correct data loads.                                                           |
| **Save (Create)**   | **Verify Output:** Ensure `saved` emits object. <br> **Verify SnackBar:** Check `snackBar.open` called with "Created".      | **Verify Flow:** Click Save $\to$ URL changes to ID $\to$ Form stays visible. <br> **Verify Toast:** Assert "Contact Created" toast appears. |
| **Save (Update)**   | **Verify State:** Ensure `state.saveContact` called. <br> **Verify SnackBar:** Check `snackBar.open` called with "Updated". | **Verify UX:** Edit Field $\to$ Save $\to$ SnackBar "Updated" $\to$ **Form exits Edit Mode**.                                                |
| **Delete**          | **Verify Dialog:** Ensure `MatDialog` opens. <br> **Verify Output:** Ensure `deleted` emits _only_ after confirm.           | **Verify Flow:** Click Delete $\to$ Confirm Dialog $\to$ URL clears (Back to List).                                                          |

#### 2. Group Entity (NEW)

| Feature / Behavior   | **Unit Test (Vitest)**                                                                                                    | **E2E Test (Playwright)**                                                                    |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| **Data Resolution**  | **Verify Priority:** Ensure `groupId` signal picks `groupId` (Input) over Route, and defaults to "New".                   | **Verify Loading:** Open app with `?selectedId=group-urn` and verify group loads.            |
| **Save (Create)**    | **Verify Output:** Ensure `saved` emits object. <br> **Verify SnackBar:** Check `snackBar.open` called with "Created".    | **Verify Flow:** Click Save $\to$ URL changes to Group ID $\to$ Form stays visible.          |
| **Save (Update)**    | **Verify State:** Ensure `state.saveGroup` called. <br> **Verify SnackBar:** Check `snackBar.open` called with "Updated". | **Verify UX:** Edit Name $\to$ Save $\to$ SnackBar "Updated" $\to$ **Form exits Edit Mode**. |
| **Recursive Delete** | **Verify Dialog:** Ensure Dialog shows "Recursive" option if children exist.                                              | **Verify Flow:** Check "Delete linked chats" $\to$ Confirm $\to$ Verify children deleted.    |

#### 3. Shared Experience

| Feature / Behavior  | **Unit Test**                                                                                 | **E2E Test**                                                                               |
| :------------------ | :-------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **Navigation**      | **Verify Router:** Check `navigate` called with correct params on `(saved)` or `(cancelled)`. | **Verify Mobile Back:** Click Mobile Header "Back" $\to$ URL clears $\to$ Sidebar visible. |
| **Layout (Scroll)** | _(N/A)_                                                                                       | **Verify Single Scroll:** Check `body` is locked, only `.md-main` scrolls.                 |
