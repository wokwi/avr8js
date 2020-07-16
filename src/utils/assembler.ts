/**
 * Assemble AVR programs into a list of bytes.
 * Based on code from https://github.com/tadpol/Avrian-Jump,
 * refactored to TypeScript by Uri Shaked.
 *
 * This was written with http://www.atmel.com/atmel/acrobat/doc0856.pdf
 * It is a bit short of features often found in an assembler, but there is enough here to build
 * simple programs and run them.
 *
 * It would be nice someday to add device support, just to give errors on unsupported
 * instructions.  Macros would be nice too.
 *
 * Copyright (C) 2020, Uri Shaked
 * Copyright (c) 2012 Michael Conrad Tadpol Tilstra
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

interface LabelTable {
  [key: string]: number;
}

type Pass1Bytes =
  | string
  | ((l: LabelTable) => string)
  | string[]
  | [(l: LabelTable) => [string, string], string];

interface LineTablePass1 {
  line: number;
  bytes: Pass1Bytes;
  text: string;
  byteOffset: number;
}

export interface LineTable extends LineTablePass1 {
  bytes: string;
}

/**
 * Get a destination register index from a string and shift it to where it
 * is most commonly found.
 * Also, make sure it is within the valid range.
 */
function destRindex(r: string, min = 0, max = 31) {
  const match = r.match(/[Rr](\d{1,2})/);
  if (!match) {
    throw 'Not a register: ' + r;
  }
  const d = parseInt(match[1]);
  if (d < min || d > max) {
    throw 'Rd out of range: ' + min + '<>' + max;
  }
  return (d & 0x1f) << 4;
}

/**
 * Get a source register index from a string and shift it to where it is
 * most commonly found.
 * Also, make sure it is within the valid range.
 */
function srcRindex(r: string, min = 0, max = 31) {
  const match = r.match(/[Rr](\d{1,2})/);
  if (!match) {
    throw 'Not a register: ' + r;
  }
  const d = parseInt(match[1]);
  if (d < min || d > max) {
    throw 'Rd out of range: ' + min + '<>' + max;
  }
  let s = d & 0xf;
  s |= ((d >> 4) & 1) << 9;
  return s;
}

/**
 * Get a constant value and check that it is in range.
 */
function constValue(r: string | number, min = 0, max = 255) {
  const d = typeof r === 'string' ? parseInt(r) : r;
  if (isNaN(d)) {
    throw 'constant is not a number.';
  }
  if (d < min || d > max) {
    throw '[Ks] out of range: ' + min + '<>' + max;
  }
  return d;
}

/*
 * Fit a twos-complement number into the specific bit count
 */
function fitTwoC(r: number, bits: number) {
  if (bits < 2) {
    throw 'Need at least 2 bits to be signed.';
  }
  if (bits > 16) {
    throw 'fitTwoC only works on 16bit numbers for now.';
  }
  if (Math.abs(r) > Math.pow(2, bits - 1))
    throw 'Not enough bits for number. (' + r + ', ' + bits + ')';
  if (r < 0) {
    r = 0xffff + r + 1;
  }
  const mask = 0xffff >> (16 - bits);
  return r & mask;
}

/**
 * Determin if input is an address or label and lookup if required.
 * If label that doesn't exist, return NaN.
 * If offset is not 0, convert from absolute address to relative.
 */
function constOrLabel(c: string | number, labels: LabelTable, offset = 0) {
  if (typeof c === 'string') {
    let d = parseInt(c);
    if (isNaN(d)) {
      if (c in labels) {
        d = labels[c] - offset;
      } else {
        return NaN;
      }
    }
    c = d;
  }
  return c;
}

/**
 * Convert number to hex and left pad it
 * @param len default to words.
 */
function zeroPad(r: number | string, len = 4) {
  r = Number(r).toString(16);
  const base = Array(len + 1).join('0');
  const t = base.substr(0, len - r.length) + r;
  return t;
}

/**
 * Get an Indirect Address Register and shift it to where it is commonly found.
 */
function stldXYZ(xyz: string) {
  switch (xyz) {
    case 'X':
      return 0x900c;
    case 'X+':
      return 0x900d;
    case '-X':
      return 0x900e;
    case 'Y':
      return 0x8008;
    case 'Y+':
      return 0x9009;
    case '-Y':
      return 0x900a;
    case 'Z':
      return 0x8000;
    case 'Z+':
      return 0x9001;
    case '-Z':
      return 0x9002;
    default:
      throw 'Not -?[XYZ]\\+?';
  }
}

