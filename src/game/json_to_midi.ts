import {
    ParsedMessage,
    ParsedTrack,
    ParsedPart,
    MidiNote,
    MidiTrack,
    MidiJson,
    MidiTempo,
    NOTE_TO_MIDI,
    BASEBEATS_MAP,
} from "./midi_types.js";

/**
 * Gets the MIDI note number from a note name string.
 */
export function get_note_number(note_name: string): number {
    if (note_name in NOTE_TO_MIDI) {
        return NOTE_TO_MIDI[note_name];
    }
    return 0;
}

/**
 * Gets the base beats multiplier from the baseBeats string.
 */
export function get_base_beats_multiplier(base_beats_str: string): number {
    // Handle both string and number inputs
    const key = String(base_beats_str);
    if (key in BASEBEATS_MAP) {
        return BASEBEATS_MAP[key];
    }
    throw new Error(`Unknown baseBeats value: ${base_beats_str}`);
}

/**
 * Calculates the length in ticks from a length code string.
 * Length codes use letters H-P for note lengths.
 */
export function get_length(str: string, base_beats: number): number {
    let delay = 0;
    for (const char of str) {
        switch (char) {
            case "H":
                delay += 256 * base_beats;
                break;
            case "I":
                delay += 128 * base_beats;
                break;
            case "J":
                delay += 64 * base_beats;
                break;
            case "K":
                delay += 32 * base_beats;
                break;
            case "L":
                delay += 16 * base_beats;
                break;
            case "M":
                delay += 8 * base_beats;
                break;
            case "N":
                delay += 4 * base_beats;
                break;
            case "O":
                delay += 2 * base_beats;
                break;
            case "P":
                delay += 1 * base_beats;
                break;
            default:
                return 0;
        }
        if (delay > 0xffffff) {
            throw new Error("Length overflow");
        }
    }
    return delay;
}

/**
 * Calculates the rest length in ticks from a rest code string.
 * Rest codes use letters Q-Y.
 */
export function get_rest(str: string, base_beats: number): number {
    let delay = 0;
    for (const char of str) {
        switch (char) {
            case "Q":
                delay += 256 * base_beats;
                break;
            case "R":
                delay += 128 * base_beats;
                break;
            case "S":
                delay += 64 * base_beats;
                break;
            case "T":
                delay += 32 * base_beats;
                break;
            case "U":
                delay += 16 * base_beats;
                break;
            case "V":
                delay += 8 * base_beats;
                break;
            case "W":
                delay += 4 * base_beats;
                break;
            case "X":
                delay += 2 * base_beats;
                break;
            case "Y":
                delay += 1 * base_beats;
                break;
            default:
                return 0;
        }
        if (delay > 0xffffff) {
            throw new Error("Length overflow");
        }
    }
    return delay;
}

/**
 * Safe divider class that accumulates remainders for accurate division.
 */
export class SafeDivider {
    private remainder: number = 0;

    divide(a: number, b: number): number {
        if (b === 0) {
            throw new Error("Division by zero");
        }
        const c = Math.floor(a / b);
        this.remainder += a - c * b;
        if (this.remainder >= b) {
            this.remainder = this.remainder - b;
            return c + 1;
        }
        return c;
    }

    reset(): void {
        this.remainder = 0;
    }
}

/**
 * Parses a single track score string into messages.
 */
