import * as v from 'valibot';

// Reusable Atom for Group Names
export const GroupNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Group name is required'),
  v.minLength(3, 'Group name must be at least 3 characters'),
);

// The Full Blueprint
export const ContactGroupSchema = v.object({
  name: GroupNameSchema,
  description: v.optional(v.string()),
});

export type ContactGroupModel = v.InferInput<typeof ContactGroupSchema>;
