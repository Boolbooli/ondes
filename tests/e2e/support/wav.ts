const RATE = 8_000;
/** Unsigned 8-bit PCM is silent at its midpoint. */
const SILENCE = 0x80;

/**
 * A silent 8 kHz mono 8-bit PCM WAV, built in memory so no binary fixture is committed.
 * The audio engine retries when a stream ends, so it must outlast any single test.
 */
export function silentWav(seconds: number): Buffer {
  const dataSize = RATE * seconds;
  const wav = Buffer.alloc(44 + dataSize, SILENCE);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE, 28); // bytes per second
  wav.writeUInt16LE(1, 32); // bytes per frame
  wav.writeUInt16LE(8, 34); // bits per sample
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataSize, 40);
  return wav;
}
