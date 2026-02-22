import {
    GameData,
    GameState,
    RowData,
    RowType,
    RectangleData,
    GameOverFlashState,
    GameOverAnimationState,
    SCREEN_CONFIG,
    COLORS,
} from "./types.js";
import { generate_all_rows, find_active_row, is_row_visible, DEFAULT_ROW_COUNT } from "./row_generator.js";
import { ParticleSystem } from "./particle_system.js";
import { point_in_rect } from "../utils/math_utils.js";

export interface GameConfig {
    row_count: number;
    is_bot_active: boolean;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
    row_count: DEFAULT_ROW_COUNT,
    is_bot_active: false,
};

export function create_initial_game_state(config: GameConfig = DEFAULT_GAME_CONFIG): GameData {
    const rows = generate_all_rows(config.row_count);

    return {
        state: GameState.PAUSED,
        rows,
        particles: [],
        total_completed_height: 0,
        scroll_offset: 0,
        game_over_flash: null,
        game_over_animation: null,
        game_won_time: null,
        last_single_slot: 0,
        last_double_slots: null,
        active_row_index: 0,
        completed_rows_count: 0,
    };
}

export class GameStateManager {
    private game_data: GameData;
    private particle_system: ParticleSystem;
    private config: GameConfig;

    constructor(config: GameConfig = DEFAULT_GAME_CONFIG) {
        this.config = config;
        this.game_data = create_initial_game_state(config);
        this.particle_system = new ParticleSystem();
    }

    get_game_data(): GameData {
        return this.game_data;
    }

    get_particle_system(): ParticleSystem {
        return this.particle_system;
    }

    reset(): void {
        this.game_data = create_initial_game_state(this.config);
        this.particle_system.clear();
    }

    start(): void {
        if (this.game_data.state === GameState.PAUSED) {
            this.game_data.state = GameState.PLAYING;
        }
    }

    toggle_pause(): void {
        if (this.config.is_bot_active) return;

        if (this.game_data.state === GameState.PLAYING) {
            this.game_data.state = GameState.PAUSED;
        } else if (this.game_data.state === GameState.PAUSED) {
            this.game_data.state = GameState.PLAYING;
        }
    }

    is_paused(): boolean {
        return (
            this.game_data.state === GameState.PAUSED ||
            this.game_data.state === GameState.GAME_OVER_MISCLICKED ||
            this.game_data.state === GameState.GAME_OVER_OUT_OF_BOUNDS ||
            this.game_data.state === GameState.GAME_WON
        );
    }

    is_game_over(): boolean {
        return (
            this.game_data.state === GameState.GAME_OVER_MISCLICKED ||
            this.game_data.state === GameState.GAME_OVER_OUT_OF_BOUNDS ||
            this.game_data.state === GameState.GAME_WON
        );
    }

    update_scroll(delta_time: number): void {
        if (this.is_paused() || this.is_game_over()) {
            return;
        }

        const scroll_speed = SCREEN_CONFIG.SCROLL_SPEED;
        const scroll_delta = scroll_speed * delta_time;
        this.game_data.scroll_offset += scroll_delta;

        const active_row = this.get_active_row();
        if (active_row) {
            for (const rect of active_row.rectangles) {
                if (rect.is_holding && !rect.is_pressed) {
                    rect.progress += scroll_delta;
                    if (rect.progress >= rect.height) {
                        rect.progress = rect.height;
                        rect.is_holding = false;
                        this.complete_rectangle(rect, active_row, rect.y + this.game_data.scroll_offset, false);
                    }
                }
            }
        }

        this.update_active_row();
    }

    update_bot(): void {
        if (!this.config.is_bot_active || this.is_game_over()) {
            return;
        }

        const active_row = this.get_active_row();
        if (!active_row) return;

        if (active_row.row_type === RowType.START) {
            return;
        }

        const row_top = active_row.y_position + this.game_data.scroll_offset;
        const row_bottom = row_top + active_row.height;
        const trigger_y = SCREEN_CONFIG.HEIGHT / 2;

        const is_long_tile = active_row.height > SCREEN_CONFIG.BASE_ROW_HEIGHT;

        if (is_long_tile) {
            if (row_bottom >= trigger_y) {
                for (const rect of active_row.rectangles) {
                    if (!rect.is_pressed && !rect.is_holding) {
                        rect.is_holding = true;
                    }
                }
            }
        } else {
            if (row_top >= trigger_y) {
                for (const rect of active_row.rectangles) {
                    if (!rect.is_pressed) {
                        this.complete_rectangle(rect, active_row, rect.y + this.game_data.scroll_offset, false);
                    }
                }
            }
        }
    }

