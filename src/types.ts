/*
 * These types are used for interoperability with AssemblyScript.
 * See https://www.assemblyscript.org/portability.html
 */

export type u8 = number;
export type u16 = number;
export type i16 = number;
export type u32 = number;

export const u8 = (x: number) => x as u8;
export const i16 = (x: number) => x as i16;
export const u16 = (x: number) => x as u16;
export const u32 = (x: number) => x as u32;
