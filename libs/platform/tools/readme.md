# 🛠️ Platform Tools

**Scope:** `libs/platform/tools/*`
**Classification:** Pure Utilities

## 🧠 Architectural Role

The **Tools** layer contains purely functional, side-effect-free utilities. These libraries must **never** contain business logic, state management, or domain knowledge.

They are the "Leaf Nodes" of our dependency graph—they can be imported by _any_ layer (Infrastructure, Domain, State, UI), but they must **never** import from those layers.

## 🛡️ The "Tools" Contract

1.  **Stateless:** Tools must not hold state between calls.
2.  **Universal:** Functionality must be generic enough to be used by `messenger`, `contacts`, or any future app.
3.  **Zero Dependencies:** Tools should ideally depend only on the platform (Browser APIs, Angular Core) and not on other internal libraries.

## 📂 Contents

| Library              | Package                                                    | Purpose                                                                 |
| :------------------- | :--------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Console Logger**   | `@nx-platform-application/console-logger`                  | Standardized logging wrapper for consistent observability.              |
| **Image Processing** | `@nx-platform-application/platform-tools-image-processing` | Client-side image manipulation (Resize/Encode) using `OffscreenCanvas`. |

```

```