/**
 * Get an Indirect Address Register with displacement and shift it to where it is commonly found.
 */
function stldYZq(yzq: string) {
  const d = yzq.match(/([YZ])\+(\d+)/);
  let r = 0x8000;
  if (d == null) {
    throw 'Invalid arguments';
  }
  switch (d[1]) {
    case 'Y':
      r |= 0x8;
      break;
    case 'Z':
      /* r|= 0; */
      break;
    default:
      throw 'Not Y or Z with q';
  }
  const q = parseInt(d[2]);
  if (q < 0 || q > 64) {
    throw 'q is out of range';
  }
  r |= ((q & 0x20) << 8) | ((q & 0x18) << 7) | (q & 0x7);
  return r;
}

type opcodeHandler = (a: string, b: string, byteLoc: number, labels: LabelTable) => Pass1Bytes;

const SEflag = (a: number) => zeroPad(0x9408 | (constValue(a, 0, 7) << 4));

/**
 * Table of instructions that can be assembled.
 */
const OPTABLE: { [key: string]: opcodeHandler } = {
  ADD(a, b) {
    const r = 0x0c00 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  ADC(a, b) {
    const r = 0x1c00 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  ADIW(a, b) {
    let r = 0x9600;
    const dm = a.match(/[Rr](24|26|28|30)/);
    if (!dm) {
      throw 'Rd must be 24, 26, 28, or 30';
    }
    let d = parseInt(dm[1]);
    d = (d - 24) / 2;
    r |= (d & 0x3) << 4;
    const k = constValue(b, 0, 63);
    r |= ((k & 0x30) << 2) | (k & 0x0f);
    return zeroPad(r);
  },
  AND(a, b) {
    const r = 0x2000 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  ANDI(a, b) {
    let r = 0x7000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0xf);
    return zeroPad(r);
  },
  ASR(a) {
    const r = 0x9405 | destRindex(a);
    return zeroPad(r);
  },
  BCLR(a) {
    let r = 0x9488;
    const s = constValue(a, 0, 7);
    r |= (s & 0x7) << 4;
    return zeroPad(r);
  },
  BLD(a, b) {
    const r = 0xf800 | destRindex(a) | (constValue(b, 0, 7) & 0x7);
    return zeroPad(r);
  },
  BRBC(a, b, byteLoc, labels) {
    const k = constOrLabel(b, labels, byteLoc + 2);
    if (isNaN(k)) {
      return (l) => OPTABLE['BRBC'](a, b, byteLoc, l) as string;
    }
    let r = 0xf400 | constValue(a, 0, 7);
    r |= fitTwoC(constValue(k >> 1, -64, 63), 7) << 3;
    return zeroPad(r);
  },
  BRBS(a, b, byteLoc, labels) {
    const k = constOrLabel(b, labels, byteLoc + 2);
    if (isNaN(k)) {
      return (l) => OPTABLE['BRBS'](a, b, byteLoc, l) as string;
    }
    let r = 0xf000 | constValue(a, 0, 7);
    r |= fitTwoC(constValue(k >> 1, -64, 63), 7) << 3;
    return zeroPad(r);
  },
  BRCC(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('0', a, byteLoc, labels);
  },
  BRCS(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('0', a, byteLoc, labels);
  },
  BREAK() {
    return '9598';
  },
  BREQ(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('1', a, byteLoc, labels);
  },
  BRGE(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('4', a, byteLoc, labels);
  },
  BRHC(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('5', a, byteLoc, labels);
  },
  BRHS(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('5', a, byteLoc, labels);
  },
  BRID(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('7', a, byteLoc, labels);
  },
  BRIE(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('7', a, byteLoc, labels);
  },
  BRLO(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('0', a, byteLoc, labels);
  },
  BRLT(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('4', a, byteLoc, labels);
  },
  BRMI(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('2', a, byteLoc, labels);
  },
  BRNE(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('1', a, byteLoc, labels);
  },
  BRPL(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('2', a, byteLoc, labels);
  },
  BRSH(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('0', a, byteLoc, labels);
  },
  BRTC(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('6', a, byteLoc, labels);
  },
  BRTS(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('6', a, byteLoc, labels);
  },
  BRVC(a, _, byteLoc, labels) {
    return OPTABLE['BRBC']('3', a, byteLoc, labels);
  },
  BRVS(a, _, byteLoc, labels) {
    return OPTABLE['BRBS']('3', a, byteLoc, labels);
  },
  BSET(a) {
    let r = 0x9408;
    const s = constValue(a, 0, 7);
    r |= (s & 0x7) << 4;
    return zeroPad(r);
  },
  BST(a, b) {
    const r = 0xfa00 | destRindex(a) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  CALL(a, b, byteLoc, labels) {
    let k = constOrLabel(a, labels);
    if (isNaN(k)) {
      return [(l) => OPTABLE['CALL'](a, b, byteLoc, l) as [string, string], 'xxxx'];
    }
    let r = 0x940e;
    k = constValue(k, 0, 0x400000) >> 1;
    const lk = k & 0xffff;
    const hk = (k >> 16) & 0x3f;
    r |= ((hk & 0x3e) << 3) | (hk & 1);
    return [zeroPad(r), zeroPad(lk)];
  },
  CBI(a, b) {
    const r = 0x9800 | (constValue(a, 0, 31) << 3) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  CRB(a, b, byteLoc, l) {
    const k = constValue(b);
    return OPTABLE['ANDI'](a.toString(), (~k & 0xff).toString(), byteLoc, l);
  },
  CLC() {
    return '9488';
  },
  CLH() {
    return '94d8';
  },
  CLI() {
    return '94f8';
  },
  CLN() {
    return '94a8';
  },
  CLR(a, _, byteLoc, l) {
    return OPTABLE['EOR'](a, a, byteLoc, l);
  },
  CLS() {
    return '94c8';
  },
  CLT() {
    return '94e8';
  },
  CLV() {
    return '94b8';
  },
  CLZ() {
    return '9498';
  },
  COM(a) {
    const r = 0x9400 | destRindex(a);
    return zeroPad(r);
  },
  CP(a, b) {
    const r = 0x1400 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  CPC(a, b) {
    const r = 0x0400 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  CPI(a, b) {
    let r = 0x3000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0xf);
    return zeroPad(r);
  },
  CPSE(a, b) {
    const r = 0x1000 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  DEC(a) {
    const r = 0x940a | destRindex(a);
    return zeroPad(r);
  },
  DES(a) {
    const r = 0x940b | (constValue(a, 0, 15) << 4);
    return zeroPad(r);
  },
  EICALL() {
    return '9519';
  },
  EIJMP() {
    return '9419';
  },
  ELPM(a, b) {
    if (typeof a === 'undefined' || a === '') {
      return '95d8';
    } else {
      let r = 0x9000 | destRindex(a);
      switch (b) {
        case 'Z':
          r |= 6;
          break;
        case 'Z+':
          r |= 7;
          break;
        default:
          throw 'Bad operand';
      }
      return zeroPad(r);
    }
  },
  EOR(a, b) {
    const r = 0x2400 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  FMUL(a, b) {
    const r = 0x0308 | (destRindex(a, 16, 23) & 0x70) | (srcRindex(b, 16, 23) & 0x7);
    return zeroPad(r);
  },
  FMULS(a, b) {
    const r = 0x0380 | (destRindex(a, 16, 23) & 0x70) | (srcRindex(b, 16, 23) & 0x7);
    return zeroPad(r);
  },
  FMULSU(a, b) {
    const r = 0x0388 | (destRindex(a, 16, 23) & 0x70) | (srcRindex(b, 16, 23) & 0x7);
    return zeroPad(r);
  },
  ICALL() {
    return '9509';
  },
  IJMP() {
    return '9409';
  },
  IN(a, b) {
    let r = 0xb000 | destRindex(a);
    const A = constValue(b, 0, 63);
    r |= ((A & 0x30) << 5) | (A & 0x0f);
    return zeroPad(r);
  },
  INC(a) {
    const r = 0x9403 | destRindex(a);
    return zeroPad(r);
  },
  JMP(a, b, byteLoc, labels) {
    let k = constOrLabel(a, labels);
    if (isNaN(k)) {
      return [(l) => OPTABLE['JMP'](a, b, byteLoc, l) as [string, string], 'xxxx'];
    }
    let r = 0x940c;
    k = constValue(k, 0, 0x400000) >> 1;
    const lk = k & 0xffff;
    const hk = (k >> 16) & 0x3f;
    r |= ((hk & 0x3e) << 3) | (hk & 1);
    return [zeroPad(r), zeroPad(lk)];
  },
  LAC(a, b) {
    if (a !== 'Z') {
      throw 'First Operand is not Z';
    }
    const r = 0x9206 | destRindex(b);
    return zeroPad(r);
  },
  LAS(a, b) {
    if (a !== 'Z') {
      throw 'First Operand is not Z';
    }
    const r = 0x9205 | destRindex(b);
    return zeroPad(r);
  },
  LAT(a, b) {
    if (a !== 'Z') {
      throw 'First Operand is not Z';
    }
    const r = 0x9207 | destRindex(b);
    return zeroPad(r);
  },
  LD(a, b) {
    const r = 0x0000 | destRindex(a) | stldXYZ(b);
    return zeroPad(r);
  },
  LDD(a, b) {
    const r = 0x0000 | destRindex(a) | stldYZq(b);
    return zeroPad(r);
  },
  LDI(a, b) {
    let r = 0xe000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0xf);
    return zeroPad(r);
  },
  LDS(a, b) {
    const k = constValue(b, 0, 65535);
    const r = 0x9000 | destRindex(a);
    return [zeroPad(r), zeroPad(k)];
  },
  LPM(a, b) {
    if (typeof a === 'undefined' || a === '') {
      return '95c8';
    } else {
      let r = 0x9000 | destRindex(a);
      switch (b) {
        case 'Z':
          r |= 4;
          break;
        case 'Z+':
          r |= 5;
          break;
        default:
          throw 'Bad operand';
      }
      return zeroPad(r);
    }
  },
  LSL(a, _, byteLoc, l) {
    return OPTABLE['ADD'](a, a, byteLoc, l);
  },
  LSR(a) {
    const r = 0x9406 | destRindex(a);
    return zeroPad(r);
  },
  MOV(a, b) {
    const r = 0x2c00 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  MOVW(a, b) {
    /* use destRindex on both here for simpler shifting */
    const r = 0x0100 | ((destRindex(a) >> 1) & 0xf0) | ((destRindex(b) >> 5) & 0xf);
    return zeroPad(r);
  },
  MUL(a, b) {
    const r = 0x9c00 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  MULS(a, b) {
    const r = 0x0200 | (destRindex(a, 16, 31) & 0xf0) | (srcRindex(b, 16, 31) & 0xf);
    return zeroPad(r);
  },
  MULSU(a, b) {
    const r = 0x0300 | (destRindex(a, 16, 23) & 0x70) | (srcRindex(b, 16, 23) & 0x7);
    return zeroPad(r);
  },
  NEG(a) {
    const r = 0x9401 | destRindex(a);
    return zeroPad(r);
  },
  NOP() {
    return '0000';
  },
  OR(a, b) {
    const r = 0x2800 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  ORI(a, b) {
    let r = 0x6000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0xf);
    return zeroPad(r);
  },
  OUT(a, b) {
    let r = 0xb800 | destRindex(b);
    const A = constValue(a, 0, 63);
    r |= ((A & 0x30) << 5) | (A & 0x0f);
    return zeroPad(r);
  },
  POP(a) {
    const r = 0x900f | destRindex(a);
    return zeroPad(r);
  },
  PUSH(a) {
    const r = 0x920f | destRindex(a);
    return zeroPad(r);
  },
  RCALL(a, b, byteLoc, labels) {
    const k = constOrLabel(a, labels, byteLoc + 2);
    if (isNaN(k)) {
      return (l) => OPTABLE['RCALL'](a, b, byteLoc, l) as string;
    }
    const r = 0xd000 | fitTwoC(constValue(k >> 1, -2048, 2047), 12);
    return zeroPad(r);
  },
  RET() {
    return '9508';
  },
  RETI() {
    return '9518';
  },
  RJMP(a, b, byteLoc, labels) {
    const k = constOrLabel(a, labels, byteLoc + 2);
    if (isNaN(k)) {
      return (l) => OPTABLE['RJMP'](a, b, byteLoc, l) as string;
    }
    const r = 0xc000 | fitTwoC(constValue(k >> 1, -2048, 2047), 12);
    return zeroPad(r);
  },
  ROL(a, _, byteLoc, l) {
    return OPTABLE['ADC'](a, a, byteLoc, l);
  },
  ROR(a) {
    const r = 0x9407 | destRindex(a);
    return zeroPad(r);
  },
  SBC(a, b) {
    const r = 0x0800 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  SBCI(a, b) {
    let r = 0x4000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0x0f);
    return zeroPad(r);
  },
  SBI(a, b) {
    const r = 0x9a00 | (constValue(a, 0, 31) << 3) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  SBIC(a, b) {
    const r = 0x9900 | (constValue(a, 0, 31) << 3) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  SBIS(a, b) {
    const r = 0x9b00 | (constValue(a, 0, 31) << 3) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  SBIW(a, b) {
    let r = 0x9700;
    const dm = a.match(/[Rr](24|26|28|30)/);
    if (!dm) {
      throw 'Rd must be 24, 26, 28, or 30';
    }
    let d = parseInt(dm[1]);
    d = (d - 24) / 2;
    r |= (d & 0x3) << 4;
    const k = constValue(b, 0, 63);
    r |= ((k & 0x30) << 2) | (k & 0x0f);
    return zeroPad(r);
  },
  SBR(a, b) {
    let r = 0x6000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0x0f);
    return zeroPad(r);
  },
  SBRC(a, b) {
    const r = 0xfc00 | destRindex(a) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  SBRS(a, b) {
    const r = 0xfe00 | destRindex(a) | constValue(b, 0, 7);
    return zeroPad(r);
  },
  SEC() {
    return SEflag(0);
  },
  SEH() {
    return SEflag(5);
  },
  SEI() {
    return SEflag(7);
  },
  SEN() {
    return SEflag(2);
  },
  SER(a) {
    const r = 0xef0f | (destRindex(a, 16, 31) & 0xf0);
    return zeroPad(r);
  },
  SES() {
    return SEflag(4);
  },
  SET() {
    return SEflag(6);
  },
  SEV() {
    return SEflag(3);
  },
  SEZ() {
    return SEflag(1);
  },
  SLEEP() {
    return '9588';
  },
  SPM(a) {
    if (typeof a === 'undefined' || a === '') {
      return '95e8';
    } else {
      if (a !== 'Z+') {
        throw 'Bad param to SPM';
      }
      return '95f8';
    }
  },
  ST(a, b) {
    const r = 0x0200 | destRindex(b) | stldXYZ(a);
    return zeroPad(r);
  },
  STD(a, b) {
    const r = 0x0200 | destRindex(b) | stldYZq(a);
    return zeroPad(r);
  },
  STS(a, b) {
    const k = constValue(a, 0, 65535);
    const r = 0x9200 | destRindex(b);
    return [zeroPad(r), zeroPad(k)];
  },
  SUB(a, b) {
    const r = 0x1800 | destRindex(a) | srcRindex(b);
    return zeroPad(r);
  },
  SUBI(a, b) {
    let r = 0x5000 | (destRindex(a, 16, 31) & 0xf0);
    const k = constValue(b);
    r |= ((k & 0xf0) << 4) | (k & 0xf);
    return zeroPad(r);
  },
  SWAP(a) {
    const r = 0x9402 | destRindex(a);
    return zeroPad(r);
  },
  TST(a, _, byteLoc, l) {
    return OPTABLE['AND'](a, a, byteLoc, l);
  },
  WDR() {
    return '95a8';
  },
  XCH(a, b) {
    const r = 0x9204 | destRindex(b);
    if (a !== 'Z') {
      throw 'Bad param, not Z';
    }
    return zeroPad(r);
  },
};

function passOne(inputdata: string) {
  const lines = inputdata.split('\n');
  const commentReg = /[#;].*$/;
  const labelReg = /^(\w+):/;
  const codeReg = /^\s*(\w+)(?:\s+([^,]+)(?:,\s*(\S+))?)?\s*$/;
  let lt: LineTablePass1;
  let res: string;
  let rets: RegExpMatchArray | null;
  let instruction: string;

  let byteOffset = 0;
  const lableTable: LabelTable = {};
  const replacements: { [key: string]: string } = {};
  const errorTable = [];
  const lineTable = [];

  for (let idx = 0; idx < lines.length; idx++) {
    res = lines[idx].trim();
    if (res.length === 0) {
      continue;
    }
    lt = { line: idx + 1, text: res, bytes: [], byteOffset: 0 };
    res = res.replace(commentReg, '').trim(); /* strip off comments. */
    if (res.length === 0) {
      continue;
    }
    /* check for a label */
    rets = res.match(labelReg);
    if (rets) {
      lableTable[rets[1]] = byteOffset;
      res = res.replace(labelReg, '').trim(); /* strip out label. */
    }
    if (res.length === 0) {
      continue;
    }
    /* Check for a mnemonic line */
    const resMatch = res.match(codeReg);
    try {
      if (resMatch === null) {
        throw "doesn't match as code!";
      }

      if (!resMatch[1]) {
        throw 'Empty mnemonic field!';
      }

      /* do opcode */
      instruction = resMatch[1].toUpperCase().trim();
      /* This switch is ok for just these three.
       * If ever to add more, then need to figure out how to merge all of the
       * mnemonics into the OPTABLE. (or build a seperate internal op table)
       */
      switch (instruction) {
        case '_REPLACE':
          replacements[resMatch[2]] = resMatch[3];
          continue;
        case '_LOC': {
          const num = parseInt(resMatch[2]);
          if (isNaN(num)) {
            throw 'Location is not a number.';
          }
          if (num & 0x1) {
            throw 'Location is odd';
          }
          byteOffset = num;
          continue;
        }
        case '_IW': {
          const num = parseInt(resMatch[2]);
          if (isNaN(num)) {
            throw 'Immeadiate Word is not a number.';
          }
          lt.bytes = zeroPad(num);
          lt.byteOffset = byteOffset;
          byteOffset += 2;
          continue;
        }
      }

      if (!(instruction in OPTABLE)) {
        throw 'No such instruction: ' + instruction;
      }

      /* do replacements on parameters. */
      if (resMatch[2] in replacements) {
        resMatch[2] = replacements[resMatch[2]];
      }
      if (resMatch[3] in replacements) {
        resMatch[3] = replacements[resMatch[3]];
      }

      const bytes = OPTABLE[instruction](resMatch[2], resMatch[3], byteOffset, lableTable);
      lt.byteOffset = byteOffset;
      switch (typeof bytes) {
        case 'function':
        case 'string':
          byteOffset += 2;
          break;
        case 'object' /* assumed as an array. */:
          byteOffset += bytes.length * 2;
          break;
        default:
          throw 'unknown return type from optable.';
      }
      lt.bytes = bytes;
      lineTable.push(lt);
    } catch (err) {
      errorTable.push('Line ' + idx + ': ' + err);
    }
  }

  return {
    labels: lableTable,
    errors: errorTable,
    lines: lineTable,
  };
}

function elementSize(lt: LineTablePass1) {
  return typeof lt.bytes === 'string' ? lt.bytes.length / 2 : lt.bytes.length * 2;
}

/**
 * Handle any forward referenced labels that were deferred in passone.
 */
function passTwo(lineTable: LineTablePass1[], labels: LabelTable) {
  const errorTable = [];
  const lastElement = lineTable[lineTable.length - 1];
  const byteSize = lastElement ? lastElement.byteOffset + elementSize(lastElement) : 0;
  const resultTable = new Uint8Array(byteSize);
  for (const ltEntry of lineTable) {
    try {
      /* Look for functions left over from passone. */
      if (typeof ltEntry.bytes === 'function') {
        ltEntry.bytes = ltEntry.bytes(labels);
      }
      if (
        ltEntry.bytes instanceof Array &&
        ltEntry.bytes.length >= 1 &&
        typeof ltEntry.bytes[0] === 'function'
      ) {
        /* a bit gross. FIXME */
        ltEntry.bytes = ltEntry.bytes[0](labels);
      }

      /* copy bytes out of linetable into the results. */
      switch (typeof ltEntry.bytes) {
        case 'string':
          resultTable[ltEntry.byteOffset + 1] = parseInt(ltEntry.bytes.substr(0, 2), 16);
          resultTable[ltEntry.byteOffset] = parseInt(ltEntry.bytes.substr(2, 4), 16);
          break;
        case 'object' /* also array. */:
          if (ltEntry.bytes.length < 1) {
            throw 'Empty array in lineTable.';
          }
          for (let j = 0, bi = ltEntry.byteOffset; j < ltEntry.bytes.length; j++, bi += 2) {
            const value = ltEntry.bytes[j];
            if (typeof value !== 'string') {
              throw 'Not an array of strings.';
            }
            resultTable[bi + 1] = parseInt(value.substr(0, 2), 16);
            resultTable[bi] = parseInt(value.substr(2, 4), 16);
          }
          break;
        default:
          throw 'unknown return type from optable.';
      }
    } catch (err) {
      errorTable.push('Line: ' + ltEntry.line + ': ' + err);
    }
  }

  return { errors: errorTable, bytes: resultTable, lines: lineTable as LineTable[] };
}

/**
 * The assembler.
 */
export function assemble(input: string) {
  const mid = passOne(input);
  if (mid.errors.length > 0) {
    return {
      bytes: new Uint8Array(0),
      errors: mid.errors,
      lines: [],
    };
  }
  return passTwo(mid.lines, mid.labels);
}
