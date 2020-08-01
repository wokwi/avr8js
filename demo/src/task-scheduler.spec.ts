/**
 * remove-me @jest-environment jsdom
 */
/// <reference lib="dom" />

import { MicroTaskScheduler } from './task-scheduler';

/*
 * We're skipping this test due to JSDOM issue:
 * https://github.com/jsdom/jsdom/issues/2961
 *
 * It should pass on Node >= 12.0, but since the core library
 * is expected to run on Node >= 10.0, and this test only applies
 * to the demo project, it's better disabling it for now than
 * getting false negatives.
 *
 * When this test is eventually re-enabled, don't forget to remove
 * the `remove-me` text at the top of this file to re-enable the
 * loading of jsdom.
 */
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('task-scheduler', () => {
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
