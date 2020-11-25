import { CPU } from '../cpu/cpu';
import { AVRClock, clockConfig } from './clock';

// Clock Registers
const CLKPC = 0x61;

// Register bit names
const CLKPCE = 128;

describe('Clock', () => {
  it('should set the prescaler when double-writing CLKPC', () => {
    const cpu = new CPU(new Uint16Array(0x1000));
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    cpu.writeData(CLKPC, CLKPCE);
    cpu.writeData(CLKPC, 3); // Divide by 8 (2^3)
    expect(clock.frequency).toEqual(2e6); // 2MHz
    expect(cpu.readData(CLKPC)).toEqual(3);
  });

  it('should not update the prescaler if CLKPCE was not set CLKPC', () => {
    const cpu = new CPU(new Uint16Array(0x1000));
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    cpu.writeData(CLKPC, 3); // Divide by 8 (2^3)
    expect(clock.frequency).toEqual(16e6); // still 16MHz
    expect(cpu.readData(CLKPC)).toEqual(0);
  });

  it('should not update the prescaler if more than 4 cycles passed since setting CLKPCE', () => {
    const cpu = new CPU(new Uint16Array(0x1000));
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    cpu.writeData(CLKPC, CLKPCE);
    cpu.cycles += 6;
    cpu.writeData(CLKPC, 3); // Divide by 8 (2^3)
    expect(clock.frequency).toEqual(16e6); // still 16MHz
    expect(cpu.readData(CLKPC)).toEqual(0);
  });

  describe('prescaler property', () => {
    it('should return the current prescaler value', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const clock = new AVRClock(cpu, 16e6, clockConfig);
      cpu.writeData(CLKPC, CLKPCE);
      cpu.writeData(CLKPC, 5); // Divide by 32 (2^5)
      cpu.cycles = 16e6;
      expect(clock.prescaler).toEqual(32);
    });
  });

  describe('time properties', () => {
    it('should return current number of microseconds, derived from base freq + prescaler', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const clock = new AVRClock(cpu, 16e6, clockConfig);
      cpu.writeData(CLKPC, CLKPCE);
      cpu.writeData(CLKPC, 2); // Divide by 4 (2^2)
      cpu.cycles = 16e6;
      expect(clock.timeMillis).toEqual(4000); // 4 seconds
    });

    it('should return current number of milliseconds, derived from base freq + prescaler', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const clock = new AVRClock(cpu, 16e6, clockConfig);
      cpu.writeData(CLKPC, CLKPCE);
      cpu.writeData(CLKPC, 2); // Divide by 4 (2^2)
      cpu.cycles = 16e6;
      expect(clock.timeMicros).toEqual(4e6); // 4 seconds
    });

    it('should return current number of nanoseconds, derived from base freq + prescaler', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const clock = new AVRClock(cpu, 16e6, clockConfig);
      cpu.writeData(CLKPC, CLKPCE);
      cpu.writeData(CLKPC, 2); // Divide by 4 (2^2)
      cpu.cycles = 16e6;
      expect(clock.timeNanos).toEqual(4e9); // 4 seconds
    });

    it('should correctly calculate time when changing the prescale value at runtime', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const clock = new AVRClock(cpu, 16e6, clockConfig);
      cpu.cycles = 16e6; // run 1 second at 16MHz
      cpu.writeData(CLKPC, CLKPCE);
      cpu.writeData(CLKPC, 2); // Divide by 4 (2^2)
      cpu.cycles += 2 * 4e6; // run 2 more seconds at 4MhZ
      expect(clock.timeMillis).toEqual(3000); // 3 seconds in total

      cpu.writeData(CLKPC, CLKPCE);
      cpu.writeData(CLKPC, 1); // Divide by 2 (2^1)
      cpu.cycles += 0.5 * 8e6; // run 0.5 more seconds at 8MhZ
      expect(clock.timeMillis).toEqual(3500); // 3.5 seconds in total
    });
  });
});
