// In libs/platform/node-auth/src/lib/express.d.ts

// [FIX] Add an empty export to turn this file into a module.
// This ensures that 'moduleResolution: "bundler"' will
// process this file and apply its augmentations.
export {};

// The comment below is no longer accurate, as this is now a module.
// By not having top-level imports, this file is a "global script"

declare module 'express-serve-static-core' {
  interface Request {
    // We use the import() type to get the User type
    // without needing a top-level import statement.
    user?: import('@nx-platform-application/platform-types').User;
  }
}
