import { CPU } from './cpu';
import { avrInstruction } from './instruction';

describe('avrInstruction', () => {
  let cpu: CPU;

  beforeEach(() => {
    cpu = new CPU(new Uint16Array(0x8000));
  });

  function loadProgram(bytes: string) {
    const progBuf = cpu.progBytes;
    for (let i = 0; i < bytes.length; i += 2) {
      progBuf[i / 2] = parseInt(bytes.substr(i, 2), 16);
    }
  }

  it('should execute `ADC r0, r1` instruction when carry is on', () => {
    loadProgram('011c');
    cpu.data[0] = 10; // r0 <- 10
    cpu.data[1] = 20; // r1 <- 20
    cpu.data[95] = 0b00000001; // SREG <- -------C
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0]).toEqual(31);
    expect(cpu.data[95]).toEqual(0); // SREG: --------
  });

  it('should execute `ADC r0, r1` instruction when carry is on and the result overflows', () => {
    loadProgram('011c');
    cpu.data[0] = 10; // r0 <- 10
    cpu.data[1] = 245; // r1 <- 20
    cpu.data[95] = 0b00000001; // SREG <- -------C
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0]).toEqual(0);
    expect(cpu.data[95]).toEqual(0b00100011); // SREG: --H---ZC
  });

  it('should execute `BCLR 2` instruction', () => {
    loadProgram('a894');
    cpu.data[95] = 0xff; // SREG <- 0xff
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0xfb);
  });

  it('should execute `BLD r4, 7` instruction', () => {
    loadProgram('47f8');
    cpu.data[4] = 0x15; // r <- 0x15
    cpu.data[95] = 0x40; // SREG <- 0x40
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[4]).toEqual(0x95);
    expect(cpu.data[95]).toEqual(0x40);
  });

  it('should execute `BRBC 0, +8` instruction when SREG.C is clear', () => {
    loadProgram('20f4');
    cpu.data[95] = 0b00001000; // SREG: V
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1 + 8 / 2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `BRBC 0, +8` instruction when SREG.C is set', () => {
    loadProgram('20f4');
    cpu.data[95] = 0b00000001; // SREG: C
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
  });

  it('should execute `BRBS 3, 92` instruction when SREG.V is set', () => {
    loadProgram('73f1');
    cpu.data[95] = 0b00001000; // SREG: V
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1 + 92 / 2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `BRBS 3, -4` instruction when SREG.V is set', () => {
    loadProgram('0000f3f3');
    cpu.data[95] = 0b00001000; // SREG: V
    avrInstruction(cpu);
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(3); // 1 for NOP, 2 for BRBS
  });

  it('should execute `BRBS 3, -4` instruction when SREG.V is clear', () => {
    loadProgram('f3f3');
    cpu.data[95] = 0x0; // SREG <- 0x0
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
  });

  it('should execute `CBI 0x0c, 5`', () => {
    loadProgram('6598');
    cpu.data[0x2c] = 0b11111111;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x2c]).toEqual(0b11011111);
  });

  it('should execute `CALL` instruction', () => {
    loadProgram('0e945c00');
    cpu.data[94] = 0;
    cpu.data[93] = 150; // SP <- 50
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x5c);
    expect(cpu.cycles).toEqual(5);
    expect(cpu.data[150]).toEqual(2); // return addr
    expect(cpu.data[93]).toEqual(148); // SP should be decremented
  });

  it('should execute `CPC r27, r18` instruction', () => {
    loadProgram('b207');
    cpu.data[18] = 0x1;
    cpu.data[27] = 0x1;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0); // SREG clear
  });

  it('should execute `CPC r24, r1` instruction and set', () => {
    loadProgram('8105');
    cpu.data[1] = 0; // r1 <- 0
    cpu.data[24] = 0; // r24 <- 0
    cpu.data[95] = 0b10000001; // SREG: I-------C
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0b10110101); // SREG: I-HS-N-C
  });

  it('should execute `CPI r26, 0x9` instruction', () => {
    loadProgram('a930');
    cpu.data[26] = 0x8;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0b00110101); // SREG: HSNC
  });

  it('should execute `CPSE r2, r3` when r2 != r3', () => {
    loadProgram('2310');
    cpu.data[2] = 10; // r2 <- 10
    cpu.data[3] = 11; // r3 <- 11
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
  });

  it('should execute `CPSE r2, r3` when r2 == r3', () => {
    loadProgram('23101c92');
    cpu.data[2] = 10; // r2 <- 10
    cpu.data[3] = 10; // r3 <- 10
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `CPSE r2, r3` when r2 == r3 and followed by 2-word instruction', () => {
    loadProgram('23100e945c00');
    cpu.data[2] = 10; // r2 <- 10
    cpu.data[3] = 10; // r3 <- 10
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(3);
    expect(cpu.cycles).toEqual(3);
  });

  it('should execute `ICALL` instruction', () => {
    loadProgram('0995');
    cpu.data[94] = 0;
    cpu.data[93] = 0x80;
    cpu.dataView.setUint16(30, 0x2020, true); // Z <- 0x2020
    avrInstruction(cpu);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.pc).toEqual(0x2020);
    expect(cpu.data[0x80]).toEqual(1); // Return address
    expect(cpu.data[93]).toEqual(0x7e);
  });

  it('should execute `IJMP` instruction', () => {
    loadProgram('0994');
    cpu.dataView.setUint16(30, 0x1040, true); // Z <- 0x1040
    avrInstruction(cpu);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.pc).toEqual(0x1040);
  });

  it('should execute `IN r5, 0xb` instruction', () => {
    loadProgram('5bb0');
    cpu.data[0x2b] = 0xaf;
    avrInstruction(cpu);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.pc).toEqual(1);
    expect(cpu.data[5]).toEqual(0xaf);
  });

  it('should execute `INC r5` instruction', () => {
    loadProgram('5394');
    cpu.data[5] = 0x7f;
    avrInstruction(cpu);
    expect(cpu.data[5]).toEqual(0x80);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0b00001100); // SREG: NV
  });

  it('should execute `INC r5` instruction when r5 == 0xff', () => {
    loadProgram('5394');
    cpu.data[5] = 0xff;
    avrInstruction(cpu);
    expect(cpu.data[5]).toEqual(0);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0b00000010); // SREG: Z
  });

  it('should execute `JMP 0xb8` instruction', () => {
    loadProgram('0c945c00');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x5c);
    expect(cpu.cycles).toEqual(3);
  });

  it('should execute `LAC r19` instruction', () => {
    loadProgram('3693');
    cpu.data[19] = 0x02; // r19 <- 0x02
    cpu.dataView.setUint16(30, 0x100, true); // Z <- 0x100
    cpu.data[0x100] = 0x96;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[19]).toEqual(0x96);
    expect(cpu.dataView.getUint16(30, true)).toEqual(0x100);
    expect(cpu.data[0x100]).toEqual(0x94);
  });

  it('should execute `LAS r17` instruction', () => {
    loadProgram('1593');
    cpu.data[17] = 0x11; // r17 <- 0x11
    cpu.data[30] = 0x80; // Z <- 0x80
    cpu.data[0x80] = 0x44;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[17]).toEqual(0x44);
    expect(cpu.data[30]).toEqual(0x80);
    expect(cpu.data[0x80]).toEqual(0x55);
  });

  it('should execute `LAT r0` instruction', () => {
    loadProgram('0792');
    cpu.data[0] = 0x33; // r0 <- 0x33
    cpu.data[30] = 0x80; // Z <- 0x80
    cpu.data[0x80] = 0x66;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0]).toEqual(0x66);
    expect(cpu.data[30]).toEqual(0x80);
    expect(cpu.data[0x80]).toEqual(0x55);
  });

  it('should execute `LDI r28, 0xff` instruction', () => {
    loadProgram('cfef');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[28]).toEqual(0xff);
  });

  it('should execute `LDS r5, 0x150` instruction', () => {
    loadProgram('50905001');
    cpu.data[0x150] = 0x7a;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x2);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[5]).toEqual(0x7a);
  });

  it('should execute `LD r1, X` instruction', () => {
    loadProgram('1c90');
    cpu.data[0xc0] = 0x15;
    cpu.data[26] = 0xc0; // X <- 0xc0
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[1]).toEqual(0x15);
    expect(cpu.data[26]).toEqual(0xc0); // verify that X was unchanged
  });

  it('should execute `LD r17, X+` instruction', () => {
    loadProgram('1d91');
    cpu.data[0xc0] = 0x15;
    cpu.data[26] = 0xc0; // X <- 0xc0
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[17]).toEqual(0x15);
    expect(cpu.data[26]).toEqual(0xc1); // verify that X was incremented
  });

  it('should execute `LD r1, -X` instruction', () => {
    loadProgram('1e90');
    cpu.data[0x98] = 0x22;
    cpu.data[26] = 0x99; // X <- 0x99
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[1]).toEqual(0x22);
    expect(cpu.data[26]).toEqual(0x98); // verify that X was decremented
  });

  it('should execute `LD r8, Y` instruction', () => {
    loadProgram('8880');
    cpu.data[0xc0] = 0x15;
    cpu.data[28] = 0xc0; // Y <- 0xc0
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[8]).toEqual(0x15);
    expect(cpu.data[28]).toEqual(0xc0); // verify that Y was unchanged
  });

  it('should execute `LD r3, Y+` instruction', () => {
    loadProgram('3990');
    cpu.data[0xc0] = 0x15;
    cpu.data[28] = 0xc0; // Y <- 0xc0
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[3]).toEqual(0x15);
    expect(cpu.data[28]).toEqual(0xc1); // verify that Y was incremented
  });

  it('should execute `LD r0, -Y` instruction', () => {
    loadProgram('0a90');
    cpu.data[0x98] = 0x22;
    cpu.data[28] = 0x99; // Y <- 0x99
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[0]).toEqual(0x22);
    expect(cpu.data[28]).toEqual(0x98); // verify that Y was decremented
  });

  it('should execute `LDD r4, Y+2` instruction', () => {
    loadProgram('4a80');
    cpu.data[0x82] = 0x33;
    cpu.data[28] = 0x80; // Y <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[4]).toEqual(0x33);
    expect(cpu.data[28]).toEqual(0x80); // verify that Y was unchanged
  });

  it('should execute `LD r5, Z` instruction', () => {
    loadProgram('5080');
    cpu.data[0xcc] = 0xf5;
    cpu.data[30] = 0xcc; // Z <- 0xcc
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[5]).toEqual(0xf5);
    expect(cpu.data[30]).toEqual(0xcc); // verify that Z was unchanged
  });

  it('should execute `LD r7, Z+` instruction', () => {
    loadProgram('7190');
    cpu.data[0xc0] = 0x25;
    cpu.data[30] = 0xc0; // Z <- 0xc0
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[7]).toEqual(0x25);
    expect(cpu.data[30]).toEqual(0xc1); // verify that Y was incremented
  });

  it('should execute `LD r0, -Z` instruction', () => {
    loadProgram('0290');
    cpu.data[0x9e] = 0x66;
    cpu.data[30] = 0x9f; // Z <- 0x9f
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[0]).toEqual(0x66);
    expect(cpu.data[30]).toEqual(0x9e); // verify that Y was decremented
  });

  it('should execute `LDD r15, Z+31` instruction', () => {
    loadProgram('f78c');
    cpu.data[0x9f] = 0x33;
    cpu.data[30] = 0x80; // Z <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[15]).toEqual(0x33);
    expect(cpu.data[30]).toEqual(0x80); // verify that Z was unchanged
  });

  it('should execute `LPM` instruction', () => {
    loadProgram('c895');
    cpu.progMem[0x40] = 0xa0;
    cpu.data[30] = 0x80; // Z <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[0]).toEqual(0xa0);
    expect(cpu.data[30]).toEqual(0x80); // verify that Z was unchanged
  });

  it('should execute `LPM r2` instruction', () => {
    loadProgram('2490');
    cpu.progMem[0x40] = 0xa0;
    cpu.data[30] = 0x80; // Z <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[2]).toEqual(0xa0);
    expect(cpu.data[30]).toEqual(0x80); // verify that Z was unchanged
  });

  it('should execute `LPM r1, Z+` instruction', () => {
    loadProgram('1590');
    cpu.progMem[0x40] = 0xa0;
    cpu.data[30] = 0x80; // Z <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(3);
    expect(cpu.data[1]).toEqual(0xa0);
    expect(cpu.data[30]).toEqual(0x81); // verify that Z was incremented
  });

  it('should execute `LSR r7` instruction', () => {
    loadProgram('7694');
    cpu.data[7] = 0x45; // r7 <- 0x45
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[7]).toEqual(0x22);
    expect(cpu.data[95]).toEqual(0b00011001); // SREG SVC
  });

  it('should execute `MOV r7, r8` instruction', () => {
    loadProgram('782c');
    cpu.data[8] = 0x45; // r7 <- 0x45
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[7]).toEqual(0x45);
  });

  it('should execute `MOVW r26, r22` instruction', () => {
    loadProgram('db01');
    cpu.data[22] = 0x45; // r22 <- 0x45
    cpu.data[23] = 0x9a; // r23 <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[26]).toEqual(0x45);
    expect(cpu.data[27]).toEqual(0x9a);
  });

  it('should execute `MUL r5, r6` instruction', () => {
    loadProgram('569c');
    cpu.data[5] = 100; // r5 <- 55
    cpu.data[6] = 5; // r6 <- 5
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.dataView.getUint16(0, true)).toEqual(500);
    expect(cpu.data[95]).toEqual(0b0); // SREG: 0
  });

  it('should execute `MUL r5, r6` instruction and update carry flag when numbers are big', () => {
    loadProgram('569c');
    cpu.data[5] = 200; // r5 <- 200
    cpu.data[6] = 200; // r6 <- 200
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.dataView.getUint16(0, true)).toEqual(40000);
    expect(cpu.data[95]).toEqual(0b00000001); // SREG: C
  });

  it('should execute `MUL r0, r1` and update the zero flag', () => {
    loadProgram('019c');
    cpu.data[0] = 0; // r0 <- 0
    cpu.data[1] = 9; // r1 <- 9
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.dataView.getUint16(0, true)).toEqual(0);
    expect(cpu.data[95]).toEqual(0b00000010); // SREG: Z
  });

  it('should execute `MULS r18, r19` instruction', () => {
    loadProgram('2302');
    cpu.data[18] = -5; // r18 <- -5
    cpu.data[19] = 100; // r19 <- 100
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.dataView.getInt16(0, true)).toEqual(-500);
    expect(cpu.data[95]).toEqual(0b00000001); // SREG: C
  });

  it('should execute `MULSU r16, r17` instruction', () => {
    loadProgram('0103');
    cpu.data[16] = -5; // r16 <- -5
    cpu.data[17] = 200; // r17 <- 200
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.dataView.getInt16(0, true)).toEqual(-1000);
    expect(cpu.data[95]).toEqual(0b00000001); // SREG: C
  });

  it('should execute `NEG r20` instruction', () => {
    loadProgram('4195');
    cpu.data[20] = 0x56; // r20 <- 0x56
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[20]).toEqual(0xaa);
    expect(cpu.data[95]).toEqual(0b00010101); // SREG: NC
  });

  it('should execute `NOP` instruction', () => {
    loadProgram('0000');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
  });

  it('should execute `OUT 0x3f, r1` instruction', () => {
    loadProgram('1fbe');
    cpu.data[1] = 0x5a; // r1 <- 0x5a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x5f]).toEqual(0x5a);
  });

  it('should execute `POP r26` instruction', () => {
    loadProgram('af91');
    cpu.data[94] = 0;
    cpu.data[93] = 0xff; // SP <- 0xff
    cpu.data[0x100] = 0x1a;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[26]).toEqual(0x1a);
    expect(cpu.dataView.getUint16(93, true)).toEqual(0x100); // SP
  });

  it('should execute `PUSH r11` instruction', () => {
    loadProgram('bf92');
    cpu.data[11] = 0x2a;
    cpu.data[94] = 0;
    cpu.data[93] = 0xff; // SP <- 0xff
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0xff]).toEqual(0x2a);
    expect(cpu.dataView.getUint16(93, true)).toEqual(0xfe); // SP
  });

  it('should execute `RCALL .+6` instruction', () => {
    loadProgram('03d0');
    cpu.data[94] = 0;
    cpu.data[93] = 0x80; // SP <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(4);
    expect(cpu.cycles).toEqual(4);
    expect(cpu.dataView.getUint16(0x80, true)).toEqual(1); // RET address
    expect(cpu.data[93]).toEqual(0x7e); // SP
  });

  it('should execute `RCALL .-4` instruction', () => {
    loadProgram('0000fedf');
    cpu.data[94] = 0;
    cpu.data[93] = 0x80; // SP <- 0x80
    avrInstruction(cpu);
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0);
    expect(cpu.cycles).toEqual(5); // 1 for NOP, 4 for RCALL
    expect(cpu.dataView.getUint16(0x80, true)).toEqual(2); // RET address
    expect(cpu.data[93]).toEqual(0x7e); // SP
  });

  it('should execute `RET` instruction', () => {
    loadProgram('0895');
    cpu.data[94] = 0;
    cpu.data[93] = 0x90; // SP <- 0x90
    cpu.data[0x92] = 16;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(16);
    expect(cpu.cycles).toEqual(5);
    expect(cpu.data[93]).toEqual(0x92); // SP should increment
  });

  it('should execute `RETI` instruction', () => {
    loadProgram('1895');
    cpu.data[94] = 0;
    cpu.data[93] = 0xc0; // SP <- 0xc0
    cpu.data[0xc2] = 200;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(200);
    expect(cpu.cycles).toEqual(5);
    expect(cpu.data[93]).toEqual(0xc2); // SP should increment
    expect(cpu.data[95]).toEqual(0b10000000); // SREG: I
  });

  it('should execute `RJMP 2` instruction', () => {
    loadProgram('01c0');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `ROR r0` instruction', () => {
    loadProgram('0794');
    cpu.data[0] = 0x11; // r0 <- 0x11
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0]).toEqual(0x08); // r0 should be right-shifted
    expect(cpu.data[95]).toEqual(0b00011001); // SREG: SVI
  });

  it('should execute `SBCI r23, 3`', () => {
    loadProgram('7340');
    cpu.data[23] = 3; // r23 <- 3
    cpu.data[95] = 0b10000001; // SREG <- I------C
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0b10110101); // SREG: I-HS-N-C
  });

  it('should execute `SBI 0x0c, 5`', () => {
    loadProgram('659a');
    cpu.data[0x2c] = 0b00001111;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0x2c]).toEqual(0b00101111);
  });

  it('should execute `SBIS 0x0c, 5` when bit is clear', () => {
    loadProgram('659b1c92');
    cpu.data[0x2c] = 0b00001111;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
  });

  it('should execute `SBIS 0x0c, 5` when bit is set', () => {
    loadProgram('659b1c92');
    cpu.data[0x2c] = 0b00101111;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `SBIS 0x0c, 5` when bit is set and followed by 2-word instruction', () => {
    loadProgram('659b0e945c00');
    cpu.data[0x2c] = 0b00101111;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(3);
    expect(cpu.cycles).toEqual(3);
  });

  it('should execute `STS 0x151, r31` instruction', () => {
    loadProgram('f0935101');
    cpu.data[31] = 0x80; // r31 <- 0x80
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(2);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0x151]).toEqual(0x80);
  });

  it('should execute `ST X, r1` instruction', () => {
    loadProgram('1c92');
    cpu.data[1] = 0x5a; // r1 <- 0x5a
    cpu.data[26] = 0x9a; // X <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x9a]).toEqual(0x5a);
    expect(cpu.data[26]).toEqual(0x9a); // verify that X was unchanged
  });

  it('should execute `ST X+, r1` instruction', () => {
    loadProgram('1d92');
    cpu.data[1] = 0x5a; // r1 <- 0x5a
    cpu.data[26] = 0x9a; // X <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x9a]).toEqual(0x5a);
    expect(cpu.data[26]).toEqual(0x9b); // verify that X was incremented
  });

  it('should execute `ST -X, r17` instruction', () => {
    loadProgram('1e93');
    cpu.data[17] = 0x88; // r17 <- 0x88
    cpu.data[26] = 0x99; // X <- 0x99
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0x98]).toEqual(0x88);
    expect(cpu.data[26]).toEqual(0x98); // verify that X was decremented
  });

  it('should execute `ST Y, r2` instruction', () => {
    loadProgram('2882');
    cpu.data[2] = 0x5b; // r2 <- 0x5b
    cpu.data[28] = 0x9a; // Y <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x9a]).toEqual(0x5b);
    expect(cpu.data[28]).toEqual(0x9a); // verify that Y was unchanged
  });

  it('should execute `ST Y+, r1` instruction', () => {
    loadProgram('1992');
    cpu.data[1] = 0x5a; // r1 <- 0x5a
    cpu.data[28] = 0x9a; // Y <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x9a]).toEqual(0x5a);
    expect(cpu.data[28]).toEqual(0x9b); // verify that Y was incremented
  });

  it('should execute `ST -Y, r1` instruction', () => {
    loadProgram('1a92');
    cpu.data[1] = 0x5a; // r1 <- 0x5a
    cpu.data[28] = 0x9a; // Y <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0x99]).toEqual(0x5a);
    expect(cpu.data[28]).toEqual(0x99); // verify that Y was decremented
  });

  it('should execute `STD Y+17, r0` instruction', () => {
    loadProgram('098a');
    cpu.data[0] = 0xba; // r0 <- 0xba
    cpu.data[28] = 0x9a; // Y <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0x9a + 17]).toEqual(0xba);
    expect(cpu.data[28]).toEqual(0x9a); // verify that Y was unchanged
  });

  it('should execute `ST Z, r16` instruction', () => {
    loadProgram('0083');
    cpu.data[16] = 0xdf; // r2 <- 0xdf
    cpu.data[30] = 0x40; // Z <- 0x40
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x40]).toEqual(0xdf);
    expect(cpu.data[30]).toEqual(0x40); // verify that Z was unchanged
  });

  it('should execute `ST Z+, r0` instruction', () => {
    loadProgram('0192');
    cpu.data[0] = 0x55; // r0 <- 0x55
    cpu.dataView.setUint16(30, 0x155, true); // Z <- 0x155
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x155]).toEqual(0x55);
    expect(cpu.dataView.getUint16(30, true)).toEqual(0x156); // verify that Z was incremented
  });

  it('should execute `ST -Z, r16` instruction', () => {
    loadProgram('0293');
    cpu.data[16] = 0x5a; // r16 <- 0x5a
    cpu.data[30] = 0xff; // Z <- 0xff
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0xfe]).toEqual(0x5a);
    expect(cpu.data[30]).toEqual(0xfe); // verify that Z was decremented
  });

  it('should execute `STD Z+1, r0` instruction', () => {
    loadProgram('0182');
    cpu.data[0] = 0xcc; // r0 <- 0xcc
    cpu.data[30] = 0x50; // Z <- 0x50
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0x51]).toEqual(0xcc);
    expect(cpu.data[30]).toEqual(0x50); // verify that Z was unchanged
  });

  it('should execute `SWAP r1` instruction', () => {
    loadProgram('1294');
    cpu.data[1] = 0xa5; // r1 <- 0xa5
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[1]).toEqual(0x5a); // r1
  });

  it('should execute `XCH r21` instruction', () => {
    loadProgram('5493');
    cpu.data[21] = 0xa1; // r21 <- 0xa1
    cpu.data[30] = 0x50; // Z <- 0x50
    cpu.data[0x50] = 0xb9;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[21]).toEqual(0xb9); // r21
    expect(cpu.data[0x50]).toEqual(0xa1);
  });
});
