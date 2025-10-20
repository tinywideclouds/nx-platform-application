# ⚠️ Messenger Protos (Generator Lib)

This is a "Generator" library, not a standard "Facade" library.

**This library's only purpose is to contain the `.proto` definitions for the Messenger scope and to generate raw TypeScript and Go code from them.**

---

## 🛑 DO NOT IMPORT FROM THIS LIBRARY 🛑

Our monorepo architecture forbids importing from this library directly. All generated code is considered an internal implementation detail.

You should almost always import from its "buddy" library instead, which provides friendly, idiomatic TypeScript interfaces and mappers:

**`@nx-messenger-application/messenger-types`**

Our root ESLint configuration (`eslint.config.mjs`) enforces this rule.

---

## For Maintainers

If you modify any `.proto` files in the `src/` directory, you must regenerate the code by running:

```bash
# Assumes the name in project.json is 'messenger-protos'
nx run messenger-protos:generate
