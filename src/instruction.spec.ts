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

  it('should execute `JMP 0xb8` instruction', () => {
    loadProgram('0c945c00');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x5c);
    expect(cpu.cycles).toEqual(3);
  });

  it('should execute `OUT 0x3f, r1` instruction', () => {
    loadProgram('1fbe');
    cpu.data[1] = 0x5a; // put the value 5a in r1
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[0x5f]).toEqual(0x5a);
  });

  it('should execute `LDI r28, 0xff` instruction', () => {
    loadProgram('cfef');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(0x1);
    expect(cpu.cycles).toEqual(1);
    expect(cpu.data[28]).toEqual(0xff);
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
    cpu.data[26] = 0xc0; // X <- 0x9a
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(1);
    expect(cpu.cycles).toEqual(2);
    expect(cpu.data[0xc0]).toEqual(0x15);
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

  it('should execute `RJMP 2` instruction', () => {
    loadProgram('01c0');
    avrInstruction(cpu);
    expect(cpu.pc).toEqual(2);
    expect(cpu.cycles).toEqual(2);
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
    cpu.data[1] = 0x5a; // r1 <- 5a
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
});
