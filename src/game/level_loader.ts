import { RowType } from "./types.js";
import { MidiJson } from "./midi_types.js";
import { convert_raw_to_midi_json } from "./json_to_midi.js";

export interface RowTypeResult {
    type: RowType;
    height_multiplier: number;
}

/**
 * Metadata for a music section within the level (internal representation)
 */
export interface MusicMetadata {
    id: number;
    tps: number; // Tiles per second
    start_row_index: number; // Index of first row in combined array
    end_row_index: number; // Index after last row (exclusive)
    row_count: number; // Number of rows in this music
}

/**
 * Complete level data including rows and music metadata
 */
export interface LevelData {
    rows: RowTypeResult[];
    musics: MusicMetadata[];
    base_bpm: number;
    midi_json: MidiJson | null; // Formatted MIDI data for playback
}

interface ParsedComponent {
    duration: number;
    original_type: RowType;
}

const DURATION_MAP: Record<string, number> = {
    H: 256,
    I: 128,
    J: 64,
    K: 32,
    L: 16,
    M: 8,
    N: 4,
    O: 2,
    P: 1,
};

const REST_MAP: Record<string, number> = {
    Q: 256,
    R: 128,
    S: 64,
    T: 32,
    U: 16,
    V: 8,
    W: 4,
    X: 2,
    Y: 1,
};

function extract_duration_letters(str: string): number {
    let total = 0;
    for (const char of str) {
        if (DURATION_MAP[char]) {
            total += DURATION_MAP[char];
        }
    }
    return total;
}

function extract_rest_letters(str: string): number {
    let total = 0;
    for (const char of str) {
        if (REST_MAP[char]) {
            total += REST_MAP[char];
        }
    }
    return total;
}

function is_only_rest_letters(str: string): boolean {
    for (const char of str) {
        if (!REST_MAP[char]) {
            return false;
        }
    }
    return str.length > 0;
}

function parse_component(component: string): ParsedComponent {
    const trimmed = component.trim();

    const group_match = trimmed.match(/^(\d)<(.+)>$/);
    if (group_match) {
        const type_id = parseInt(group_match[1], 10);
        const group_content = group_match[2];

        const duration = extract_duration_letters(group_content);
        const original_type = type_id === 5 ? RowType.DOUBLE : RowType.SINGLE;
        return { duration, original_type };
    }

    if (is_only_rest_letters(trimmed)) {
        const duration = extract_rest_letters(trimmed);
        return { duration, original_type: RowType.EMPTY };
    }

    const duration = extract_duration_letters(trimmed);
    return { duration, original_type: RowType.SINGLE };
}

function split_score(score: string): string[] {
    const components: string[] = [];
    let current = "";
    let i = 0;

    while (i < score.length) {
        const char = score[i];

        if (score[i] === "<") {
            if (current.length > 0 && /\d$/.test(current)) {
                const digit = current.slice(-1);
                current = current.slice(0, -1);

                if (current.trim()) {
                    components.push(current.trim());
                    current = "";
                }

                let depth = 0;
                let group_str = digit;
                while (i < score.length) {
                    if (score[i] === "<") depth++;
                    else if (score[i] === ">") depth--;
                    group_str += score[i];
                    i++;
                    if (depth === 0) break;
                }
                components.push(group_str);
                if (score[i] === ",") i++;
            } else {
                current += char;
                i++;
            }
        } else if (char === "," || char === ";") {
            if (current.trim()) {
                components.push(current.trim());
                current = "";
            }
            i++;
        } else {
            current += char;
            i++;
        }
    }

    if (current.trim()) {
        components.push(current.trim());
    }

    return components;
}

export function parse_score(score: string): ParsedComponent[] {
    const component_strings = split_score(score);
    return component_strings.map(parse_component);
}

interface TimelineEntry {
    start: number;
    end: number;
    index: number;
    is_rest: boolean;
}

function build_timeline(components: ParsedComponent[]): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];
    let current_time = 0;

    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        timeline.push({
            start: current_time,
            end: current_time + comp.duration,
            index: i,
            is_rest: comp.original_type === RowType.EMPTY,
        });
        current_time += comp.duration;
    }

    return timeline;
}

function ranges_overlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 < end2 && start2 < end1;
}