    /**
     * Re-evaluates which row is currently "active" (i.e. the lowest, uncompleted visible row).
     * Triggers the out-of-bounds GAME OVER if an uncompleted row falls completely off the visible screen
     * (meaning its Y coordinate plus the global scroll offset exceeds the screen height).
     */
    private update_active_row(): void {
        const current_active_row = this.get_active_row();
        if (current_active_row && current_active_row.row_type !== RowType.START) {
            const screen_y = current_active_row.y_position + this.game_data.scroll_offset;
            if (screen_y > SCREEN_CONFIG.HEIGHT) {
                if (!current_active_row.is_completed) {
                    this.trigger_game_over_out_of_bounds(current_active_row);
                    return;
                }
            }
        }

        const has_incomplete = this.game_data.rows.some(r => !r.is_completed);
        if (!has_incomplete && this.game_data.rows.length > 0) {
            const last_row = this.game_data.rows[this.game_data.rows.length - 1];
            const last_row_screen_y = last_row.y_position + this.game_data.scroll_offset;
            if (last_row_screen_y > SCREEN_CONFIG.HEIGHT) {
                this.trigger_game_won();
                return;
            }
        }

        const visible_incomplete_rows = this.game_data.rows.filter(row => {
            return !row.is_completed && is_row_visible(row, this.game_data.scroll_offset);
        });

        if (visible_incomplete_rows.length > 0) {
            visible_incomplete_rows.sort((a, b) => b.y_position - a.y_position);

            const active_row = visible_incomplete_rows[0];

            this.game_data.active_row_index = active_row.row_index;
        }
    }

    get_active_row(): RowData | null {
        const active_index = this.game_data.active_row_index;
        if (active_index >= 0 && active_index < this.game_data.rows.length) {
            return this.game_data.rows[active_index];
        }
        return null;
    }

    handle_slot_input(slot_index: number, screen_x: number, screen_y: number, is_down: boolean): boolean {
        if (this.is_game_over()) {
            return false;
        }

        const start_row = this.game_data.rows.find(r => r.row_type === RowType.START);

        if (is_down && this.game_data.state === GameState.PAUSED && start_row && !start_row.is_completed) {
            const start_rect = start_row.rectangles[0];
            const start_screen_y = start_rect.y + this.game_data.scroll_offset;
            if (point_in_rect(screen_x, screen_y, start_rect.x, start_screen_y, start_rect.width, start_rect.height)) {
                this.press_rectangle(start_rect, start_row, start_screen_y);
                this.game_data.state = GameState.PLAYING;
                return true;
            }
            return false;
        }

        const active_row = this.get_active_row();
        if (!active_row) {
            return false;
        }

        const row_top = active_row.y_position + this.game_data.scroll_offset;
        const row_bottom = row_top + active_row.height;
        const pressed_rect = active_row.rectangles.find(r => r.slot_index === slot_index);

        if (this.config.is_bot_active) {
            if (is_down) {
                if (!pressed_rect && screen_y >= row_top && screen_y <= row_bottom) {
                    this.trigger_game_over_misclicked(slot_index, screen_x, screen_y, active_row);
                }
            }
            return false;
        }

        if (!is_down) {
            if (pressed_rect && pressed_rect.is_holding && !pressed_rect.is_pressed) {
                pressed_rect.is_holding = false;
                if (pressed_rect.progress < pressed_rect.height) {
                    pressed_rect.is_released_early = true;
                    this.complete_rectangle(
                        pressed_rect,
                        active_row,
                        pressed_rect.y + this.game_data.scroll_offset,
                        true,
                    );
                }
            }
            return false;
        }

        if (pressed_rect && !pressed_rect.is_pressed && !pressed_rect.is_holding) {
            const is_long_tile = active_row.height > SCREEN_CONFIG.BASE_ROW_HEIGHT;
            if (is_long_tile) {
                const hit_zone_top = row_bottom - SCREEN_CONFIG.BASE_ROW_HEIGHT;
                if (screen_y >= hit_zone_top && screen_y <= row_bottom) {
                    pressed_rect.is_holding = true;
                }
                return true;
            } else {
                this.press_rectangle(pressed_rect, active_row, pressed_rect.y + this.game_data.scroll_offset);
                return true;
            }
        } else if (!pressed_rect && screen_y >= row_top && screen_y <= row_bottom) {
            this.trigger_game_over_misclicked(slot_index, screen_x, screen_y, active_row);
            return false;
        }

        return false;
    }

