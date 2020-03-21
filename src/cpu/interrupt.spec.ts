import { CPU } from './cpu';
import { avrInterrupt } from './interrupt';

describe('avrInterrupt', () => {
  it('should execute interrupt handler', () => {
    const cpu = new CPU(new Uint16Array(0x8000));
    cpu.pc = 0x520;
    cpu.data[94] = 0;
    cpu.data[93] = 0x80; // SP <- 0x80
    cpu.data[95] = 0b10000001; // SREG <- I------C
    avrInterrupt(cpu, 5);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.pc).toEqual(5);
    expect(cpu.data[93]).toEqual(0x7e); // SP
    expect(cpu.data[0x80]).toEqual(0x20); // Return addr low
    expect(cpu.data[0x7f]).toEqual(0x5); // Return addr high
    expect(cpu.data[95]).toEqual(0b00000001); // SREG: -------C
  });
});
