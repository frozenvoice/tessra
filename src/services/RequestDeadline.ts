import { performance } from 'perf_hooks';

export class RequestTimeoutError extends Error {
  constructor(timeoutSec: number) {
    super(`Request timed out (${timeoutSec}s)`);
    this.name = 'RequestTimeoutError';
  }
}

// 첫 전송부터 재시도 대기까지 같은 단조 시간 예산을 공유한다. 0은 무제한이다.
export class RequestDeadline {
  private readonly expiresAt: number;

  constructor(
    private readonly timeoutSec: number,
    private readonly now: () => number = () => performance.now()
  ) {
    this.expiresAt = Number.isFinite(timeoutSec) && timeoutSec > 0
      ? now() + timeoutSec * 1000
      : Infinity;
  }

  remainingMs(): number {
    return this.expiresAt === Infinity ? Infinity : Math.max(0, this.expiresAt - this.now());
  }

  throwIfExpired(): void {
    if (this.remainingMs() <= 0) { throw new RequestTimeoutError(this.timeoutSec); }
  }
}
