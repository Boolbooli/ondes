import type { Line, LineId } from '../core/types';

/**
 * The network. Inks are chosen so that porcelain text on the roundel reaches 4.5:1
 * and the line stroke reaches 3:1 on midnight enamel (and on white tile via `inkLight`).
 */
export const lines: readonly Line[] = [
  { id: 'fav', roundel: '★', name: { fr: 'Ma ligne', en: 'My line' }, ink: '#D93A2B', onInk: '#FFFFFF' },
  { id: 'rf', roundel: '1', name: { fr: 'Radio France', en: 'Radio France' }, ink: '#2F64D6', onInk: '#FFFFFF' },
  { id: 'fip', roundel: '2', name: { fr: 'FIP', en: 'FIP' }, ink: '#C93A82', onInk: '#FFFFFF' },
  { id: 'fm', roundel: '3', name: { fr: 'France Musique', en: 'France Musique' }, ink: '#8752D6', onInk: '#FFFFFF' },
  {
    id: 'info',
    roundel: '4',
    name: { fr: 'Info & débats', en: 'News & talk' },
    ink: '#F2B01E',
    onInk: '#1A1300',
    inkLight: '#A86E00',
  },
  { id: 'jazz', roundel: '5', name: { fr: 'Jazz & classique', en: 'Jazz & classical' }, ink: '#137A8C', onInk: '#FFFFFF' },
  { id: 'monde', roundel: '6', name: { fr: 'Monde', en: 'World' }, ink: '#23864A', onInk: '#FFFFFF' },
  { id: 'perso', roundel: '+', name: { fr: 'Mes stations', en: 'My stations' }, ink: '#6B7599', onInk: '#FFFFFF' },
];

const byId = new Map(lines.map((line) => [line.id, line]));

export function lineById(id: LineId): Line {
  const line = byId.get(id);
  if (!line) throw new Error(`Unknown line ${id}`);
  return line;
}

export const isLineId = (value: unknown): value is LineId => typeof value === 'string' && byId.has(value as LineId);

/** Inline custom properties that paint an element with a line's ink. */
export function inkStyle(line: Line): Record<string, string> {
  return { '--ink': line.ink, '--on-ink': line.onInk, '--ink-light': line.inkLight ?? line.ink };
}
