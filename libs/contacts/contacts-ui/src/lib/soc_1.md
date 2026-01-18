soc: I'm on desktop, 2 contacts in the sidebar, Alice and Bob - nothing in the main component except "Select a contact to view details" (the default text there seems slightly ugly, seems too close to top - also seems a bit of a waste of potentially useful space - what whould we put there in the default main that would not get annoying after a while?) OK I click on Alice - details appear in main (very sudden transition - not terrible but...). Details is very form like (because I know it _is_ a form this is not unexpected but a user might feel it is a bit too form like). Other first impressions: The list top menu (LLM I need to show you that) look good here. The main section top menu looks a bit "cheap" it is just showing Contact and far right a [close] button. Hitting [close] returns everything to original state, again sudden. OK so far - nothing is too bad, not perfect but no disasters yet. List view interactions - I click Alice, then I click Bob -> it is very smooth -> almost too smooth, the layout is very stable, what it looks like to the viewer is that the First Name, Surname etc just get their contents changed - there is no feeling of moving from one contact _page_ to the next. OK I click [edit] on Bob - feeling: this is mostly good - I think the 'traffic light' system works well - the 'edit' state is very obvious. I change the name Bob to Bobs - OK 1 suggestion: we should add an edit indicator - if I move to Surname there is no indicator that 1 changed Bob to Bobs - if I do multiple edits I might loose track of what I intended to do. Just some comments on layout - we imposed a max width on the form inputs - this is good but it can leave us with a lot of whitespace - is there a better way to use space on a desktop layout? Member of groups - this is good semantic information but poor UI - no tooltips - no linking to groups etc. OK I think we now have a good idea of my stream of consiousness for components - can we turn this into something more matrix, more specification - lets go to an intermediate stage first where we talk about what we're going to do.

### response

This is a fantastic critique. You have successfully identified the difference between **Functional Correctness** (The code works) and **Perceived Quality** (The app feels "cheap" or "solid").

Here is the **Intermediate Strategy Phase**. I have translated your "Stream of Consciousness" into concrete **UX Gaps** and proposed **User-i-Stories**.

We are not writing the tests yet; we are defining _what_ is worth testing.

### 1. The "Empty Canvas" Problem

- **Your Observation:** "Default text is ugly, wasted space. What would not get annoying?"
- **The Code Reality:** currently just a centered icon and text in `contacts-viewer.component.html`.

- **The UX Gap:** The user feels "abandoned" in the empty state. It’s a dead end.
- **Proposed Story:** **UX-06: The Helpful Dashboard**
- **Concept:** Instead of empty space, show "Recent Actions" or "Quick Stats" (e.g., "5 Contacts created this week").
- **Why:** It makes the app feel "alive" even when idle. It turns a passive screen into an active tool.
- **Testable:** Verify dashboard elements render when `selectedId` is null.

### 2. The "Phantom" Navigation

- **Your Observation:** "It is very smooth -> almost too smooth... there is no feeling of moving from one contact _page_ to the next."
- **The Code Reality:** `ContactPageComponent` uses a Signal (`contact`) that updates instantly when `selectedUrn` changes. Because it's the _same component instance_, Angular just hot-swaps the text nodes. There is no teardown/rebuild.

- **The UX Gap:** **Disorientation.** The user clicks "Bob", looks away, looks back, and sees "Alice" logic but isn't _sure_ the screen changed.
- **Proposed Story:** **UX-07: The Physical Transition**
- **Concept:** When `selectedId` changes, trigger a rapid (150ms) "cross-fade" or "slide" animation.
- **Why:** It provides a visual "checkpoint" that confirms: "You have left Alice. You are now with Bob."
- **Testable:** Verify animation classes/triggers fire on Route param change.

### 3. The "Form Fatigue" (Read Mode)

- **Your Observation:** "Details is very form like... a user might feel it is a bit too form like."
- **The Code Reality:** `contact-form.component.html` uses standard `<input matInput>` elements even in read-mode. We use `.form-view-mode` CSS to strip some styling, but structurally, it’s still a form.

- **The UX Gap:** **Cognitive Load.** A form says "Work to be done." A profile card says "Information to be consumed."
- **Proposed Story:** **UX-08: The Reading Room**
- **Concept:** In Read Mode, replace `<input>` borders/backgrounds entirely with plain text styling. Only reveal the "Input Chrome" (underlines, labels) when entering Edit Mode.
- **Why:** Reduces visual noise when the user is just browsing.
- **Testable:** Verify Inputs are structurally distinct (or styled invisibly) in Read Mode.

### 4. The "Dirty" Trail

- **Your Observation:** "If I move to Surname there is no indicator that I changed Bob to Bobs."
- **The Code Reality:** `ContactFormComponent` tracks `touched`, but only to show _Errors_ (Red). It does not track _Modifications_ (e.g., Blue/Amber highlight for "Changed but Valid").

- **The UX Gap:** **Loss of Context.** In a long form, the user forgets what they tweaked.
- **Proposed Story:** **UX-09: The Breadcrumb Trail**
- **Concept:** Compare `currentValue` vs `originalValue`. If different, add a specific visual cue (e.g., a left border or a "modified" icon).
- **Why:** Confidence. The user knows exactly what will happen when they hit Save.
- **Testable:** Change value -> Verify "Modified" indicator. Change back -> Verify indicator gone.

### 5. The "Cheap" Header

- **Your Observation:** "Main section top menu looks a bit 'cheap'... hitting [close] returns everything to original state, again sudden."
- **The Code Reality:** `contacts-page-toolbar.component.html` is a simple flex row. The "Close" button just emits `cancelled`, which clears the selection instantly.

- **The UX Gap:** **Lack of Hierarchy.** The Toolbar is the "Command Center" of the page. It needs to feel sturdy.
- **Proposed Story:** **UX-10: The Command Center**
- **Concept:** Add "Context Actions" (e.g., "Add to Group", "Star") to the toolbar. Make the Close action feel like "putting the file back in the cabinet" (animation), not "destroying the world."

---

### Summary of the Plan

We are moving from a **"Functional CRUD App"** to a **"Polished Product."**

**The Proposed Matrix Update:**

| ID        | Story Name                  | The "Feeling"             | Technical Goal                           |
| --------- | --------------------------- | ------------------------- | ---------------------------------------- |
| **UX-06** | **The Helpful Dashboard**   | "I am starting a task."   | Replace empty state with "Recent Items". |
| **UX-07** | **The Physical Transition** | "I turned the page."      | Animate `selectedId` changes.            |
| **UX-08** | **The Reading Room**        | "I am reading a profile." | Hide Form Chrome in Read Mode.           |
| **UX-09** | **The Breadcrumb Trail**    | "I know what I changed."  | Visual diff of `current` vs `original`.  |

**Shall we proceed to draft the `UX-05: The Master-Detail Flow` test specs first (covering the existing "Form Fatigue" and "Phantom Navigation" baseline), or do you want to start implementing the "Breadcrumb Trail" logic immediately?**
