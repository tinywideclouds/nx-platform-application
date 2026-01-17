export const FormValidators = {
  required: (value: string | null | undefined): boolean => {
    return value !== null && value !== undefined && value.trim().length > 0;
  },

  email: (value: string | null | undefined): boolean => {
    if (!value) return true; // Optional fields pass if empty
    // Simple regex for demonstration.
    // In production, consider a more robust regex or library.
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  },
};