export function parse_track(score: string, bpm: number, base_beats: number): ParsedTrack {
    const messages: ParsedMessage[] = [];
    let mode = 0;
    let notes: number[] = [];

    for (let i = 0; i < score.length; i++) {
        const char = score[i];

        if (char === ".") {
            if (mode === 2) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
        } else if (char === "~" || char === "$") {
            if (mode === 2) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
            notes.push(2);
        } else if (char === "@") {
            if (mode === 2) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
            notes.push(3);
        } else if (char === "%") {
            if (mode === 2) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
            notes.push(4);
        } else if (char === "!") {
            if (mode === 2) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
            notes.push(5);
        } else if (char === "^" || char === "&") {
            if (mode === 2) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
            notes.push(6);
        } else if (char === "(") {
            if (mode === 0) {
                mode = 1;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
        } else if (char === ")") {
            if (mode === 2) {
                mode = 3;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
        } else if (char === "[") {
            if (mode === 3) {
                mode = 4;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
        } else if (char === "]") {
            if (mode === 6) {
                mode = 5;
            } else {
                throw new Error(`Unexpected ${char}`);
            }
        } else if (char === "," || char === ";") {
            if (mode === 5) {
                mode = 0;
            } else if (mode === 0) {
                // Duplicated separator - ignore
            } else {
                throw new Error(`Unexpected ${char}`);
            }
        } else {
            if (char === " ") {
                continue;
            }

            // Ignore < > and digits outside parsing contexts
            if ((char === "<" || (char >= "0" && char <= "9")) && mode === 0) {
                continue;
            }
            if ((char === ">" || char === "{" || char === "}" || (char >= "0" && char <= "9")) && mode === 5) {
                continue;
            }

            // Parse a token (note name or length code)
            let temp = "";
            while (true) {
                temp += score[i];
                i++;
                if (
                    i === score.length ||
                    score[i] === "." ||
                    score[i] === "(" ||
                    score[i] === ")" ||
                    score[i] === "~" ||
                    score[i] === "[" ||
                    score[i] === "]" ||
                    score[i] === "," ||
                    score[i] === ";" ||
                    score[i] === "<" ||
                    score[i] === ">" ||
                    score[i] === "@" ||
                    score[i] === "%" ||
                    score[i] === "!" ||
                    score[i] === "$" ||
                    score[i] === "^" ||
                    score[i] === "&"
                ) {
                    i--;
                    break;
                }
            }

            const note = get_note_number(temp);
            const length = get_length(temp, base_beats);
            const rest = get_rest(temp, base_beats);

            if (note !== 0) {
                // It's a note
                if (mode === 0) {
                    mode = 3;
                } else if (mode === 1) {
                    mode = 2;
                } else {
                    throw new Error(`Unexpected token: ${temp}`);
                }
                if (note !== 1) {
                    // note !== 1 means it's not mute/empty
                    notes.push(note);
                }
            } else if (length !== 0) {
                // It's a length code
                if (mode !== 4) {
                    throw new Error(`Unexpected token: ${temp}`);
                }
                mode = 6;

                // Flush notes
                process_notes(notes, length, messages, bpm);
                notes = [];
            } else if (rest !== 0) {
                // It's a rest
                if (mode === 0) {
                    mode = 5;
                    messages.push({ type: 2, value: rest });
                } else if (mode === 1) {
                    mode = 2;
                } else {
                    throw new Error(`Unexpected token: ${temp}`);
                }
            } else {
                throw new Error(`Couldn't parse "${temp}"`);
            }
        }
    }

    if (mode !== 0 && mode !== 5) {
        throw new Error("Incomplete score string");
    }

    return {
        base_beats,
        messages,
    };
}

/**
 * Processes accumulated notes and generates messages.
 */
function process_notes(notes: number[], length: number, messages: ParsedMessage[], bpm: number): void {
    const sdiv = new SafeDivider();

    // Count special operators
    const div = notes.filter(n => n === 2).length; // ~
    const arp1 = notes.filter(n => n === 3).length; // @
    const arp2 = notes.filter(n => n === 4).length; // %
    const arp3 = notes.filter(n => n === 5).length; // !
    const arp4 = notes.filter(n => n === 6).length; // ^

    // Validate operator combination
    const operator_count = Number(div > 0) + Number(arp1 > 0) + Number(arp2 > 0) + Number(arp3 > 0) + Number(arp4 > 0);
    if (operator_count > 1 || arp4 > 1) {
        throw new Error("Problem with operators");
    }

    const divisor = div + 1;

    if (arp1 > 0) {
        // @ operator (arpeggio type 1)
        for (let idx = 0; idx <= notes.length; idx++) {
            if (idx === notes.length) {
                messages.push({ type: 2, value: length });
                for (const n of notes) {
                    if (n !== 3) {
                        messages.push({ type: 1, value: n });
                    }
                }
            } else if (notes[idx] === 3) {
                let delay: number;
                if (arp1 === 1) {
                    delay = sdiv.divide(length, 10);
                } else {
                    delay = sdiv.divide(length, 10 * (arp1 - 1));
                }
                if (delay > length) {
                    throw new Error("Fatal error with @");
                }
                length = length - delay;
                messages.push({ type: 2, value: delay });
            } else {
                messages.push({ type: 0, value: notes[idx] });
            }
        }
    } else if (arp2 > 0) {
        // % operator (arpeggio type 2)
        for (let idx = 0; idx <= notes.length; idx++) {
            if (idx === notes.length) {
                messages.push({ type: 2, value: length });
                for (const n of notes) {
                    if (n !== 4) {
                        messages.push({ type: 1, value: n });
                    }
                }
            } else if (notes[idx] === 4) {
                const delay = sdiv.divide(3 * length, 10 * arp2);
                if (delay > length) {
                    throw new Error("Fatal error with %");
                }
                length = length - delay;
                messages.push({ type: 2, value: delay });
            } else {
                messages.push({ type: 0, value: notes[idx] });
            }
        }
    } else if (arp3 > 0) {
        // ! operator (arpeggio type 3)
        for (let idx = 0; idx <= notes.length; idx++) {
            if (idx === notes.length) {
                messages.push({ type: 2, value: length });
                for (const n of notes) {
                    if (n !== 5) {
                        messages.push({ type: 1, value: n });
                    }
                }
            } else if (notes[idx] === 5) {
                const delay = sdiv.divide(3 * length, 20 * arp3);
                if (delay > length) {
                    throw new Error("Fatal error with !");
                }
                length = length - delay;
                messages.push({ type: 2, value: delay });
            } else {
                messages.push({ type: 0, value: notes[idx] });
            }
        }
    } else if (arp4 > 0) {
        // ^ operator (ornament)
        if (notes.length !== 3 || notes[1] !== 6 || notes[0] < 20 || notes[2] < 20) {
            throw new Error("Problem with ornament");
        }

        let note_flip = 0;
        const bpm32 = bpm * 32;

        while (true) {
            // Play note
            messages.push({ type: 0, value: notes[note_flip] });

            // Wait
            let delay = sdiv.divide(bpm32, 720);
            if (delay >= length) {
                // End
                messages.push({ type: 2, value: length });
                messages.push({ type: 1, value: notes[note_flip] });
                break;
            } else {
                length = length - delay;
                messages.push({ type: 2, value: delay });
                messages.push({ type: 1, value: notes[note_flip] });
            }

            // Flip between first and third note
            if (note_flip === 0) {
                note_flip = 2;
            } else if (note_flip === 2) {
                note_flip = 0;
            }
        }
    } else {
        // Normal case (with optional ~ dividers)
        const temp_notes: number[] = [];

        for (let idx = 0; idx <= notes.length; idx++) {
            if (idx === notes.length || notes[idx] === 2) {
                // Flush accumulated notes
                for (const tn of temp_notes) {
                    messages.push({ type: 0, value: tn });
                }
                messages.push({ type: 2, value: sdiv.divide(length, divisor) });
                for (const tn of temp_notes) {
                    messages.push({ type: 1, value: tn });
                }
                temp_notes.length = 0;
            } else {
                temp_notes.push(notes[idx]);
            }
        }
    }
}

/**
 * Calculates the length difference between two tracks.
 */
export function calculate_track_length_diff(messages1: ParsedMessage[], messages2: ParsedMessage[]): number {
    let diff = 0;
    const msg1 = [...messages1];
    const msg2 = [...messages2];
    let a = 0;
    let b = 0;

    while (a < msg1.length || b < msg2.length) {
        while (a < msg1.length) {
            if (msg1[a].value !== 0 && msg1[a].type === 2) {
                msg1[a] = { type: 2, value: msg1[a].value - 1 };
                diff++;
                break;
            } else {
                a++;
            }
        }
        while (b < msg2.length) {
            if (msg2[b].value !== 0 && msg2[b].type === 2) {
                msg2[b] = { type: 2, value: msg2[b].value - 1 };
                diff--;
                break;
            } else {
                b++;
            }
        }
        if (diff > 0xfffffff || diff < -0xfffffff) {
            throw new Error("Length overflow");
        }
    }

    return diff;
}

/**
 * Shrinks a track by removing a specified number of ticks.
 */
export function shrink_track(messages: ParsedMessage[], amount: number): void {
    let remaining = amount;

    // Process from end to beginning
    for (let i = messages.length; i > 0 && remaining > 0; i--) {
        if (messages[i - 1].type === 2) {
            const diff = remaining - messages[i - 1].value;
            if (diff >= 0) {
                remaining = diff;
                messages[i - 1] = { type: 2, value: 0 };
            } else {
                remaining = 0;
                messages[i - 1] = { type: 2, value: -diff };
            }
        }
    }

    if (remaining !== 0) {
        throw new Error("Unable to shrink track - this should not happen");
    }

    // Clean up orphaned notes
    const note_on_stack: number[] = [];
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].type === 2 && messages[i].value > 0) {
            note_on_stack.length = 0;
        } else if (messages[i].type === 0) {
            note_on_stack.push(i);
        } else if (messages[i].type === 1) {
            for (const note_on_idx of note_on_stack) {
                if (messages[note_on_idx].type === 0 && messages[note_on_idx].value === messages[i].value) {
                    messages[i] = { type: 3, value: 0 };
                    messages[note_on_idx] = { type: 3, value: 0 };
                    break;
                }
            }
        }
    }
}