function blend_tracks(
    primary_components: ParsedComponent[],
    primary_timeline: TimelineEntry[],
    secondary_scores: string[],
): Set<number> {
    const blended_indices = new Set<number>();

    for (const secondary_score of secondary_scores) {
        const secondary_components = parse_score(secondary_score);
        const secondary_timeline = build_timeline(secondary_components);

        for (const sec_entry of secondary_timeline) {
            if (!sec_entry.is_rest) {
                for (const prim_entry of primary_timeline) {
                    if (ranges_overlap(prim_entry.start, prim_entry.end, sec_entry.start, sec_entry.end)) {
                        if (prim_entry.is_rest) {
                            blended_indices.add(prim_entry.index);
                        }
                    }
                }
            }
        }
    }

    return blended_indices;
}

function generate_results(
    components: ParsedComponent[],
    blended_indices: Set<number>,
    unit_divisor: number,
): RowTypeResult[] {
    return components.map((comp, index) => {
        if (comp.original_type === RowType.EMPTY && blended_indices.has(index)) {
            return {
                type: RowType.SINGLE,
                height_multiplier: comp.duration <= unit_divisor ? 1 : comp.duration / unit_divisor,
            };
        }

        if (comp.original_type === RowType.DOUBLE) {
            return { type: RowType.DOUBLE, height_multiplier: 1 };
        }

        if (comp.original_type === RowType.EMPTY) {
            return { type: RowType.EMPTY, height_multiplier: comp.duration / unit_divisor };
        }

        return {
            type: RowType.SINGLE,
            height_multiplier: comp.duration <= unit_divisor ? 1 : comp.duration / unit_divisor,
        };
    });
}

function process_music(music: { id: number; base_beats: number; scores: string[] }): RowTypeResult[] {
    // base_beats can be a decimal (e.g., 0.5), so we multiply by 32 to get the unit divisor
    const unit_divisor = 32 * music.base_beats;

    if (music.scores.length === 0) return [];

    const primary_components = parse_score(music.scores[0]);
    const primary_timeline = build_timeline(primary_components);

    const secondary_scores = music.scores.slice(1);
    const blended_indices = blend_tracks(primary_components, primary_timeline, secondary_scores);

    return generate_results(primary_components, blended_indices, unit_divisor);
}

/**
 * Music entry in the JSON file (matches JSON format)
 */
export interface MusicEntry {
    id: number;
    bpm?: number;
    baseBeats: number; // JSON uses camelCase
    scores: string[];
}

/**
 * Input file format for level data (matches JSON format)
 */
export interface MusicInputFile {
    baseBpm: number; // JSON uses camelCase
    musics: MusicEntry[];
    audition?: {
        start: [number, number];
        end: [number, number];
    };
}

export interface MusicOutput {
    id: number;
    rows: RowTypeResult[];
}

export interface MusicOutputFile {
    results: MusicOutput[];
}

/**
 * Validates the structure of music input data
 */
function validate_music_input(data: unknown): MusicInputFile {
    if (!data || typeof data !== "object") {
        throw new Error("Invalid JSON structure: expected an object");
    }

    const input = data as Record<string, unknown>;

    if (typeof input.baseBpm !== "number") {
        throw new Error('Invalid JSON structure: "baseBpm" must be a number and is required');
    }

    if (!input.musics || !Array.isArray(input.musics)) {
        throw new Error('Invalid JSON structure: "musics" array is required');
    }

    for (const music of input.musics) {
        if (typeof music.id !== "number") {
            throw new Error('Invalid music entry: "id" must be a number');
        }
        if (typeof music.baseBeats !== "number") {
            throw new Error('Invalid music entry: "baseBeats" must be a number');
        }
        if (!Array.isArray(music.scores)) {
            throw new Error('Invalid music entry: "scores" must be an array');
        }
    }

    return data as MusicInputFile;
}

/**
 * Process all musics and return a map of id -> rows
 */
function process_all_musics(data: MusicInputFile): Map<number, RowTypeResult[]> {
    const results = new Map<number, RowTypeResult[]>();
    for (const music of data.musics) {
        results.set(
            music.id,
            process_music({
                id: music.id,
                base_beats: music.baseBeats,
                scores: music.scores,
            }),
        );
    }
    return results;
}

/**
 * Parses a JSON string containing music data and returns individual music outputs
 */
