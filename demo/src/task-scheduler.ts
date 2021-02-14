export type IMicroTaskCallback = () => void;

export class MicroTaskScheduler {
  private readonly channel = new MessageChannel();
  private executionQueue: Array<IMicroTaskCallback> = [];
  private stopped = true;

  start() {
    if (this.stopped) {
      this.stopped = false;
      this.channel.port2.onmessage = this.handleMessage;
    }
  }

  stop() {
    this.stopped = true;
    this.executionQueue.splice(0, this.executionQueue.length);
    this.channel.port2.onmessage = null;
  }

  postTask(fn: IMicroTaskCallback) {
    if (!this.stopped) {
      this.executionQueue.push(fn);
      this.channel.port1.postMessage(null);
    }
  }

  private handleMessage = () => {
    const executeJob = this.executionQueue.shift();
    if (executeJob !== undefined) {
      executeJob();
    }
  };
}
