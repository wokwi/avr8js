import { CPU } from './cpu';

describe('cpu', () => {
  it('should set initial value of SP to the last byte of internal SRAM', () => {
    const cpu = new CPU(new Uint16Array(1024), 0x1000);
    expect(cpu.SP).toEqual(0x10ff);
  });

  describe('events', () => {
    it('should execute queued events after the given number of cycles has passed', () => {
      const cpu = new CPU(new Uint16Array(1024), 0x1000);
      const events = [];
      for (const i of [1, 4, 10]) {
        cpu.addClockEvent(() => events.push([i, cpu.cycles]), i);
      }
      for (let i = 0; i < 10; i++) {
        cpu.cycles++;
        cpu.tick();
      }
      expect(events).toEqual([
        [1, 1],
        [4, 4],
        [10, 10],
      ]);
    });

    describe('updateClockEvent', () => {
      it('should update the number of cycles for the given clock event', () => {
        const cpu = new CPU(new Uint16Array(1024), 0x1000);
        const events = [];
        const callbacks = [];
        for (const i of [1, 4, 10]) {
          callbacks[i] = cpu.addClockEvent(() => events.push([i, cpu.cycles]), i);
        }
        cpu.updateClockEvent(callbacks[4], 2);
        cpu.updateClockEvent(callbacks[1], 12);
        for (let i = 0; i < 14; i++) {
          cpu.cycles++;
          cpu.tick();
        }
        expect(events).toEqual([
          [4, 2],
          [10, 10],
          [1, 12],
        ]);
      });

      describe('clearClockEvent', () => {
        it('should remove the given clock event', () => {
          const cpu = new CPU(new Uint16Array(1024), 0x1000);
          const events = [];
          const callbacks = [];
          for (const i of [1, 4, 10]) {
            callbacks[i] = cpu.addClockEvent(() => events.push([i, cpu.cycles]), i);
          }
          cpu.clearClockEvent(callbacks[4]);
          for (let i = 0; i < 10; i++) {
            cpu.cycles++;
            cpu.tick();
          }
          expect(events).toEqual([
            [1, 1],
            [10, 10],
          ]);
        });
      });
    });
  });
});
