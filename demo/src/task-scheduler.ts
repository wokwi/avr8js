// Faster setTimeout(fn, 0) implementation using postMessage API
// Based on https://dbaron.org/log/20100309-faster-timeouts
export type IMicroTaskCallback = () => void;

export class MicroTaskScheduler {
  readonly messageName = 'zero-timeout-message';

  private executionQueue: Array<IMicroTaskCallback> = [];
  private stopped = true;

  start() {
    if (this.stopped) {
      this.stopped = false;
      window.addEventListener('message', this.handleMessage, true);
    }
  }

  stop() {
    this.stopped = true;
    window.removeEventListener('message', this.handleMessage, true);
  }

  postTask(fn: IMicroTaskCallback) {
    if (!this.stopped) {
      this.executionQueue.push(fn);
      window.postMessage(this.messageName, '*');
    }
  }

  private handleMessage = (event: MessageEvent) => {
    if (event.data === this.messageName) {
      event.stopPropagation();
      const executeJob = this.executionQueue.shift();
      if (executeJob !== undefined) {
        executeJob();
      }
    }
  };
}
