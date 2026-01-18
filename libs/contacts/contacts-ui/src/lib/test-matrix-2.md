### 🛡️ The UI Logic Testing Matrix

#### 1. Contact Entity

| Feature / Behavior  | **Unit Test (Vitest)**                                                                                                      | **E2E Test (Playwright)**                                                                                                                    |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data Resolution** | **Verify Priority:** Ensure `contactId` signal picks `selectedUrn` (Input) over Route, and defaults to "New".               | **Verify Loading:** Open app with `?selectedId=...` and verify correct data loads.                                                           |
| **Save (Create)**   | **Verify Output:** Ensure `saved` emits object. <br> **Verify SnackBar:** Check `snackBar.open` called with "Created".      | **Verify Flow:** Click Save $\to$ URL changes to ID $\to$ Form stays visible. <br> **Verify Toast:** Assert "Contact Created" toast appears. |
| **Save (Update)**   | **Verify State:** Ensure `state.saveContact` called. <br> **Verify SnackBar:** Check `snackBar.open` called with "Updated". | **Verify UX:** Edit Field $\to$ Save $\to$ SnackBar "Updated" $\to$ **Form exits Edit Mode**.                                                |
| **Delete**          | **Verify Dialog:** Ensure `MatDialog` opens. <br> **Verify Output:** Ensure `deleted` emits _only_ after confirm.           | **Verify Flow:** Click Delete $\to$ Confirm Dialog $\to$ URL clears (Back to List).                                                          |

#### 2. Group Entity

| Feature / Behavior   | **Unit Test (Vitest)**                                                                                                    | **E2E Test (Playwright)**                                                                    |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| **Data Resolution**  | **Verify Priority:** Ensure `groupId` signal picks `groupId` (Input) over Route, and defaults to "New".                   | **Verify Loading:** Open app with `?selectedId=group-urn` and verify group loads.            |
| **Save (Create)**    | **Verify Output:** Ensure `saved` emits object. <br> **Verify SnackBar:** Check `snackBar.open` called with "Created".    | **Verify Flow:** Click Save $\to$ URL changes to Group ID $\to$ Form stays visible.          |
| **Save (Update)**    | **Verify State:** Ensure `state.saveGroup` called. <br> **Verify SnackBar:** Check `snackBar.open` called with "Updated". | **Verify UX:** Edit Name $\to$ Save $\to$ SnackBar "Updated" $\to$ **Form exits Edit Mode**. |
| **Recursive Delete** | **Verify Dialog:** Ensure Dialog shows "Recursive" option if children exist.                                              | **Verify Flow:** Check "Delete linked chats" $\to$ Confirm $\to$ Verify children deleted.    |

#### 3. List Experience (The "Master" View)

| Feature / Behavior  | **Unit Test (Vitest)**                                                                          | **E2E Test (Playwright)**                                                                                             |
| :------------------ | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Selection State** | **Verify Visuals:** Ensure `selectedId` input applies `.bg-blue-50` and `.border-l-4` classes.  | **Verify Sync:** Click Item $\to$ URL updates to `?selectedId=...` $\to$ Refresh Page $\to$ Item remains highlighted. |
| **Smooth Deletion** | **Verify Animation:** Ensure `@deleteAnimation` trigger is attached to the item host.           | **Verify Ghosting:** Delete item $\to$ Verify element fades out (doesn't snap) before removal from DOM.               |
| **Empty State**     | **Verify Logic:** Pass `[]` to contacts input $\to$ Ensure "No contacts found" message renders. | **Verify Zero-Data:** Load fresh account $\to$ Verify friendly empty state (not broken layout).                       |

#### 4. Desktop Interactions (Mouse & Keyboard)

| Feature / Behavior | **Unit Test (Vitest)**                                                                                                                           | **E2E Test (Playwright)**                                                                                                                  |
| :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Context Menu**   | **Verify Block:** Ensure `(contextmenu)` calls `event.preventDefault()`. <br> **Verify Open:** Ensure signal `menuTrigger.openMenu()` is called. | **Verify UX:** Right Click Item $\to$ Custom Menu appears $\to$ **Browser Context Menu does NOT appear**.                                  |
| **Smart Hover**    | **Verify Timer:** MouseLeave $\to$ Check `setTimeout` called (200ms). <br> **Verify Cancel:** MouseEnter Menu $\to$ Check `clearTimeout` called. | **Verify Grace:** Hover Item $\to$ Menu Trigger appears $\to$ Move mouse _slowly_ to menu (briefly leaving trigger) $\to$ Menu stays open. |

#### 5. Mobile Interactions (Touch & Gesture)

| Feature / Behavior  | **Unit Test (Vitest)**                                                                    | **E2E Test (Playwright Mobile)**                                                           |
| :------------------ | :---------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **Swipe Actions**   | **Verify Threshold:** Emulate touch drag > 50% $\to$ Ensure `delete` event emits.         | **Verify Action:** Swipe Left $\to$ Red "Delete" background revealed.                      |
| **Accordion Logic** | **Verify Reset:** Open Item A $\to$ Open Item B $\to$ Verify Item A `reset()` was called. | **Verify Focus:** Swipe Item A $\to$ Swipe Item B $\to$ Item A snaps closed automatically. |

---

### 🧠 User-i-Stories: The "Why" Behind the Tests

_A User-i-Story documents the human intent behind a technical behavior. It explains why a test exists, preventing accidental "optimizations" that degrade the experience._

#### Story 1: "The Forgiving Mouse"

- **The Behavior:** The Context Menu waits 200ms before closing when the mouse leaves the trigger area.
- **The User Reality:** Users are not robots. When moving the mouse from a list item to a popover menu, they often clip the whitespace in between.
- **The Risk:** Without this delay, the menu snaps shut instantly, forcing the user to try again. This creates "micro-frustration."
- **The Test Guardrail:** `ContactListItemComponent > onMouseLeave > should set close timer` ensures we never optimize this delay away.

#### Story 2: "The Polished Exit"

- **The Behavior:** When an item is deleted, it fades and collapses (`height: 0`) over 300ms rather than vanishing instantly.
- **The User Reality:** When a list item disappears instantly, the items below "teleport" up. This visual jump is jarring and makes the user question if they deleted the _wrong_ item.
- **The Risk:** Removing animations for "performance" makes the app feel cheap and glitchy.
- **The Test Guardrail:** `ContactListComponent > Animations > @deleteAnimation` preserves the "Physics" of the list.

#### Story 3: "The One-at-a-Time Rule" (Mobile)

- **The Behavior:** Swiping one row open immediately snaps any other open row closed.
- **The User Reality:** On small mobile screens, having multiple rows swiped open creates visual clutter and overlapping action buttons ("Red Sea" effect).
- **The Risk:** Users can get confused about which "Delete" button belongs to which contact.
- **The Test Guardrail:** `ContactListComponent > onItemSwipeStart > should reset activeItem` enforces a clean, focused UI.

#### Story 4: "The Native Block" (Desktop)

- **The Behavior:** Right-clicking a contact row explicitly blocks the Browser's standard context menu.
- **The User Reality:** The user expects to control _the App_, not _the Browser_. If the Browser menu covers the App menu, the user flow is broken (focus lost).
- **The Risk:** A refactor might remove `event.preventDefault()` assuming "native is better," breaking the custom actions workflow.
- **The Test Guardrail:** `ContactListItemComponent > onContextMenu > should call preventDefault` protects the immersion.
