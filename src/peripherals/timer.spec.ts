import { CPU } from '../cpu/cpu';
import { avrInstruction } from '../cpu/instruction';
import { assemble } from '../utils/assembler';
import { AVRTimer, timer0Config, timer1Config, timer2Config } from './timer';

describe('timer', () => {
  let cpu: CPU;

  beforeEach(() => {
    cpu = new CPU(new Uint16Array(0x1000));
  });

  function loadProgram(...instructions: string[]) {
    const { bytes, errors } = assemble(instructions.join('\n'));
    if (errors.length) {
      throw new Error('Assembly failed: ' + errors);
    }
    cpu.progBytes.set(bytes, 0);
  }

  it('should update timer every tick when prescaler is 1', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(1); // TCNT should be 1
  });

  it('should update timer every 64 ticks when prescaler is 3', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x45] = 0x3; // TCCR0B.CS <- 3
    cpu.cycles = 64;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(1); // TCNT should be 1
  });

  it('should not update timer if it has been disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[0x45] = 0; // TCCR0B.CS <- 0
    cpu.cycles = 100000;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0); // TCNT should stay 0
  });

  it('should set TOV if timer overflows', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0xff); // TCNT0 <- 0xff
    timer.tick();
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR
  });

  it('should set TOV if timer overflows in PWM Phase Correct mode', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0xff); // TCNT0 <- 0xff
    timer.tick();
    cpu.writeData(0x47, 0x7f); // OCRA <- 0x7f
    cpu.writeData(0x44, 0x1); // WGM0 <- 1 (PWM, Phase Correct)
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR
  });

  it('should set TOV if timer overflows in FAST PWM mode', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0xff); // TCNT0 <- 0xff
    timer.tick();
    cpu.writeData(0x47, 0x7f); // OCRA <- 0x7f
    cpu.writeData(0x44, 0x3); // WGM0 <- 3 (FAST PWM)
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(1); // TOV bit in TIFR
  });

  it('should generate an overflow interrupt if timer overflows and interrupts enabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0xff); // TCNT0 <- 0xff
    timer.tick();
    cpu.data[0x45] = 0x1; // TCCR0B.CS <- 1
    cpu.data[0x6e] = 0x1; // TIMSK0: TOIE0
    cpu.data[95] = 0x80; // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0); // TCNT should be 0
    expect(cpu.data[0x35]).toEqual(0); // TOV bit in TIFR should be clear
    expect(cpu.pc).toEqual(0x20);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not generate an overflow interrupt when global interrupts disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0xff); // TCNT0 <- 0xff
    timer.tick();
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
    cpu.writeData(0x46, 0xff); // TCNT0 <- 0xff
    timer.tick();
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
    timer.tick();
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
    timer.tick();
    cpu.writeData(0x47, 0x11); // OCR0A <- 0x11
    cpu.writeData(0x44, 0x2); // WGM0 <- 2 (CTC)
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0); // TCNT should be 0
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should set OCF0B flag when timer equals OCRB', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x10); // TCNT0 <- 0x50
    timer.tick();
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
    timer.tick();
    cpu.writeData(0x47, 0x21); // OCR0A <- 0x21
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.writeData(0x6e, 0x2); // TIMSK0: OCIEA
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0x21); // TCNT should be 0x21
    expect(cpu.data[0x35]).toEqual(0); // OCFA bit in TIFR should be clear
    expect(cpu.pc).toEqual(0x1c);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not generate Timer Compare A interrupt when OCIEA is disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x20); // TCNT0 <- 0x20
    timer.tick();
    cpu.writeData(0x47, 0x21); // OCR0A <- 0x21
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.writeData(0x6e, 0); // TIMSK0
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0x21); // TCNT should be 0x21
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should generate Timer Compare B interrupt when TCNT0 == TCNTB', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(0x46, 0x20); // TCNT0 <- 0x20
    timer.tick();
    cpu.writeData(0x48, 0x21); // OCR0B <- 0x21
    cpu.writeData(0x45, 0x1); // TCCR0B.CS <- 1
    cpu.writeData(0x6e, 0x4); // TIMSK0: OCIEB
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(0x46);
    expect(tcnt).toEqual(0x21); // TCNT should be 0x21
    expect(cpu.data[0x35]).toEqual(0); // OCFB bit in TIFR should be clear
    expect(cpu.pc).toEqual(0x1e);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not increment TCNT on the same cycle of TCNT write (issue #36)', () => {
    // At the end of this short program, R17 should contain 0x31. Verified against
    // a physical ATmega328p.
    const program = [
      'LDI r16, 0x1', // TCCR0B = 1 << CS00;
      'OUT 0x25, r16',
      'LDI r16, 0x30', // TCNT <- 0x30
      'OUT 0x26, r16',
      'NOP',
      'IN r17, 0x26', // r17 <- TCNT
    ];
    loadProgram(...program);
    const timer = new AVRTimer(cpu, timer0Config);
    for (let i = 0; i < program.length; i++) {
      avrInstruction(cpu);
      timer.tick();
    }
    expect(cpu.data[17]).toEqual(0x31); // r1 should be 0x31
  });

  it('timer2 should count every 256 ticks when prescaler is 6 (issue #5)', () => {
    const timer = new AVRTimer(cpu, timer2Config);
    cpu.data[0xb1] = 0x6; // TCCR1B.CS <- 6

    cpu.cycles = 511;
    timer.tick();
    expect(cpu.readData(0xb2)).toEqual(1); // TCNT2 should be 2

    cpu.cycles = 512;
    timer.tick();
    expect(cpu.readData(0xb2)).toEqual(2); // TCNT2 should be 2
  });

  describe('16 bit timers', () => {
    it('should increment 16-bit TCNT by 1', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x85, 0x22); // TCNT1 <- 0x2233
      cpu.writeData(0x84, 0x33); // ...
      timer.tick();
      const timerLow = cpu.readData(0x84);
      const timerHigh = cpu.readData(0x85);
      expect((timerHigh << 8) | timerLow).toEqual(0x2233);
      cpu.writeData(0x80, 0x0); // WGM1 <- 0 (Normal)
      cpu.writeData(0x81, 0x1); // TCCR1B.CS <- 1
      cpu.cycles = 1;
      timer.tick();
      cpu.readData(0x84);
      expect(cpu.dataView.getUint16(0x84, true)).toEqual(0x2234); // TCNT1 should increment
    });

    it('should set OCF0A flag when timer equals OCRA (16 bit mode)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x85, 0x10); // TCNT1 <- 0x10ee
      cpu.writeData(0x84, 0xee); // ...
      timer.tick();
      cpu.writeData(0x88, 0xef); // OCR1A <- 0x10ef
      cpu.writeData(0x89, 0x10); // ...
      cpu.writeData(0x80, 0x0); // TCCR1A <- 0 (Normal Mode)
      cpu.writeData(0x81, 0x1); // TCCR1B <- CS10
      cpu.cycles = 1;
      timer.tick();
      expect(cpu.data[0x36]).toEqual(2); // TIFR1 should have OCF1A bit on
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(1);
    });

    it('should generate an overflow interrupt if timer overflows and interrupts enabled', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x85, 0x3); // TCNT1 <- 0x3ff
      cpu.writeData(0x84, 0xff); // ...
      timer.tick();
      cpu.writeData(0x80, 0x3); // TCCR1A <- WGM10 | WGM11 (Fast PWM, 10-bit)
      cpu.writeData(0x81, 0x9); // TCCR1B <- WGM12 | CS10
      console.log(timer.CS);
      cpu.data[0x6f] = 0x1; // TIMSK1: TOIE1
      cpu.data[95] = 0x80; // SREG: I-------
      cpu.cycles = 1;
      timer.tick();
      cpu.readData(0x84); // Refresh TCNT1
      expect(cpu.dataView.getUint16(0x84, true)).toEqual(0); // TCNT1 should be 0
      expect(cpu.data[0x36]).toEqual(0); // TOV bit in TIFR should be clear
      expect(cpu.pc).toEqual(0x1a);
      expect(cpu.cycles).toEqual(3);
    });

    it('should reset the timer once it reaches ICR value in mode 12', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x85, 0x50); // TCNT1 <- 0x500f
      cpu.writeData(0x84, 0x0f); // ...
      timer.tick();
      cpu.writeData(0x87, 0x50); // ICR1 <- 0x5010
      cpu.writeData(0x86, 0x10); // ...
      cpu.writeData(0x81, 0x19); // TCCR1B <- WGM13 | WGM12 | CS10
      cpu.cycles = 2; // 2 cycles should increment timer twice, beyond ICR1
      timer.tick();
      cpu.readData(0x84); // Refresh TCNT1
      expect(cpu.dataView.getUint16(0x84, true)).toEqual(0); // TCNT should be 0
      expect(cpu.data[0x36]).toEqual(0); // TOV bit in TIFR should be clear
      expect(cpu.cycles).toEqual(2);
    });

    it('should not update the high byte of TCNT if written after the low byte (issue #37)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x84, 0x22); // TCNT1L <- 0x22
      cpu.writeData(0x85, 0x55); // TCNT1H <- 0x55
      timer.tick();
      const timerLow = cpu.readData(0x84);
      const timerHigh = cpu.readData(0x85);
      expect((timerHigh << 8) | timerLow).toEqual(0x22);
    });

    it('reading from TCNT1H before TCNT1L should return old value (issue #37)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(0x85, 0xff); // TCNT1H <- 0xff
      cpu.writeData(0x84, 0xff); // TCNT1L <- 0xff
      cpu.writeData(0x81, 0x9); // TCCR1B <- CS10
      timer.tick();
      cpu.cycles = 1;
      timer.tick();
      // We read the high byte before the low byte, so the high byte should still have
      // the previous value:
      const timerHigh = cpu.readData(0x85);
      const timerLow = cpu.readData(0x84);
      expect((timerHigh << 8) | timerLow).toEqual(0xff00);
    });
  });
});