/**
 * Verifies and aligns track lengths within a part.
 */
export function verify_track_length(tracks: ParsedTrack[]): void {
    if (tracks.length === 0) {
        throw new Error("No tracks");
    }

    for (let i = 1; i < tracks.length; i++) {
        const diff = calculate_track_length_diff(tracks[0].messages, tracks[i].messages);

        if (diff < 0) {
            shrink_track(tracks[i].messages, -diff);
        } else if (diff > 0) {
            tracks[i].messages.push({ type: 2, value: diff });
        }
    }
}

/**
 * Parses a complete song into parts.
 * @param musics Array of music parts to parse
 * @param base_bpm Fallback BPM to use when a music part doesn't have its own BPM
 */
export function parse_song(
    musics: Array<{ bpm?: string | number; baseBeats: string | number; scores: string[] }>,
    base_bpm?: number,
): ParsedPart[] {
    const parts: ParsedPart[] = [];

    for (let p = 0; p < musics.length; p++) {
        try {
            const music = musics[p];
            const base_beats_multiplier = get_base_beats_multiplier(String(music.baseBeats));

            // Use music.bpm if defined, otherwise fall back to base_bpm
            const music_bpm = music.bpm !== undefined ? Number(music.bpm) : (base_bpm ?? 120);
            const calculated_bpm = music_bpm * base_beats_multiplier;

            console.log(
                `[MidiParser] Parsing part ${p}: BPM input=${music.bpm ?? "undefined (using baseBpm: " + (base_bpm ?? 120) + ")"}, baseBeats=${music.baseBeats}`,
            );
            console.log(`  - base_beats_multiplier: ${base_beats_multiplier}`);
            console.log(`  - music_bpm: ${music_bpm}`);
            console.log(`  - calculated_bpm (effective): ${calculated_bpm.toFixed(2)}`);

            // Validate BPM is a valid number
            if (isNaN(calculated_bpm) || calculated_bpm <= 0) {
                console.warn(`[MidiParser] Invalid BPM detected: ${calculated_bpm}, using default 120`);
            }

            const part: ParsedPart = {
                bpm: isNaN(calculated_bpm) || calculated_bpm <= 0 ? 120 * base_beats_multiplier : calculated_bpm,
                base_beats: base_beats_multiplier,
                tracks: [],
            };

            for (let t = 0; t < music.scores.length; t++) {
                try {
                    console.log(`  - Parsing track ${t}: score length = ${music.scores[t].length} chars`);
                    const track = parse_track(music.scores[t], part.bpm, base_beats_multiplier);
                    console.log(`    - Track parsed: ${track.messages.length} messages`);
                    part.tracks.push(track);
                } catch (e) {
                    const error = e as Error;
                    console.error(`[MidiParser] Error parsing track ${t + 1}:`);
                    console.error(error);
                    throw new Error(`Track ${t + 1}:\n${error.message}`);
                }
            }

            verify_track_length(part.tracks);
            console.log(`  - Part ${p} complete: ${part.tracks.length} tracks verified`);
            parts.push(part);
        } catch (e) {
            const error = e as Error;
            console.error(`[MidiParser] Error parsing part ${p + 1}:`);
            console.error(error);
            throw new Error(`Part ${p + 1}:\n${error.message}`);
        }
    }

    return parts;
}

