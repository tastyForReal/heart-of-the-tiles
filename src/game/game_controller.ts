import { GPUContext } from "../renderers/gpu_context.js";
import { Renderer } from "../renderers/renderer.js";
import { GameStateManager } from "./game_state.js";
import { InputHandler } from "./input_handler.js";
import { SCREEN_CONFIG, GameState } from "./types.js";

export class GameController {
    private gpu_context: GPUContext;
    private renderer: Renderer;
    private game_state: GameStateManager;
    private input_handler: InputHandler;
    private canvas: HTMLCanvasElement | null = null;
    private last_frame_time: number = 0;
    private is_running: boolean = false;
    private animation_frame_id: number | null = null;
    private is_keyboard_input: boolean = false;

    constructor() {
        this.gpu_context = new GPUContext();
        this.renderer = new Renderer(this.gpu_context);
        this.game_state = new GameStateManager();
        this.input_handler = new InputHandler();
    }

    async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
        this.canvas = canvas;

        const gpu_initialized = await this.gpu_context.initialize(canvas);
        if (!gpu_initialized) {
            console.error("Failed to initialize WebGPU");
            return false;
        }

        const renderer_initialized = await this.renderer.initialize();
        if (!renderer_initialized) {
            console.error("Failed to initialize renderer");
            return false;
        }

        this.input_handler.initialize(canvas);

        this.setup_input_callbacks();

        return true;
    }

    private setup_input_callbacks(): void {
        this.input_handler.set_slot_press_callback((slot_index, screen_x, screen_y) => {
            this.handle_slot_press(slot_index, screen_x, screen_y);
        });

        this.input_handler.set_pause_callback(() => {
            this.handle_pause();
        });

        this.input_handler.set_reset_callback(() => {
            this.handle_reset();
        });
    }

    private handle_slot_press(slot_index: number, screen_x: number, screen_y: number): void {
        const state = this.game_state.get_game_data();

        if (state.state === GameState.GAME_OVER_A || state.state === GameState.GAME_OVER_B) {
            return;
        }

        if (this.is_keyboard_input) {
            this.game_state.handle_keyboard_press(slot_index);
            this.is_keyboard_input = false;
        } else {
            this.game_state.handle_slot_press(slot_index, screen_x, screen_y);
        }
    }

    private handle_pause(): void {
        this.game_state.toggle_pause();
    }

    private handle_reset(): void {
        this.game_state.reset();
    }

    set_keyboard_input(): void {
        this.is_keyboard_input = true;
    }

    start(): void {
        if (this.is_running) {
            return;
        }

        this.is_running = true;
        this.last_frame_time = performance.now();
        this.game_loop();
    }

    stop(): void {
        this.is_running = false;
        if (this.animation_frame_id !== null) {
            cancelAnimationFrame(this.animation_frame_id);
            this.animation_frame_id = null;
        }
    }

    private game_loop(): void {
        if (!this.is_running) {
            return;
        }

        const current_time = performance.now();
        const delta_time = (current_time - this.last_frame_time) / 1000;
        this.last_frame_time = current_time;
        this.update(delta_time, current_time);
        this.render();
        this.animation_frame_id = requestAnimationFrame(() => this.game_loop());
    }

    private update(delta_time: number, current_time: number): void {
        this.game_state.update_scroll(delta_time);
        this.game_state.update_particles(delta_time);
        this.game_state.update_game_over_flash(current_time);
        this.game_state.update_game_over_animation(current_time);
    }

    private render(): void {
        const visible_rows = this.game_state.get_visible_rows();
        const particles = this.game_state.get_particle_system().get_particles();
        const game_over_indicator = this.game_state.get_game_over_indicator();
        this.renderer.render(visible_rows, particles, game_over_indicator);
    }

    resize(width: number, height: number): void {
        this.renderer.resize(width, height);
    }
}
