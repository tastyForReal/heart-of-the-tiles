const EXCLUDED_FILES: Set<string> = new Set(["chuanshao.mp3", "empty.mp3"]);
const GAME_OVER_NOTES: string[] = ["c.mp3", "e.mp3", "g.mp3"];
const AUDIO_SAMPLES_PATH: string = "assets/sounds/mp3/piano/";

export class AudioManager {
    private audio_context: AudioContext | null = null;
    private audio_buffers: Map<string, AudioBuffer> = new Map();
    private active_sources: Set<AudioBufferSourceNode> = new Set();
    private is_initialized: boolean = false;
    private sample_names: string[] = [];

    async initialize(): Promise<boolean> {
        if (this.is_initialized) {
            return true;
        }

        try {
            this.audio_context = new AudioContext();
            const sample_files = this.get_sample_list();
            this.sample_names = sample_files.filter((file: string) => !EXCLUDED_FILES.has(file));
            await this.preload_samples();
            this.is_initialized = true;

            console.log(`AudioManager initialized with ${this.sample_names.length} samples`);
            return true;
        } catch (error) {
            console.error("Failed to initialize AudioManager:", error);
            return false;
        }
    }

    private get_sample_list(): string[] {
        const samples: string[] = [
            "#A-1.mp3",
            "#A-2.mp3",
            "#A-3.mp3",
            "#a.mp3",
            "#a1.mp3",
            "#a2.mp3",
            "#a3.mp3",
            "#a4.mp3",
            "#C-1.mp3",
            "#C-2.mp3",
            "#c.mp3",
            "#c1.mp3",
            "#c2.mp3",
            "#c3.mp3",
            "#c4.mp3",
            "#D-1.mp3",
            "#D-2.mp3",
            "#d.mp3",
            "#d1.mp3",
            "#d2.mp3",
            "#d3.mp3",
            "#d4.mp3",
            "#F-1.mp3",
            "#F-2.mp3",
            "#f.mp3",
            "#f1.mp3",
            "#f2.mp3",
            "#f3.mp3",
            "#f4.mp3",
            "#G-1.mp3",
            "#G-2.mp3",
            "#g.mp3",
            "#g1.mp3",
            "#g2.mp3",
            "#g3.mp3",
            "#g4.mp3",
            "A-1.mp3",
            "A-2.mp3",
            "A-3.mp3",
            "a.mp3",
            "a1.mp3",
            "a2.mp3",
            "a3.mp3",
            "a4.mp3",
            "B-1.mp3",
            "B-2.mp3",
            "B-3.mp3",
            "b.mp3",
            "b1.mp3",
            "b2.mp3",
            "b3.mp3",
            "b4.mp3",
            "C-1.mp3",
            "C-2.mp3",
            "c.mp3",
            "c1.mp3",
            "c2.mp3",
            "c3.mp3",
            "c4.mp3",
            "c5.mp3",
            "chuanshao.mp3",
            "D-1.mp3",
            "D-2.mp3",
            "d.mp3",
            "d1.mp3",
            "d2.mp3",
            "d3.mp3",
            "d4.mp3",
            "E-1.mp3",
            "E-2.mp3",
            "e.mp3",
            "e1.mp3",
            "e2.mp3",
            "e3.mp3",
            "e4.mp3",
            "empty.mp3",
            "F-1.mp3",
            "F-2.mp3",
            "f.mp3",
            "f1.mp3",
            "f2.mp3",
            "f3.mp3",
            "f4.mp3",
            "G-1.mp3",
            "G-2.mp3",
            "g.mp3",
            "g1.mp3",
            "g2.mp3",
            "g3.mp3",
            "g4.mp3",
            "mute.mp3",
        ];

        return samples;
    }

    private async preload_samples(): Promise<void> {
        if (!this.audio_context) {
            throw new Error("AudioContext not initialized");
        }

        const load_promises: Promise<void>[] = [];

        for (const sample_name of this.sample_names) {
            const promise = this.load_sample(sample_name);
            load_promises.push(promise);
        }

        await Promise.all(load_promises);
    }

    private async load_sample(sample_name: string): Promise<void> {
        if (!this.audio_context) {
            return;
        }

        try {
            // URL-encode the file name to handle special characters like '#'
            const encoded_name = encodeURIComponent(sample_name);
            const response = await fetch(AUDIO_SAMPLES_PATH + encoded_name);

            if (!response.ok) {
                console.warn(`Failed to load sample: ${sample_name}`);
                return;
            }

            const array_buffer = await response.arrayBuffer();
            const audio_buffer = await this.audio_context.decodeAudioData(array_buffer);
            this.audio_buffers.set(sample_name, audio_buffer);
        } catch (error) {
            console.warn(`Error loading sample ${sample_name}:`, error);
        }
    }

    play_random_sample(): void {
        if (!this.is_initialized || !this.audio_context || this.sample_names.length === 0) {
            return;
        }

        if (this.audio_context.state === "suspended") {
            this.audio_context.resume();
        }

        const random_index = Math.floor(Math.random() * this.sample_names.length);
        const sample_name = this.sample_names[random_index];

        this.play_sample(sample_name);
    }

    private play_sample(sample_name: string): void {
        if (!this.audio_context) {
            return;
        }

        const buffer = this.audio_buffers.get(sample_name);
        if (!buffer) {
            console.warn(`Sample not found: ${sample_name}`);
            return;
        }

        try {
            const source = this.audio_context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audio_context.destination);

            this.active_sources.add(source);
            source.onended = () => {
                this.active_sources.delete(source);
            };

            source.start(0);
        } catch (error) {
            console.warn(`Error playing sample ${sample_name}:`, error);
        }
    }

    play_game_over_chord(): void {
        if (!this.is_initialized || !this.audio_context) {
            return;
        }

        if (this.audio_context.state === "suspended") {
            this.audio_context.resume();
        }

        for (const note of GAME_OVER_NOTES) {
            this.play_sample(note);
        }
    }

    stop_all_samples(): void {
        for (const source of this.active_sources) {
            try {
                source.stop();
            } catch {
                // Source may have already stopped
            }
        }
        this.active_sources.clear();
    }

    get_is_initialized(): boolean {
        return this.is_initialized;
    }

    get_loaded_sample_count(): number {
        return this.audio_buffers.size;
    }

    resume_context(): void {
        if (this.audio_context && this.audio_context.state === "suspended") {
            this.audio_context.resume();
        }
    }
}

let audio_manager_instance: AudioManager | null = null;

export function get_audio_manager(): AudioManager {
    if (!audio_manager_instance) {
        audio_manager_instance = new AudioManager();
    }
    return audio_manager_instance;
}