/**
 * Aligns tracks across all parts by duplicating tracks where necessary.
 */
function align_tracks_across_parts(parts: ParsedPart[]): ParsedPart[] {
    // Find maximum number of tracks
    let max_tracks = 0;
    for (const part of parts) {
        if (part.tracks.length > max_tracks) {
            max_tracks = part.tracks.length;
        }
    }

    // Duplicate last track for parts with fewer tracks
    for (const part of parts) {
        while (part.tracks.length < max_tracks) {
            const last_track = part.tracks[part.tracks.length - 1];
            const new_track: ParsedTrack = {
                base_beats: last_track.base_beats,
                messages: last_track.messages.map(msg => {
                    // Mark note on/off as ignored (type 3)
                    if (msg.type < 2) {
                        return { type: 3, value: msg.value };
                    }
                    return { ...msg };
                }),
            };
            part.tracks.push(new_track);
        }
    }

    return parts;
}

/**
 * Calculates the total duration of a part in ticks.
 */
function calculate_part_duration(tracks: ParsedTrack[]): number {
    let duration = 0;

    for (const track of tracks) {
        let track_duration = 0;
        for (const msg of track.messages) {
            if (msg.type === 2) {
                track_duration += msg.value;
            }
        }
        if (track_duration > duration) {
            duration = track_duration;
        }
    }

    return duration;
}

