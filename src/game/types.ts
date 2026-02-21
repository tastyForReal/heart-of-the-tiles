export const SCREEN_CONFIG = {
    WIDTH: 405,
    HEIGHT: 720,
    COLUMN_COUNT: 4,
    BASE_ROW_HEIGHT: 180,
    SCROLL_SPEED: 540,
    GRID_LINE_WIDTH: 1,
} as const;

export const COLORS = {
    BACKGROUND: "#FFFFFF",
    BLACK: "#000000",
    YELLOW_START: "#FFFF00",
    RED_GAME_OVER: "#FF0000",
    WHITE: "#FFFFFF",
} as const;

export enum RowType {
    SINGLE = "single",
    DOUBLE = "double",
    EMPTY = "empty",
    START = "start",
}

export interface RectangleData {
    slot_index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    opacity: number;
    is_pressed: boolean;
    is_game_over_indicator: boolean;
    flash_state: boolean;
}

export interface RowData {
    row_index: number;
    row_type: RowType;
    height_multiplier: number;
    y_position: number;
    height: number;
    rectangles: RectangleData[];
    is_completed: boolean;
    is_active: boolean;
}

export interface ParticleData {
    x: number;
    y: number;
    velocity_x: number;
    velocity_y: number;
    size: number;
    opacity: number;
    decay_rate: number;
    color: string;
}

export enum GameState {
    PAUSED = "paused",
    PLAYING = "playing",
    GAME_OVER_MISCLICKED = "game_over_misclicked",
    GAME_OVER_OUT_OF_BOUNDS = "game_over_out_of_bounds",
    FLASHING = "flashing",
}

export interface GameOverFlashState {
    rectangle: RectangleData;
    start_time: number;
    flash_count: number;
    is_flashing: boolean;
}

export interface GameOverAnimationState {
    start_time: number;
    duration: number;
    start_offset: number;
    target_offset: number;
    is_animating: boolean;
}

export interface GameData {
    state: GameState;
    rows: RowData[];
    particles: ParticleData[];
    total_completed_height: number;
    scroll_offset: number;
    game_over_flash: GameOverFlashState | null;
    game_over_animation: GameOverAnimationState | null;
    last_single_slot: number;
    last_double_slots: [number, number] | null;
    active_row_index: number;
    completed_rows_count: number;
}

export enum InputType {
    MOUSE_CLICK = "mouse_click",
    KEYBOARD = "keyboard",
}

export interface InputEvent {
    type: InputType;
    slot_index: number;
    screen_x: number;
    screen_y: number;
    timestamp: number;
}

export const KEY_SLOT_MAP: Record<string, number> = {
    d: 0,
    D: 0,
    f: 1,
    F: 1,
    j: 2,
    J: 2,
    k: 3,
    K: 3,
};
