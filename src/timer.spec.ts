import { CPU } from './cpu';
import { AVRTimer, timer0Config } from './timer';

describe('timer', () => {
  let cpu: CPU;

  beforeEach(() => {
    cpu = new CPU(new Uint16Array(0x1000));
  });

  it('should update timer every tick when prescaler is 1', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(1); // TCNT should be 1
  });

  it('should update timer every 64 ticks when prescaler is 3', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x45] = 0x3; // TCCR0B.CS <- 3
    cpu.cycles = 64;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(1); // TCNT should be 1
  });

  it('should not update timer if it has been disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x45] = 0; // TCCR0B.CS <- 0
    cpu.cycles = 100000;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0); // TCNT should stay 0
  });

  it('should set TOV if timer overflows', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x46] = 0xff; // TCNT0 <- 0xff
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR
  });

  it('should generate an overflow interrupt if timer overflows and interrupts enabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x46] = 0xff; // TCNT0 <- 0xff
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.data[0x6e] = 0x1; // TIMSK0: TOIE0
    cpu.data[95] = 0x80; // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(0); // TOV bit in TIFR should be clear
    expect(cpu.pc).toEqual(0x20);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not generate an overflow interrupt when global interrupts disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x46] = 0xff; // TCNT0 <- 0xff
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.data[0x6e] = 0x1; // TIMSK0: TOIE0
    cpu.data[95] = 0x0; // SREG: --------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR should be set
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should not generate an overflow interrupt when TOIE0 is clear', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x46] = 0xff; // TCNT0 <- 0xff
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.data[0x6e] = 0; // TIMSK0: clear
    cpu.data[95] = 0x80; // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR should be set
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });
});