/**
 * Converts parsed parts to formatted MIDI JSON.
 * This is the main conversion function that produces the output format.
 */
export function convert_to_midi_json(parts: ParsedPart[]): MidiJson {
    console.log(`[MidiParser] convert_to_midi_json: Processing ${parts.length} parts`);

    // Align tracks across all parts
    const aligned_parts = align_tracks_across_parts(parts);
    console.log(`[MidiParser] Tracks aligned across parts`);

    const ppq = 960; // Ticks per quarter note
    const tempos: MidiTempo[] = [];
    const tracks: MidiTrack[] = [];

    console.log(`[MidiParser] Using PPQ: ${ppq}`);

    // Calculate tick scaling factor (we use PPQ 960 internally)
    const tick_scale = 1;

    // Process each part
    let current_ticks = 0;

    for (let part_idx = 0; part_idx < aligned_parts.length; part_idx++) {
        const part = aligned_parts[part_idx];

        // Set tempo at the current position
        // The conversion from effective BPM to actual BPM is: actual_bpm = effective_bpm / 30
        const actual_bpm = part.bpm / 30;
        console.log(`[MidiParser] Processing part ${part_idx}:`);
        console.log(`  - Effective BPM: ${part.bpm.toFixed(2)}`);
        console.log(`  - Actual BPM: ${actual_bpm.toFixed(2)}`);
        console.log(`  - Current ticks: ${current_ticks}`);
        console.log(`  - Tracks in part: ${part.tracks.length}`);

        tempos.push({
            ticks: Math.round(current_ticks * tick_scale),
            bpm: actual_bpm,
        });

        // Process each track in the part
        for (let track_idx = 0; track_idx < part.tracks.length; track_idx++) {
            const track = part.tracks[track_idx];

            // Get or create the output track
            let output_track = tracks[track_idx];
            if (!output_track) {
                output_track = {
                    channel: track_idx % 16,
                    notes: [],
                };
                tracks[track_idx] = output_track;
            }

            // Convert messages to notes with tick scaling
            const notes_before = output_track.notes.length;
            process_track_messages(track.messages, output_track, current_ticks, tick_scale, tempos);
            console.log(`    - Track ${track_idx}: added ${output_track.notes.length - notes_before} notes`);
        }

        // Calculate part duration for track alignment
        const part_duration = calculate_part_duration(part.tracks);
        console.log(`  - Part duration: ${part_duration} ticks`);
        current_ticks += part_duration;
    }

    console.log(`[MidiParser] Total ticks: ${current_ticks}`);
    console.log(`[MidiParser] Calculating times for ${tracks.length} tracks...`);

    // Calculate times for all notes based on tempo changes
    calculate_times(tracks, tempos, ppq);

    // Add time to tempos
    calculate_tempo_times(tempos, ppq);

    // Log final statistics
    let total_notes = 0;
    for (const track of tracks) {
        total_notes += track.notes.length;
    }
    console.log(
        `[MidiParser] Final result: ${tracks.length} tracks, ${total_notes} total notes, ${tempos.length} tempo changes`,
    );

    return {
        header: {
            ppq,
            tempos,
        },
        tracks,
    };
}

