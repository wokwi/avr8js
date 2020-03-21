import { CPU } from './cpu';

describe('cpu', () => {
  it('should set initial value of SP to the last address of internal SRAM', () => {
    const cpu = new CPU(new Uint16Array(1024), 0x1000);
    expect(cpu.SP).toEqual(0x10ff);
  });
});
