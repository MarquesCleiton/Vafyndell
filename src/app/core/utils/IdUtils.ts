/**
 * Gera ULIDs (Universally Unique Lexicographically Sortable Identifiers)
 * https://github.com/ulid/spec
 *
 * Exemplo: 01JH7F9G5R4K93X92E6T0P5H1M
 */
export class IdUtils {
  private static ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32
  private static TIME_LEN = 10; // 48 bits timestamp → 10 chars
  private static RAND_LEN = 16; // 80 bits randomness → 16 chars

  /** Gera um novo ULID */
  static generateULID(date: Date = new Date()): string {
    const time = this.encodeTime(date.getTime(), this.TIME_LEN);
    const rand = this.encodeRandom(this.RAND_LEN);
    return time + rand;
  }

  /** Converte timestamp para base32 */
  private static encodeTime(time: number, length: number): string {
    let str = '';
    for (let i = length - 1; i >= 0; i--) {
      str = this.ENCODING[time % 32] + str;
      time = Math.floor(time / 32);
    }
    return str;
  }

  /** Gera a parte aleatória do ULID */
  private static encodeRandom(length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      const rand = Math.floor(Math.random() * 32);
      str += this.ENCODING[rand];
    }
    return str;
  }
}
