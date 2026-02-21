import { KEY_SLOT_MAP, InputType, SCREEN_CONFIG } from "./types.js";

export type SlotPressCallback = (slot_index: number, screen_x: number, screen_y: number) => void;
export type PauseCallback = () => void;
export type ResetCallback = () => void;

export class InputHandler {
    private canvas: HTMLCanvasElement | null = null;
    private on_slot_press: SlotPressCallback | null = null;
    private on_pause: PauseCallback | null = null;
    private on_reset: ResetCallback | null = null;

    initialize(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.setup_mouse_handlers();
        this.setup_keyboard_handlers();
    }

    set_slot_press_callback(callback: SlotPressCallback): void {
        this.on_slot_press = callback;
    }

    set_pause_callback(callback: PauseCallback): void {
        this.on_pause = callback;
    }

    set_reset_callback(callback: ResetCallback): void {
        this.on_reset = callback;
    }

    private setup_mouse_handlers(): void {
        if (!this.canvas) {
            return;
        }

        this.canvas.addEventListener("click", (event: MouseEvent) => {
            if (!this.canvas || !this.on_slot_press) {
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const screen_x = event.clientX - rect.left;
            const screen_y = event.clientY - rect.top;

            const column_width = SCREEN_CONFIG.WIDTH / SCREEN_CONFIG.COLUMN_COUNT;
            const slot_index = Math.floor(screen_x / column_width);

            this.on_slot_press(slot_index, screen_x, screen_y);
        });
    }

    private setup_keyboard_handlers(): void {
        document.addEventListener("keydown", (event: KeyboardEvent) => {
            const key = event.key;

            if (key === " ") {
                event.preventDefault();
                if (this.on_pause) {
                    this.on_pause();
                }
                return;
            }

            if (key === "r" || key === "R") {
                event.preventDefault();
                if (this.on_reset) {
                    this.on_reset();
                }
                return;
            }

            if (key in KEY_SLOT_MAP) {
                event.preventDefault();
                const slot_index = KEY_SLOT_MAP[key];
                if (this.on_slot_press) {
                    const column_width = SCREEN_CONFIG.WIDTH / SCREEN_CONFIG.COLUMN_COUNT;
                    const screen_x = slot_index * column_width + column_width / 2;
                    const screen_y = SCREEN_CONFIG.HEIGHT / 2;

                    this.on_slot_press(slot_index, screen_x, screen_y);
                }
            }
        });
    }

    cleanup(): void {
        this.canvas = null;
    }
}
