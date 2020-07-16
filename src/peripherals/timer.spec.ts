import { CPU } from '../cpu/cpu';
import { avrInstruction } from '../cpu/instruction';
import { assemble } from '../utils/assembler';
import { AVRTimer, timer0Config, timer1Config, timer2Config } from './timer';
import { PinOverrideMode } from './gpio';

// CPU registers
const R1 = 1;
const R17 = 17;
const SREG = 95;

// Port Registers
const PORTB = 0x25;
const PORTD = 0x2b;

// Timer 0 Registers
const TIFR0 = 0x35;
const TCCR0A = 0x44;
const TCCR0B = 0x45;
const TCNT0 = 0x46;
const OCR0A = 0x47;
const OCR0B = 0x48;
const TIMSK0 = 0x6e;

// Timer 1 Registers
const TIFR1 = 0x36;
const TCCR1A = 0x80;
const TCCR1B = 0x81;
const TCNT1 = 0x84;
const TCNT1H = 0x85;
const ICR1 = 0x86;
const ICR1H = 0x87;
const OCR1A = 0x88;
const OCR1AH = 0x89;

// Timer 2 Registers
const TCCR2B = 0xb1;
const TCNT2 = 0xb2;

// Register bit names
const TOV0 = 1;
const TOV1 = 1;
const OCIE0A = 2;
const OCIE0B = 4;
const TOIE0 = 1;
const OCF0A = 2;
const OCF0B = 4;
const OCF1A = 2;
const WGM00 = 1;
const WGM01 = 2;
const WGM12 = 8;
const WGM13 = 16;
const CS00 = 1;
const CS01 = 2;
const CS10 = 1;
const CS21 = 2;
const CS22 = 4;

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
    cpu.data[TCCR0B] = CS00; // Set prescaler to 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(1);
  });

  it('should update timer every 64 ticks when prescaler is 3', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[TCCR0B] = CS01 | CS00; // Set prescaler to 64
    cpu.cycles = 64;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(1);
  });

  it('should not update timer if it has been disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.data[TCCR0B] = 0; // No prescaler (timer disabled)
    cpu.cycles = 100000;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0); // TCNT should stay 0
  });

  it('should set TOV if timer overflows', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0xff);
    timer.tick();
    cpu.data[TCCR0B] = CS00; // Set prescaler to 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0);
    expect(cpu.data[TIFR0]).toEqual(TOV0);
  });

  it('should set TOV if timer overflows in FAST PWM mode', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0xff);
    timer.tick();
    cpu.writeData(OCR0A, 0x7f);
    cpu.writeData(TCCR0A, WGM01 | WGM00); // WGM: Fast PWM
    cpu.data[TCCR0B] = CS00; // Set prescaler to 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0);
    expect(cpu.data[TIFR0]).toEqual(TOV0);
  });

  it('should generate an overflow interrupt if timer overflows and interrupts enabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0xff);
    timer.tick();
    cpu.data[TCCR0B] = CS00; // Set prescaler to 1
    cpu.data[TIMSK0] = TOIE0;
    cpu.data[SREG] = 0x80; // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(2); // TCNT should be 2 (one tick above + 2 cycles for interrupt)
    expect(cpu.data[TIFR0] & TOV0).toEqual(0);
    expect(cpu.pc).toEqual(0x20);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not generate an overflow interrupt when global interrupts disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0xff);
    timer.tick();
    cpu.data[TCCR0B] = CS00; // Set prescaler to 1
    cpu.data[TIMSK0] = TOIE0;
    cpu.data[SREG] = 0x0; // SREG: --------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[TIFR0]).toEqual(TOV0);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should not generate an overflow interrupt when TOIE0 is clear', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0xff);
    timer.tick();
    cpu.data[TCCR0B] = CS00; // Set prescaler to 1
    cpu.data[TIMSK0] = 0;
    cpu.data[SREG] = 0x80; // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[TIFR0]).toEqual(TOV0);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should set OCF0A flag when timer equals OCRA', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0x10);
    timer.tick();
    cpu.writeData(OCR0A, 0x11);
    cpu.writeData(TCCR0A, 0x0); // WGM: Normal
    cpu.writeData(TCCR0B, CS00); // Set prescaler to 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[TIFR0]).toEqual(OCF0A);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should clear the timer in CTC mode if it equals to OCRA', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0x10);
    timer.tick();
    cpu.writeData(OCR0A, 0x11);
    cpu.writeData(TCCR0A, WGM01); // WGM: CTC
    cpu.writeData(TCCR0B, CS00); // Set prescaler to 1
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should set OCF0B flag when timer equals OCRB', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0x10);
    timer.tick();
    cpu.writeData(OCR0B, 0x11);
    cpu.writeData(TCCR0A, 0x0); // WGM: (Normal)
    cpu.writeData(TCCR0B, CS00); // Set prescaler to 1
    cpu.cycles = 1;
    timer.tick();
    expect(cpu.data[TIFR0]).toEqual(OCF0B);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should generate Timer Compare A interrupt when TCNT0 == TCNTA', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0x20);
    timer.tick();
    cpu.writeData(OCR0A, 0x21);
    cpu.writeData(TCCR0B, CS00); // Set prescaler to 1
    cpu.writeData(TIMSK0, OCIE0A);
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0x23); // TCNT should be 0x23 (one tick above + 2 cycles for interrupt)
    expect(cpu.data[TIFR0] & OCF0A).toEqual(0);
    expect(cpu.pc).toEqual(0x1c);
    expect(cpu.cycles).toEqual(3);
  });

  it('should not generate Timer Compare A interrupt when OCIEA is disabled', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0x20);
    timer.tick();
    cpu.writeData(OCR0A, 0x21);
    cpu.writeData(TCCR0B, CS00); // Set prescaler to 1
    cpu.writeData(TIMSK0, 0);
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0x21);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(1);
  });

  it('should generate Timer Compare B interrupt when TCNT0 == TCNTB', () => {
    const timer = new AVRTimer(cpu, timer0Config);
    cpu.writeData(TCNT0, 0x20);
    timer.tick();
    cpu.writeData(OCR0B, 0x21);
    cpu.writeData(TCCR0B, CS00); // Set prescaler to 1
    cpu.writeData(TIMSK0, OCIE0B);
    cpu.writeData(95, 0x80); // SREG: I-------
    cpu.cycles = 1;
    timer.tick();
    const tcnt = cpu.readData(TCNT0);
    expect(tcnt).toEqual(0x23); // TCNT should be 0x23 (0x23 + 2 cycles for interrupt)
    expect(cpu.data[TIFR0] & OCF0B).toEqual(0);
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
    expect(cpu.data[R17]).toEqual(0x31);
  });

  it('timer2 should count every 256 ticks when prescaler is 6 (issue #5)', () => {
    const timer = new AVRTimer(cpu, timer2Config);
    cpu.data[TCCR2B] = CS22 | CS21; // Set prescaler to 256

    cpu.cycles = 511;
    timer.tick();
    expect(cpu.readData(TCNT2)).toEqual(1);

    cpu.cycles = 512;
    timer.tick();
    expect(cpu.readData(TCNT2)).toEqual(2);
  });

  it('should update TCNT as it is being read by a 2-cycle instruction (issue #40)', () => {
    const program = [
      'LDI r16, 0x1', // TCCR0B = 1 << CS00;
      'OUT 0x25, r16',
      'LDI r16, 0x0', // TCNT0 <- 0x30
      'OUT 0x26, r16',
      'NOP',
      `LDS r1, 0x46`, // r1 <- TCNT0 (2 cycles)
    ];
    loadProgram(...program);
    const timer = new AVRTimer(cpu, timer0Config);
    for (let i = 0; i < program.length; i++) {
      avrInstruction(cpu);
      timer.tick();
    }
    expect(cpu.data[R1]).toEqual(2);
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
      expect(cpu.readData(TCNT0)).toEqual(2);

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(3);

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(2);

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(1);
      expect(cpu.data[TIFR0] & TOV0).toEqual(0);

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(0);
      expect(cpu.data[TIFR0] & TOV0).toEqual(TOV0);

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(1);
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
      cpu.gpioTimerHooks[PORTD] = gpioCallback;

      for (let i = 0; i < program.length; i++) {
        avrInstruction(cpu);
        timer.tick();
      }
      expect(cpu.readData(TCNT0)).toEqual(0xfd);
      expect(gpioCallback).toHaveBeenCalledWith(6, PinOverrideMode.Enable, 0x2b);
      gpioCallback.mockClear();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(0xfe);
      expect(gpioCallback).toHaveBeenCalledWith(6, PinOverrideMode.Clear, 0x2b);
      gpioCallback.mockClear();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(0xff);
      expect(gpioCallback).not.toHaveBeenCalled();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT0)).toEqual(0xfe);
      expect(gpioCallback).toHaveBeenCalledWith(6, PinOverrideMode.Set, 0x2b);
    });
  });

  describe('16 bit timers', () => {
    it('should increment 16-bit TCNT by 1', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(TCNT1H, 0x22); // TCNT1 <- 0x2233
      cpu.writeData(TCNT1, 0x33); // ...
      timer.tick();
      const timerLow = cpu.readData(TCNT1);
      const timerHigh = cpu.readData(TCNT1H);
      expect((timerHigh << 8) | timerLow).toEqual(0x2233);
      cpu.writeData(TCCR1A, 0x0); // WGM: Normal
      cpu.writeData(TCCR1B, CS10); // Set prescaler to 1
      cpu.cycles = 1;
      timer.tick();
      cpu.readData(TCNT1);
      expect(cpu.dataView.getUint16(TCNT1, true)).toEqual(0x2234); // TCNT1 should increment
    });

    it('should set OCF0A flag when timer equals OCRA (16 bit mode)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(TCNT1H, 0x10); // TCNT1 <- 0x10ee
      cpu.writeData(TCNT1, 0xee); // ...
      timer.tick();
      cpu.writeData(OCR1AH, 0x10); // OCR1 <- 0x10ef
      cpu.writeData(OCR1A, 0xef); // ...
      cpu.writeData(TCCR1A, 0x0); // WGM: Normal
      cpu.writeData(TCCR1B, CS10); // Set prescaler to 1
      cpu.cycles = 1;
      timer.tick();
      expect(cpu.data[TIFR1]).toEqual(OCF1A); // TIFR1 should have OCF1A bit on
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(1);
    });

    it('should generate an overflow interrupt if timer overflows and interrupts enabled', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(TCNT1H, 0x3); // TCNT1 <- 0x3ff
      cpu.writeData(TCNT1, 0xff); // ...
      timer.tick();
      cpu.writeData(TCCR1A, 0x3); // TCCR1A <- WGM10 | WGM11 (Fast PWM, 10-bit)
      cpu.writeData(TCCR1B, 0x9); // TCCR1B <- WGM12 | CS10
      cpu.data[0x6f] = 0x1; // TIMSK1: TOIE1
      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.cycles = 1;
      timer.tick();
      cpu.readData(TCNT1); // Refresh TCNT1
      expect(cpu.dataView.getUint16(TCNT1, true)).toEqual(2);
      expect(cpu.data[TIFR1] & TOV1).toEqual(0);
      expect(cpu.pc).toEqual(0x1a);
      expect(cpu.cycles).toEqual(3);
    });

    it('should reset the timer once it reaches ICR value in mode 12', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(TCNT1H, 0x50); // TCNT1 <- 0x500f
      cpu.writeData(TCNT1, 0x0f); // ...
      timer.tick();
      cpu.writeData(ICR1H, 0x50); // ICR1 <- 0x5010
      cpu.writeData(ICR1, 0x10); // ...
      cpu.writeData(TCCR1B, WGM13 | WGM12 | CS10); // Set prescaler to 1, WGM: CTC
      cpu.cycles = 2; // 2 cycles should increment timer twice, beyond ICR1
      timer.tick();
      cpu.readData(TCNT1); // Refresh TCNT1
      expect(cpu.dataView.getUint16(TCNT1, true)).toEqual(0); // TCNT should be 0
      expect(cpu.data[TIFR1] & TOV1).toEqual(0);
      expect(cpu.cycles).toEqual(2);
    });

    it('should not update the high byte of TCNT if written after the low byte (issue #37)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(TCNT1, 0x22);
      cpu.writeData(TCNT1H, 0x55);
      timer.tick();
      const timerLow = cpu.readData(TCNT1);
      const timerHigh = cpu.readData(TCNT1H);
      expect((timerHigh << 8) | timerLow).toEqual(0x22);
    });

    it('reading from TCNT1H before TCNT1L should return old value (issue #37)', () => {
      const timer = new AVRTimer(cpu, timer1Config);
      cpu.writeData(TCNT1H, 0xff);
      cpu.writeData(TCNT1, 0xff);
      cpu.writeData(TCCR1B, WGM12 | CS10); // Set prescaler to 1, WGM: CTC
      timer.tick();
      cpu.cycles = 1;
      timer.tick();
      // We read the high byte before the low byte, so the high byte should still have
      // the previous value:
      const timerHigh = cpu.readData(TCNT1H);
      const timerLow = cpu.readData(TCNT1);
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
      cpu.gpioTimerHooks[PORTB] = gpioCallback;

      for (let i = 0; i < program.length; i++) {
        avrInstruction(cpu);
        timer.tick();
      }
      expect(cpu.readData(TCNT1)).toEqual(0x49);
      expect(gpioCallback).toHaveBeenCalledWith(2, PinOverrideMode.Enable, 0x25);
      gpioCallback.mockClear();

      avrInstruction(cpu);
      timer.tick();
      expect(cpu.readData(TCNT1)).toEqual(0x4a);
      expect(gpioCallback).toHaveBeenCalledWith(2, PinOverrideMode.Toggle, 0x25);
    });
  });
});
