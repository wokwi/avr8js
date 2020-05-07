import { CPU } from '../cpu/cpu';
import { avrInstruction } from '../cpu/instruction';
import { assemble } from '../utils/assembler';
import { AVRTimer, timer0Config, timer1Config, timer2Config } from './timer';
import { PinOverrideMode } from './gpio';

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
    expect(tcnt).toEqual(2); // TCNT should be 2 (one tick above + 2 cycles for interrupt)
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
    expect(tcnt).toEqual(0x23); // TCNT should be 0x23 (one tick above + 2 cycles for interrupt)
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
    expect(tcnt).toEqual(0x23); // TCNT should be 0x23 (one tick above + 2 cycles for interrupt)
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

  it('should update TCNT as it is being read by a 2-cycle instruction (issue #40)', () => {
    const program = [
      'LDI r16, 0x1', // TCCR0B = 1 << CS00;
      'OUT 0x25, r16',
      'LDI r16, 0x0', // TCNT0 <- 0x30
      'OUT 0x26, r16',
      'NOP',
      'LDS r1, 0x46', // r17 <- TCNT0 (2 cycles)
    ];
    loadProgram(...program);
    const timer = new AVRTimer(cpu, timer0Config);
    for (let i = 0; i < program.length; i++) {
      avrInstruction(cpu);
      timer.tick();
    }
    expect(cpu.data[1]).toEqual(2); // r1 should equal 2
  });

  describe('Phase-correct PWM mode', () => {
    it('should count up to TOP, down to 0, and then set TOV flag', () => {
      const program = [
        // Set waveform generation mode (WGM) to PWM, Phase Correct, top OCR0A
        'LDI r16, 0x1', // TCCR0A = 1 << WGM00;
        'OUT 0x24, r16',
        'LDI r16, 0x9', // TCCR0B = (1 << WGM02) | (1 << CS00);
        'OUT 0x25, r16',
        'LDI r16, 0x3', // OCR0A = 0x3;
        'OUT 0x27, r16',
        'LDI r16, 0x2', // TCNT0 = 0x2;
        'OUT 0x26, r16',
      ];
      const nops = [
        'NOP', // TCNT0 will be 3
        'NOP', // TCNT0 will be 2
        'NOP', // TCNT0 will be 1
        'NOP', // TCNT0 will be 0
        'NOP', // TCNT0 will be 1 (end of test)
      ];
      loadProgram(...program, ...nops);
      const timer = new AVRTimer(cpu, timer0Config);

      for (let i = 0; i < program.length; i++) {
        avrInstruction(cpu);
        timer.tick();
      }
      expect(cpu.readData(0x46)).toEqual(2); // TCNT should be 2

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(3); // TCNT should be 3

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(2); // TCNT should be 2

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(1); // TCNT should be 1
      expect(cpu.data[0x35] & 0x1).toEqual(0); // TIFR should have TOV bit clear

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(0); // TCNT should be 0
      expect(cpu.data[0x35] & 0x1).toEqual(1); // TIFR should have TOV bit set

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(1); // TCNT should be 1
    });

    it('should clear OC0A when TCNT0=OCR0A and counting up', () => {
      const program = [
        // Set waveform generation mode (WGM) to PWM, Phase Correct
        'LDI r16, 0x81', // TCCR0A = (1 << COM0A1) || (1 << WGM01);
        'OUT 0x24, r16',
        'LDI r16, 0x1', // TCCR0B = (1 << CS00);
        'OUT 0x25, r16',
        'LDI r16, 0xfe', // OCR0A = 0xfe;
        'OUT 0x27, r16',
        'LDI r16, 0xfd', // TCNT0 = 0xfd;
        'OUT 0x26, r16',
      ];
      const nops = [
        'NOP', // TCNT0 will be 0xfe
        'NOP', // TCNT0 will be 0xff
        'NOP', // TCNT0 will be 0xfe again (end of test)
      ];
      loadProgram(...program, ...nops);
      const timer = new AVRTimer(cpu, timer0Config);

      // Listen to Port D's internal callback
      const gpioCallback = jest.fn();
      cpu.gpioTimerHooks[0x2b] = gpioCallback;

      for (let i = 0; i < program.length; i++) {
        avrInstruction(cpu);
        timer.tick();
      }
      expect(cpu.readData(0x46)).toEqual(0xfd); // TCNT0 should be 0xfd
      expect(gpioCallback).toHaveBeenCalledWith(6, PinOverrideMode.Enable, 0x2b);
      gpioCallback.mockClear();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(0xfe); // TCNT should be 0xfe
      expect(gpioCallback).toHaveBeenCalledWith(6, PinOverrideMode.Clear, 0x2b);
      gpioCallback.mockClear();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(0xff); // TCNT should be 0xff
      expect(gpioCallback).not.toHaveBeenCalled();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x46)).toEqual(0xfe); // TCNT should be 0xfe
      expect(gpioCallback).toHaveBeenCalledWith(6, PinOverrideMode.Set, 0x2b);
    });
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
      expect(cpu.dataView.getUint16(0x84, true)).toEqual(2); // TCNT1 should be 0 (one tick above + 2 cycles for interrupt)
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

    it('should toggle OC1B on Compare Match', () => {
      const program = [
        // Set waveform generation mode (WGM) to Normal, top 0xFFFF
        'LDI r16, 0x10', // TCCR1A = (1 << COM1B0);
        'STS 0x80, r16',
        'LDI r16, 0x1', // TCCR1B = (1 << CS00);
        'STS 0x81, r16',
        'LDI r16, 0x0', // OCR1BH = 0x0;
        'STS 0x8B, r16',
        'LDI r16, 0x4a', // OCR1BL = 0x4a;
        'STS 0x8A, r16',
        'LDI r16, 0x0', // TCNT1H = 0x0;
        'STS 0x85, r16',
        'LDI r16, 0x49', // TCNT1L = 0x49;
        'STS 0x84, r16',
      ];
      const nops = [
        'NOP', // TCNT1 will be 0x49
        'NOP', // TCNT1 will be 0x4a
      ];
      loadProgram(...program, ...nops);
      const timer = new AVRTimer(cpu, timer1Config);

      // Listen to Port B's internal callback
      const gpioCallback = jest.fn();
      cpu.gpioTimerHooks[0x25] = gpioCallback;

      for (let i = 0; i < program.length; i++) {
        avrInstruction(cpu);
        timer.tick();
      }
      expect(cpu.readData(0x84)).toEqual(0x49); // TCNT1 should be 0x49
      expect(gpioCallback).toHaveBeenCalledWith(2, PinOverrideMode.Enable, 0x25);
      gpioCallback.mockClear();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(0x84)).toEqual(0x4a); // TCNT1 should be 0x4a
      expect(gpioCallback).toHaveBeenCalledWith(2, PinOverrideMode.Toggle, 0x25);
    });
  });
});
