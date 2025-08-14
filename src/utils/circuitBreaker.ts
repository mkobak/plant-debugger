// Circuit breaker utility to prevent API abuse and excessive retries
class CircuitBreaker {
  private failureCount = 0;
  private isOpen = false;
  private lastFailureTime = 0;
  private lastCallTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly callInterval: number;

  constructor(
    failureThreshold = 3,
    resetTimeout = 30000, // 30 seconds before closing circuit
    callInterval = 5000 // 5 seconds minimum between calls
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.callInterval = callInterval;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Throttle: check if calls are too frequent
    if (now - this.lastCallTime < this.callInterval) {
      throw new Error(
        `Too frequent calls. Please wait ${Math.ceil((this.callInterval - (now - this.lastCallTime)) / 1000)} seconds.`
      );
    }

    // If circuit is open, block calls until resetTimeout passes
    if (this.isOpen) {
      if (now - this.lastFailureTime < this.resetTimeout) {
        throw new Error(
          `Circuit breaker is open. Try again in ${Math.ceil((this.resetTimeout - (now - this.lastFailureTime)) / 1000)} seconds.`
        );
      } else {
        // Try to close the circuit after timeout
        this.isOpen = false;
        this.failureCount = 0;
      }
    }

    this.lastCallTime = now;

    try {
      const result = await fn();
      // On success, reset failure count
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = now;

      if (this.failureCount >= this.failureThreshold) {
        this.isOpen = true;
        console.warn(
          `Circuit breaker opened after ${this.failureCount} failures`
        );
      }

      throw error;
    }
  }

  getStatus() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      timeSinceLastFailure: this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : 0,
      timeSinceLastCall: this.lastCallTime ? Date.now() - this.lastCallTime : 0,
    };
  }
}

// Global circuit breakers for different API endpoints
export const initialDiagnosisCircuitBreaker = new CircuitBreaker(
  2,
  30000,
  10000
); // 10 second minimum between calls
export const finalDiagnosisCircuitBreaker = new CircuitBreaker(2, 30000, 5000);
