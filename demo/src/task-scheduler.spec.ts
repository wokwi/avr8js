/**
 * @jest-environment jsdom
 */
/// <reference lib="dom" />

import { MicroTaskScheduler } from './task-scheduler';

describe('task-scheduler', () => {
  let taskScheduler: MicroTaskScheduler;
  let task: jest.Mock;

  beforeEach(() => {
    taskScheduler = new MicroTaskScheduler();
    task = jest.fn();
  });

  it('should execute task', async () => {
    taskScheduler.start();
    taskScheduler.postTask(task);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('should execute task twice when posted twice', async () => {
    taskScheduler.start();
    taskScheduler.postTask(task);
    taskScheduler.postTask(task);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('should not execute task when not started', async () => {
    taskScheduler.postTask(task);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(task).not.toHaveBeenCalled();
  });

  it('should not execute task when stopped', async () => {
    taskScheduler.start();
    taskScheduler.stop();
    taskScheduler.postTask(task);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(task).not.toHaveBeenCalled();
  });

  it('should not register listener twice', async () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    taskScheduler.start();
    taskScheduler.start();
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
  });
});