    handle_keyboard_input(slot_index: number, is_down: boolean): boolean {
        if (this.is_game_over()) {
            return false;
        }

        const active_row = this.get_active_row();
        if (!active_row) {
            return false;
        }

        const row_bottom = active_row.y_position + this.game_data.scroll_offset + active_row.height;
        const timing_zone = SCREEN_CONFIG.HEIGHT / 2;

        const pressed_rect = active_row.rectangles.find(r => r.slot_index === slot_index);

        if (this.config.is_bot_active) {
            if (is_down) {
                if (!pressed_rect && row_bottom >= timing_zone) {
                    const column_width = SCREEN_CONFIG.WIDTH / 4;
                    const screen_x = slot_index * column_width + column_width / 2;
                    const screen_y = active_row.y_position + this.game_data.scroll_offset + active_row.height / 2;
                    this.trigger_game_over_misclicked(slot_index, screen_x, screen_y, active_row);
                }
            }
            return false;
        }

        if (!is_down) {
            if (pressed_rect && pressed_rect.is_holding && !pressed_rect.is_pressed) {
                pressed_rect.is_holding = false;
                if (pressed_rect.progress < pressed_rect.height) {
                    pressed_rect.is_released_early = true;
                    this.complete_rectangle(
                        pressed_rect,
                        active_row,
                        pressed_rect.y + this.game_data.scroll_offset,
                        true,
                    );
                }
            }
            return false;
        }

        if (row_bottom < timing_zone) {
            return false;
        }

        if (pressed_rect && !pressed_rect.is_pressed && !pressed_rect.is_holding) {
            const is_long_tile = active_row.height > SCREEN_CONFIG.BASE_ROW_HEIGHT;
            if (is_long_tile) {
                pressed_rect.is_holding = true;
                return true;
            } else {
                this.press_rectangle(pressed_rect, active_row, pressed_rect.y + this.game_data.scroll_offset);
                return true;
            }
        } else if (!pressed_rect) {
            const column_width = SCREEN_CONFIG.WIDTH / 4;
            const screen_x = slot_index * column_width + column_width / 2;
            const screen_y = active_row.y_position + this.game_data.scroll_offset + active_row.height / 2;
            this.trigger_game_over_misclicked(slot_index, screen_x, screen_y, active_row);
            return false;
        }

        return false;
    }

    private complete_rectangle(rect: RectangleData, row: RowData, screen_y: number, early_release: boolean): void {
        rect.is_pressed = true;
        if (!early_release) {
            rect.opacity = 0.25;
            this.particle_system.add_debris(rect.x, screen_y, rect.width, rect.height, 20);
        }
        this.check_row_completion(row);
    }

    private press_rectangle(rect: RectangleData, row: RowData, screen_y: number): void {
        this.complete_rectangle(rect, row, screen_y, false);
    }

    private check_row_completion(row: RowData): void {
        if (row.row_type === RowType.EMPTY) {
            row.is_completed = true;
            return;
        }

        const all_pressed = row.rectangles.every(r => r.is_pressed);
        if (all_pressed) {
            row.is_completed = true;
            row.is_active = false;
            this.game_data.completed_rows_count++;
            this.game_data.total_completed_height += row.height;

            const next_row = this.find_next_incomplete_row(row.row_index);
            if (next_row) {
                this.game_data.active_row_index = next_row.row_index;
            }
        }
    }

    private find_next_incomplete_row(current_index: number): RowData | null {
        for (let i = current_index + 1; i < this.game_data.rows.length; i++) {
            const row = this.game_data.rows[i];
            if (!row.is_completed) {
                return row;
            }
        }
        return null;
    }

