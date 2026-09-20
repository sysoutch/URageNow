/** Error whose status is safe to return from the named-tool API. */
export class ToolInvocationError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}