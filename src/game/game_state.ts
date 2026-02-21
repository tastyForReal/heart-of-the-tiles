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
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
    row_count: DEFAULT_ROW_COUNT,
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
            this.game_data.state === GameState.GAME_OVER_OUT_OF_BOUNDS
        );
    }

    is_game_over(): boolean {
        return this.game_data.state === GameState.GAME_OVER_MISCLICKED || this.game_data.state === GameState.GAME_OVER_OUT_OF_BOUNDS;
    }

    update_scroll(delta_time: number): void {
        if (this.is_paused() || this.is_game_over()) {
            return;
        }

        const scroll_speed = SCREEN_CONFIG.SCROLL_SPEED;
        const scroll_delta = scroll_speed * delta_time;
        this.game_data.scroll_offset += scroll_delta;

        for (const row of this.game_data.rows) {
            row.y_position += scroll_delta;

            for (const rect of row.rectangles) {
                rect.y = row.y_position;
            }
        }

        this.update_active_row();
    }

    private update_active_row(): void {
        const current_active_row = this.get_active_row();
        if (current_active_row && current_active_row.row_type !== RowType.START) {
            if (current_active_row.y_position > SCREEN_CONFIG.HEIGHT) {
                this.trigger_game_over_out_of_bounds(current_active_row);
                return;
            }
        }

        const visible_incomplete_rows = this.game_data.rows.filter(row => {
            return !row.is_completed && is_row_visible(row);
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

    handle_slot_press(slot_index: number, screen_x: number, screen_y: number): boolean {
        if (this.is_game_over()) {
            return false;
        }

        const start_row = this.game_data.rows.find(r => r.row_type === RowType.START);

        if (this.game_data.state === GameState.PAUSED && start_row && !start_row.is_completed) {
            const start_rect = start_row.rectangles[0];
            if (point_in_rect(screen_x, screen_y, start_rect.x, start_rect.y, start_rect.width, start_rect.height)) {
                this.press_rectangle(start_rect, start_row);
                this.game_data.state = GameState.PLAYING;
                return true;
            }
            return false;
        }

        const active_row = this.get_active_row();
        if (!active_row) {
            return false;
        }

        const row_top = active_row.y_position;
        const row_bottom = active_row.y_position + active_row.height;

        const pressed_rect = active_row.rectangles.find(r => r.slot_index === slot_index);

        if (pressed_rect && !pressed_rect.is_pressed) {
            this.press_rectangle(pressed_rect, active_row);
            return true;
        } else if (!pressed_rect && screen_y >= row_top && screen_y <= row_bottom) {
            this.trigger_game_over_misclicked(slot_index, screen_x, screen_y, active_row);
            return false;
        }

        return false;
    }

    handle_keyboard_press(slot_index: number): boolean {
        if (this.is_game_over()) {
            return false;
        }

        const active_row = this.get_active_row();
        if (!active_row) {
            return false;
        }

        const row_bottom = active_row.y_position + active_row.height;
        const timing_zone = SCREEN_CONFIG.HEIGHT / 2;

        if (row_bottom < timing_zone) {
            return false;
        }

        const pressed_rect = active_row.rectangles.find(r => r.slot_index === slot_index);

        if (pressed_rect && !pressed_rect.is_pressed) {
            const screen_x = pressed_rect.x + pressed_rect.width / 2;
            const screen_y = pressed_rect.y + pressed_rect.height / 2;
            this.press_rectangle(pressed_rect, active_row);
            return true;
        } else if (!pressed_rect) {
            const column_width = SCREEN_CONFIG.WIDTH / 4;
            const screen_x = slot_index * column_width + column_width / 2;
            const screen_y = active_row.y_position + active_row.height / 2;
            this.trigger_game_over_misclicked(slot_index, screen_x, screen_y, active_row);
            return false;
        }

        return false;
    }

    private press_rectangle(rect: RectangleData, row: RowData): void {
        rect.is_pressed = true;
        rect.opacity = 0.25;

        this.particle_system.add_debris(rect.x, rect.y, rect.width, rect.height, 20);

        this.check_row_completion(row);
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

    private trigger_game_over_misclicked(slot_index: number, screen_x: number, screen_y: number, active_row: RowData): void {
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

    private calculate_reposition_offset(): number {
        const completed_height = this.game_data.total_completed_height;
        const active_row = this.get_active_row();

        if (!active_row) {
            return this.game_data.scroll_offset;
        }

        const active_row_height = active_row.height;
        const base_row_height = SCREEN_CONFIG.BASE_ROW_HEIGHT;

        const target_y = SCREEN_CONFIG.HEIGHT - completed_height - active_row_height - base_row_height;

        const current_y = active_row.y_position;
        const delta_y = target_y - current_y;

        return this.game_data.scroll_offset + delta_y;
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

        const eased_progress = 1 - Math.pow(1 - progress, 3);

        const new_offset = animation.start_offset + (animation.target_offset - animation.start_offset) * eased_progress;

        const delta_offset = new_offset - this.game_data.scroll_offset;
        this.game_data.scroll_offset = new_offset;

        for (const row of this.game_data.rows) {
            row.y_position += delta_offset;

            for (const rect of row.rectangles) {
                rect.y = row.y_position;
            }
        }

        if (progress >= 1.0) {
            animation.is_animating = false;
        }
    }

    update_particles(delta_time: number): void {
        this.particle_system.update(delta_time);
    }

    get_visible_rows(): RowData[] {
        return this.game_data.rows.filter(is_row_visible);
    }

    get_game_over_indicator(): RectangleData | null {
        if (this.game_data.game_over_flash) {
            return this.game_data.game_over_flash.rectangle;
        }
        return null;
    }
}