    private trigger_game_over_misclicked(
        slot_index: number,
        screen_x: number,
        screen_y: number,
        active_row: RowData,
    ): void {
        this.game_data.state = GameState.GAME_OVER_MISCLICKED;

        const column_width = SCREEN_CONFIG.WIDTH / 4;
        const indicator: RectangleData = {
            slot_index,
            x: slot_index * column_width,
            y: active_row.y_position,
            width: column_width,
            height: active_row.height,
            color: COLORS.RED_GAME_OVER,
            opacity: 1.0,
            is_pressed: false,
            is_game_over_indicator: true,
            flash_state: true,
            is_holding: false,
            progress: 0,
            is_released_early: false,
        };

        this.game_data.game_over_flash = {
            rectangle: indicator,
            start_time: performance.now(),
            flash_count: 0,
            is_flashing: true,
        };
    }

    private trigger_game_over_out_of_bounds(active_row: RowData): void {
        this.game_data.state = GameState.GAME_OVER_OUT_OF_BOUNDS;

        const unpressed_rect = active_row.rectangles.find(r => !r.is_pressed);
        if (unpressed_rect) {
            this.game_data.game_over_flash = {
                rectangle: unpressed_rect,
                start_time: performance.now(),
                flash_count: 0,
                is_flashing: true,
            };
        }

        const target_offset = this.calculate_reposition_offset();
        this.game_data.game_over_animation = {
            start_time: performance.now(),
            duration: 500,
            start_offset: this.game_data.scroll_offset,
            target_offset: target_offset,
            is_animating: true,
        };
    }

    /**
     * Calculates the target scroll offset required to properly animate the rows
     * back up when they fall out of bounds, so the failed row lands cleanly above the bottom edge.
     */
    private calculate_reposition_offset(): number {
        const active_row = this.get_active_row();

        if (!active_row) {
            return this.game_data.scroll_offset;
        }

        const active_row_height = active_row.height;
        const base_row_height = SCREEN_CONFIG.BASE_ROW_HEIGHT;

        return SCREEN_CONFIG.HEIGHT - base_row_height - active_row_height - active_row.y_position;
    }

    private trigger_game_won(): void {
        if (this.game_data.state !== GameState.GAME_WON) {
            this.game_data.state = GameState.GAME_WON;
            this.game_data.game_won_time = performance.now();
        }
    }

    update_game_over_flash(current_time: number): void {
        const flash_state = this.game_data.game_over_flash;
        if (!flash_state || !flash_state.is_flashing) {
            return;
        }

        const elapsed = current_time - flash_state.start_time;
        const flash_interval = 125;
        const total_duration = 1000;

        if (elapsed >= total_duration) {
            flash_state.is_flashing = false;
            flash_state.rectangle.flash_state = false;
            return;
        }

        const flash_count = Math.floor(elapsed / flash_interval);
        flash_state.flash_count = flash_count;
        flash_state.rectangle.flash_state = flash_count % 2 === 0;
    }

    update_game_over_animation(current_time: number): void {
        const animation = this.game_data.game_over_animation;
        if (!animation || !animation.is_animating) {
            return;
        }

        const elapsed = current_time - animation.start_time;
        const progress = Math.min(elapsed / animation.duration, 1.0);

        // Easing function for smoother scroll repositioning
        const eased_progress = 1 - Math.pow(1 - progress, 3);

        const new_offset = animation.start_offset + (animation.target_offset - animation.start_offset) * eased_progress;

        this.game_data.scroll_offset = new_offset;

        if (progress >= 1.0) {
            animation.is_animating = false;
        }
    }

    update_game_won(current_time: number): void {
        if (this.game_data.state === GameState.GAME_WON && this.game_data.game_won_time !== null) {
            if (current_time - this.game_data.game_won_time >= 1000) {
                this.reset();
            }
        }
    }

    update_particles(delta_time: number): void {
        this.particle_system.update(delta_time);
    }

    get_visible_rows(): RowData[] {
        return this.game_data.rows.filter(row => is_row_visible(row, this.game_data.scroll_offset));
    }

    get_game_over_indicator(): RectangleData | null {
        if (this.game_data.game_over_flash) {
            return this.game_data.game_over_flash.rectangle;
        }
        return null;
    }
}
