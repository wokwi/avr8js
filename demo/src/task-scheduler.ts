import Emittery from 'emittery';

// Faster setTimeout(fn, 0) implementation using postMessage API
// Based on https://dbaron.org/log/20100309-faster-timeouts
export type IMicroTaskCallback = () => void;

const emitter = new Emittery();
export class MicroTaskScheduler {
  readonly messageName = 'zero-timeout-message';

  private executionQueue: Array<IMicroTaskCallback> = [];
  private stopped = true;

  start() {
    if (this.stopped) {
      this.stopped = false;
      emitter.on(this.messageName, this.handleMessage);
    }
  }

  stop() {
    this.stopped = true;
    this.executionQueue = [];
    emitter.removeListener(this.messageName, this.handleMessage);
  }

  postTask(fn: IMicroTaskCallback) {
    if (!this.stopped) {
      this.executionQueue.push(fn);
      emitter.emit(this.messageName, '*');
    }
  }

  private handleMessage = (event: string) => {
    if (event === '*') {
      const executeJob = this.executionQueue.shift();
      if (executeJob !== undefined) {
        executeJob();
      }
    }
  };
}
