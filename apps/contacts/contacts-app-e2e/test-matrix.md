# ✅ UI Testing Matrix & Strategy

This document outlines the **Critical User Journeys (CUJ)** and edge cases that must be covered by the E2E suite.
Use this as a checklist when adding new specifications.

## 🎯 Coverage Legend

- ✅ **Passing:** Implemented and passing.
- 🚧 **WIP:** Implementation started but incomplete.
- ⬜ **Todo:** Planned but not yet written.

---

## 1. Core Lifecycle (The "Happy Paths")

| Status | Feature        | Scenario               | Description                                                                                                 |
| :----- | :------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------- |
| ✅     | **Onboarding** | **The Empty State**    | User visits app with 0 contacts. Should see "No contacts" message and generic empty placeholders.           |
| ✅     | **Read**       | **View List & Detail** | User views a populated list, clicks a contact ("Alice"), and sees correct details in the main view.         |
| ✅     | **Create**     | **Create Contact**     | User clicks "New", fills required fields (Name, Email), saves. Verifies redirection and appearance in list. |
| ⬜     | **Update**     | **Edit Contact**       | User opens existing contact, changes "First Name", saves. Verifies list updates immediately.                |
| ⬜     | **Delete**     | **Delete Contact**     | User opens contact, enters Edit mode, clicks Delete, confirms Dialog. Verifies removal from list.           |

## 2. Validation & Safety (The "Unhappy Paths")

| Status | Feature        | Scenario            | Description                                                                                              |
| :----- | :------------- | :------------------ | :------------------------------------------------------------------------------------------------------- |
| ✅     | **Forms**      | **Required Fields** | User tries to save a new contact without an Email. Save button should be **Disabled**.                   |
| ⬜     | **Forms**      | **Invalid Email**   | User types `bob@` (incomplete). Error message "Invalid email address" should appear.                     |
| ⬜     | **Navigation** | **Unsaved Changes** | User changes a form field and tries to navigate away. Should prompt "Discard changes?" (Future Feature). |

## 3. Contact Groups (Organization)

| Status | Feature    | Scenario             | Description                                                                          |
| :----- | :--------- | :------------------- | :----------------------------------------------------------------------------------- |
| ⬜     | **Read**   | **View Groups Tab**  | User switches sidebar tab to "Groups". Should see list of groups.                    |
| ⬜     | **Create** | **Create Group**     | User creates "Project Alpha", adds 2 members, saves.                                 |
| ⬜     | **Update** | **Modify Members**   | User removes a member from a group. Verifies member count updates.                   |
| ⬜     | **Delete** | **Recursive Delete** | User deletes a group. Checks "Delete linked chats" checkbox. Verifies group is gone. |

## 4. Deep Linking & Routing

_Ensures the app behaves correctly when opened via URL (e.g., from Messenger)._

| Status | Feature     | Scenario                | Description                                                                                                |
| :----- | :---------- | :---------------------- | :--------------------------------------------------------------------------------------------------------- |
| ✅     | **Routing** | **Open by ID**          | URL `/?selectedId=urn:contacts:user:alice` should boot the app with Alice already selected.                |
| ✅     | **Routing** | **Open in Create Mode** | URL `/?new=contact` should boot the app immediately in the Form View.                                      |
| ⬜     | **Routing** | **404 Handling**        | URL `/?selectedId=urn:contacts:user:invalid` should handle the error gracefully (e.g., Toast or Redirect). |

## 5. Responsive / Mobile Layout

_Tests run on `pixel-5` viewport or similar._

| Status | Feature    | Scenario            | Description                                                                 |
| :----- | :--------- | :------------------ | :-------------------------------------------------------------------------- |
| ⬜     | **Layout** | **Sidebar Toggle**  | On mobile, selecting a contact should hide the sidebar and show the detail. |
| ⬜     | **Layout** | **Back Navigation** | On detail view, clicking "Back" arrow should return to list (Sidebar).      |