/**
 * Processes track messages and adds notes to the output track.
 */
function process_track_messages(
    messages: ParsedMessage[],
    output_track: MidiTrack,
    start_ticks: number,
    tick_scale: number,
    _tempos: MidiTempo[],
): void {
    let current_ticks = start_ticks;
    const active_notes: Map<number, number> = new Map(); // note number -> start ticks

    for (const msg of messages) {
        switch (msg.type) {
            case 0: // Note on
                active_notes.set(msg.value, current_ticks);
                break;

            case 1: // Note off
                const note_start = active_notes.get(msg.value);
                if (note_start !== undefined) {
                    output_track.notes.push({
                        midi: msg.value,
                        ticks: Math.round(note_start * tick_scale),
                        time: 0, // Will be calculated later
                        duration: 0, // Will be calculated later
                        duration_ticks: Math.round((current_ticks - note_start) * tick_scale),
                        velocity: 100 / 127,
                        note_off_velocity: 64 / 127,
                    });
                    active_notes.delete(msg.value);
                }
                break;

            case 2: // Delay/time
                current_ticks += msg.value;
                break;

            case 3: // Ignore
                break;
        }
    }
}

/**
 * Calculates time values for notes based on tempo changes.
 */
function calculate_times(tracks: MidiTrack[], tempos: MidiTempo[], ppq: number): void {
    // Sort tempos by ticks
    tempos.sort((a, b) => a.ticks - b.ticks);

    for (const track of tracks) {
        for (const note of track.notes) {
            note.time = ticks_to_seconds(note.ticks, tempos, ppq);
            note.duration = ticks_to_seconds(note.ticks + note.duration_ticks, tempos, ppq) - note.time;
        }
    }
}

/**
 * Calculates time values for tempo events.
 */
function calculate_tempo_times(tempos: MidiTempo[], ppq: number): void {
    for (const tempo of tempos) {
        tempo.time = ticks_to_seconds(tempo.ticks, tempos, ppq);
    }
}

/**
 * Converts ticks to seconds based on tempo changes.
 */
function ticks_to_seconds(ticks: number, tempos: MidiTempo[], ppq: number): number {
    let time = 0;
    let current_ticks = 0;
    let current_bpm = tempos.length > 0 ? tempos[0].bpm : 120;

    for (let i = 0; i < tempos.length; i++) {
        const tempo = tempos[i];
        if (tempo.ticks >= ticks) {
            break;
        }
        // Add time from current position to this tempo change
        const delta_ticks = tempo.ticks - current_ticks;
        time += (delta_ticks / ppq) * (60 / current_bpm);
        current_ticks = tempo.ticks;
        current_bpm = tempo.bpm;
    }

    // Add remaining time
    const remaining_ticks = ticks - current_ticks;
    time += (remaining_ticks / ppq) * (60 / current_bpm);

    return time;
}

/**
 * Main conversion function: converts raw JSON music data to formatted MIDI JSON.
 * @param musics Array of music parts to convert
 * @param base_bpm Fallback BPM to use when a music part doesn't have its own BPM
 */
export function convert_raw_to_midi_json(
    musics: Array<{ bpm?: string | number; baseBeats: string | number; scores: string[] }>,
    base_bpm?: number,
): MidiJson {
    console.log(`[MidiParser] Converting ${musics.length} music parts to MIDI format...`);
    console.log(`[MidiParser] Base BPM (fallback): ${base_bpm ?? "not provided, will use 120"}`);

    for (let i = 0; i < musics.length; i++) {
        const music = musics[i];
        console.log(
            `[MidiParser] Music ${i}: BPM=${music.bpm ?? "undefined"}, baseBeats=${music.baseBeats}, scores=${music.scores.length}`,
        );
    }

    const parts = parse_song(musics, base_bpm);
    console.log(`[MidiParser] Parsed ${parts.length} parts`);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        console.log(
            `[MidiParser] Part ${i}: BPM=${part.bpm.toFixed(2)}, base_beats=${part.base_beats}, tracks=${part.tracks.length}`,
        );
    }

    const result = convert_to_midi_json(parts);
    console.log(
        `[MidiParser] Conversion complete: ${result.tracks.length} tracks, ${result.header.tempos.length} tempo changes`,
    );

    return result;
}
