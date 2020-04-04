import { CPU } from '../cpu/cpu';
import { AVRTimer, timer0Config, timer1Config, timer2Config } from './timer';

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

  it('should set TOV if timer overflows in PWM Phase Correct mode', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x46] = 0xff; // TCNT0 <- 0xff
    cpu.writeData(0x47, 0x7f); // OCRA <- 0x7f
    cpu.writeData(0x44, 0x1); // WGM0 <- 1 (PWM, Phase Correct)
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR
  });

  it('should set TOV if timer overflows in FAST PWM mode', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x46] = 0xff; // TCNT0 <- 0xff
    cpu.writeData(0x47, 0x7f); // OCRA <- 0x7f
    cpu.writeData(0x44, 0x3); // WGM0 <- 3 (FAST PWM)
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

  it('should set OCF0A flag when timer equals OCRA', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x10); // TCNT0 <- 0x10
    cpu.writeData(0x47, 0x11); // OCR0A <- 0x11
    cpu.writeData(0x44, 0x0); // WGM0 <- 0 (Normal)
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x35]).toEqual(2); // TIFR0 should have OCF0A bit on
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should clear the timer in CTC mode if it equals to OCRA', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x10); // TCNT0 <- 0x10
    cpu.writeData(0x47, 0x11); // OCR0A <- 0x11
    cpu.writeData(0x44, 0x2); // WGM0 <- 2 (CTC)
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0); // TCNT should be 0
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should set OCF0B flag when timer equals OCRB', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x10); // TCNT0 <- 0x50
    cpu.writeData(0x48, 0x11); // OCR0B <- 0x51
    cpu.writeData(0x44, 0x0); // WGM0 <- 0 (Normal)
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x35]).toEqual(4); // TIFR0 should have OCF0B bit on
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should generate Timer Compare A interrupt when TCNT0 == TCNTA', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x20); // TCNT0 <- 0x20
    cpu.writeData(0x47, 0x21); // OCR0A <- 0x21
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.writeData(0x6e, 0x2); // TIMSK0: OCIEA
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0x21); // TCNT should be 0x21
    expect(cpu.data[0x35]).toEqual(0); // OCFA bit in TIFR should be clear
    expect(cpu.pc).toEqual(0x1c);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not generate Timer Compare A interrupt when OCIEA is disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x20); // TCNT0 <- 0x20
    cpu.writeData(0x47, 0x21); // OCR0A <- 0x21
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.writeData(0x6e, 0); // TIMSK0
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0x21); // TCNT should be 0x21
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should generate Timer Compare B interrupt when TCNT0 == TCNTB', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x20); // TCNT0 <- 0x20
    cpu.writeData(0x48, 0x21); // OCR0B <- 0x21
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.writeData(0x6e, 0x4); // TIMSK0: OCIEB
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[0x46]).toEqual(0x21); // TCNT should be 0x21
    expect(cpu.data[0x35]).toEqual(0); // OCFB bit in TIFR should be clear
    expect(cpu.pc).toEqual(0x1e);
    expect(cpu.cycles).toEqual(3);
  });

  it('timer2 should count every 256 ticks when prescaler is 6 (issue #5)', () => {
    const timer = new AVRTimer(cpu, timer2Config);
    cpu.data[0xb1] = 0x6; // TCCR1B.CS <- 6

    cpu.cycles = 511;
    timer.tick();
    expect(cpu.data[0xb2]).toEqual(1); // TCNT2 should be 2

    cpu.cycles = 512;
    timer.tick();
    expect(cpu.data[0xb2]).toEqual(2); // TCNT2 should be 2
  });

  describe('16 bit timers', () => {
    it('should set OCF0A flag when timer equals OCRA (16 bit mode)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x84, 0xee); // TCNT1 <- 0x10ee
      cpu.writeData(0x85, 0x10); // ...
      cpu.writeData(0x88, 0xef); // OCR1A <- 0x10ef
      cpu.writeData(0x89, 0x10); // ...
      cpu.writeData(0x80, 0x0); // WGM1 <- 0 (Normal)
      cpu.writeData(0x81, 0x1); // TCCR1B.CS <- 1
      cpu.cycles = 1;
      timer.tick();
      expect(cpu.data[0x36]).toEqual(2); // TIFR0 should have OCF0A bit on
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(1);
    });
  });
});
