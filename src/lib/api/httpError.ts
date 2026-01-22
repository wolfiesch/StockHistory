export class HTTPError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'HTTPError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}
