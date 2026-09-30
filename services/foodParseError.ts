export class FoodParseError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'invalid',
    // Set when the failure is specific items that couldn't be identified — the
    // message then names them and is safe to show the user as-is.
    readonly unresolvedItems?: string[]
  ) {
    super(message);
  }
}
