// Generation guard for requests that cannot be aborted at the transport
// (@forge/bridge invoke() has no abort): each ask/reset/cancel bumps the
// generation, and a late response only applies when its generation is
// still current. Without this, "New analysis" (or Stop) during a request
// could be overwritten by the late response arriving afterwards.
export class RequestGeneration {
  private current = 0;

  next(): number {
    this.current += 1;
    return this.current;
  }

  invalidate(): void {
    this.current += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.current;
  }
}
