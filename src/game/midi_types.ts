export const NOTE_TO_MIDI: Record<string, number> = {
    c5: 108,
    b4: 107,
    '#a4': 106,
    a4: 105,
    '#g4': 104,
    g4: 103,
    '#f4': 102,
    f4: 101,
    e4: 100,
    '#d4': 99,
    d4: 98,
    '#c4': 97,
    c4: 96,
    b3: 95,
    '#a3': 94,
    a3: 93,
    '#g3': 92,
    g3: 91,
    '#f3': 90,
    f3: 89,
    e3: 88,
    '#d3': 87,
    d3: 86,
    '#c3': 85,
    c3: 84,
    b2: 83,
    '#a2': 82,
    a2: 81,
    '#g2': 80,
    g2: 79,
    '#f2': 78,
    f2: 77,
    e2: 76,
    '#d2': 75,
    d2: 74,
    '#c2': 73,
    c2: 72,
    b1: 71,
    '#a1': 70,
    a1: 69,
    '#g1': 68,
    g1: 67,
    '#f1': 66,
    f1: 65,
    e1: 64,
    '#d1': 63,
    d1: 62,
    '#c1': 61,
    c1: 60,
    b: 59,
    '#a': 58,
    a: 57,
    '#g': 56,
    g: 55,
    '#f': 54,
    f: 53,
    e: 52,
    '#d': 51,
    d: 50,
    '#c': 49,
    c: 48,
    'B-1': 47,
    '#A-1': 46,
    'A-1': 45,
    '#G-1': 44,
    'G-1': 43,
    '#F-1': 42,
    'F-1': 41,
    'E-1': 40,
    '#D-1': 39,
    'D-1': 38,
    '#C-1': 37,
    'C-1': 36,
    'B-2': 35,
    '#A-2': 34,
    'A-2': 33,
    '#G-2': 32,
    'G-2': 31,
    '#F-2': 30,
    'F-2': 29,
    'E-2': 28,
    '#D-2': 27,
    'D-2': 26,
    '#C-2': 25,
    'C-2': 24,
    'B-3': 23,
    '#A-3': 22,
    'A-3': 21,
    mute: 1,
    empty: 1,
};

export const MIDI_TO_NOTE: Record<number, string> = {};

for (const [note, midi] of Object.entries(NOTE_TO_MIDI)) {
    if (midi >= 21 && midi <= 108) {
        MIDI_TO_NOTE[midi] = note;
    }
}

export interface MidiHeader {
    ppq: number;
    tempos: MidiTempo[];
    name?: string;
}

export interface MidiTempo {
    ticks: number;
    bpm: number;
    time?: number;
}

export interface MidiNote {
    midi: number;
    name?: string;
    ticks: number;
    time: number;
    duration: number;
    duration_ticks: number;
    velocity: number;
    note_off_velocity: number;
}

export interface MidiTrack {
    name?: string;
    channel?: number;
    notes: MidiNote[];
}

export interface MidiJson {
    header: MidiHeader;
    tracks: MidiTrack[];
}

export interface ParsedMessage {
    type: 0 | 1 | 2 | 3;

    value: number;
}

export interface ParsedTrack {
    base_beats: number;
    messages: ParsedMessage[];
}

export interface ParsedPart {
    bpm: number;
    base_beats: number;
    tracks: ParsedTrack[];
}

export interface RawMusicEntry {
    id: number;
    bpm?: number;

    baseBeats: number;
    scores: string[];
}

export interface RawMusicInputFile {
    baseBpm: number;
    musics: RawMusicEntry[];
}

export const BASE_BEATS_MAP: Record<string, number> = {
    '15': 1,
    '7.5': 2,
    '5': 3,
    '3.75': 4,
    '3': 5,
    '2.5': 6,
    '1.875': 8,
    '1.5': 10,
    '1.25': 12,
    '1': 15,
    '0.9375': 16,
    '0.75': 20,
    '0.625': 24,
    '0.5': 30,
    '0.46875': 32,
    '0.375': 40,
    '0.3125': 48,
    '0.25': 60,
    '0.234375': 64,
    '0.1875': 80,
    '0.15625': 96,
    '0.125': 120,
    '0.1171875': 128,
    '0.09375': 160,
    '0.078125': 192,
    '0.0625': 240,
    '0.05859375': 256,
    '0.046875': 320,
    '0.0390625': 384,
    '0.03125': 480,
    '0.029296875': 512,
    '0.0234375': 640,
    '0.01953125': 768,
    '0.015625': 960,
};
