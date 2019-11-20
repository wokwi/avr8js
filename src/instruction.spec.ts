import { CPU, ICPU } from './cpu';
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
    cpu.data[95] = 0x8; // SREG <- 0b00001000 (V)
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1 + 8 / 2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `BRBC 0, +8` instruction when SREG.C is set', () => {
    loadProgram('20f4');
    cpu.data[95] = 0x1; // SREG <- 0b00000001 (C)
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
  });

  it('should execute `BRBS 3, 92` instruction when SREG.V is set', () => {
    loadProgram('73f1');
    cpu.data[95] = 0x8; // SREG <- 0b00001000 (V)
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1 + 92 / 2);
    expect(cpu.cycles).toEqual(2);
  });

  it('should execute `BRBS 3, -4` instruction when SREG.V is set', () => {
    loadProgram('0000f3f3');
    cpu.data[95] = 0x8; // SREG <- 0b00001000 (V)
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

  it('should execute `CALL` instruction', () => {
    loadProgram('0e945c00');
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
    expect(cpu.data[95]).toEqual(0); // SREG 00000000
  });

  it('should execute `CPI r26, 0x9` instruction', () => {
    loadProgram('a930');
    cpu.data[26] = 0x8;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(53); // SREG 00110101 - HSNC
  });

  it('should execute `INC r5` instruction', () => {
    loadProgram('5394');
    cpu.data[5] = 0x7f;
    avrInstruction(cpu);
    expect(cpu.data[5]).toEqual(0x80);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(0x0c); // SREG 00001100 NV
  });

  it('should execute `INC r5` instruction when r5 == 0xff', () => {
    loadProgram('5394');
    cpu.data[5] = 0xff;
    avrInstruction(cpu);
    expect(cpu.data[5]).toEqual(0);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[95]).toEqual(2); // SREG 00000010 - Z
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

  it('should execute `OUT 0x3f, r1` instruction', () => {
    loadProgram('1fbe');
    cpu.data[1] = 0x5a; // r1 <- 0x5a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x5f]).toEqual(0x5a);
  });

  it('should execute `RET` instruction', () => {
    loadProgram('0895');
    cpu.data[93] = 0x90; // SP <- 0x90
    cpu.data[0x92] = 16;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(16);
    expect(cpu.cycles).toEqual(5);
    expect(cpu.data[93]).toEqual(0x92); // SP should increment
  });

  it('should execute `RETI` instruction', () => {
    loadProgram('1895');
    cpu.data[93] = 0xc0; // SP <- 0xc0
    cpu.data[0xc2] = 200;
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(200);
    expect(cpu.cycles).toEqual(5);
    expect(cpu.data[93]).toEqual(0xc2); // SP should increment
    expect(cpu.data[95]).toEqual(0x80); // SREG 10000000 I
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
    expect(cpu.data[95]).toEqual(0x19); // SREG 00011001 SVI
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
});
