export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  // Strict regex rejecting consecutive dots, invalid chars, etc.
  const emailRegex = /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}