export function parse_music_json_string(json_string: string): MusicOutput[] {
    const data = JSON.parse(json_string);
    validate_music_input(data);

    const results: MusicOutput[] = [];

    for (const music of data.musics) {
        results.push({
            id: music.id,
            rows: process_music({
                id: music.id,
                base_beats: music.baseBeats,
                scores: music.scores,
            }),
        });
    }

    return results;
}

/**
 * Processes music input data and returns individual music outputs
 */
export function process_music_input_data(data: MusicInputFile): MusicOutput[] {
    const results: MusicOutput[] = [];

    for (const music of data.musics) {
        results.push({
            id: music.id,
            rows: process_music({
                id: music.id,
                base_beats: music.baseBeats,
                scores: music.scores,
            }),
        });
    }

    return results;
}

/**
 * Calculate TPS (Tiles Per Second) for a music entry
 * TPS = bpm / base_beats / 60
 */
function calculate_tps(music: MusicEntry, base_bpm: number): number {
    const bpm = music.bpm ?? base_bpm;
    return bpm / music.baseBeats / 60;
}

/**
 * Process all musics from a JSON file, sort by id ascending,
 * combine all rows into a single array, and track TPS metadata.
 * This is the main function for level loading.
 */
export function parse_and_combine_musics(json_string: string): LevelData {
    const data = JSON.parse(json_string);
    validate_music_input(data);

    const base_bpm = data.baseBpm;

    // Sort musics by id in ascending order
    const sorted_musics = [...data.musics].sort((a, b) => a.id - b.id);

    // Combine all rows from all musics and track metadata
    const combined_rows: RowTypeResult[] = [];
    const musics_metadata: MusicMetadata[] = [];

    for (const music of sorted_musics) {
        const rows = process_music({
            id: music.id,
            base_beats: music.baseBeats,
            scores: music.scores,
        });
        const start_row_index = combined_rows.length;
        const tps = calculate_tps(music, base_bpm);

        combined_rows.push(...rows);

        musics_metadata.push({
            id: music.id,
            tps,
            start_row_index,
            end_row_index: combined_rows.length,
            row_count: rows.length,
        });
    }

    // Convert raw JSON to formatted MIDI JSON for playback
    let midi_json: MidiJson | null = null;
    try {
        console.log(`[LevelLoader] Starting MIDI conversion for ${data.musics.length} music parts...`);
        console.log(`[LevelLoader] Using baseBpm: ${base_bpm} as fallback for missing BPM values`);
        midi_json = convert_raw_to_midi_json(data.musics, base_bpm);
        console.log(`[LevelLoader] MIDI conversion successful!`);
        console.log(`  - Total tracks: ${midi_json.tracks.length}`);
        console.log(`  - Total tempo changes: ${midi_json.header.tempos.length}`);

        // Log some timing info
        let max_time = 0;
        let total_notes = 0;
        for (const track of midi_json.tracks) {
            total_notes += track.notes.length;
            for (const note of track.notes) {
                const note_end = note.time + note.duration;
                if (note_end > max_time) {
                    max_time = note_end;
                }
            }
        }
        console.log(`  - Total notes: ${total_notes}`);
        console.log(`  - Duration: ${max_time.toFixed(2)}s`);
    } catch (error) {
        console.error(`[LevelLoader] Failed to convert music to MIDI format:`);
        console.error(error);
    }

    return {
        rows: combined_rows,
        musics: musics_metadata,
        base_bpm,
        midi_json,
    };
}

/**
 * Browser-compatible file reader using FileReader API
 * Reads a JSON file and returns a promise with complete level data
 */
export function read_music_file_from_browser(file: File): Promise<LevelData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = event => {
            try {
                const json_string = event.target?.result as string;
                const level_data = parse_and_combine_musics(json_string);
                resolve(level_data);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error("Failed to read file"));
        };

        reader.readAsText(file);
    });
}

/**
 * Creates a file input element and triggers file selection dialog
 * Returns a promise that resolves with complete level data
 */
export function select_and_load_music_file(): Promise<LevelData> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";

        input.onchange = async event => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                reject(new Error("No file selected"));
                return;
            }

            try {
                const level_data = await read_music_file_from_browser(file);
                resolve(level_data);
            } catch (error) {
                reject(error);
            }
        };

        input.oncancel = () => {
            reject(new Error("File selection cancelled"));
        };

        input.click();
    });
}

export {
    process_music,
    process_all_musics,
    validate_music_input,
    extract_duration_letters,
    extract_rest_letters,
    split_score,
};
