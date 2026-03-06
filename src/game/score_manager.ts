/**
 * Score Manager handles all scoring logic and animations.
 * Calculates points based on tile type and height, manages score animations,
 * and creates bonus labels for long tile completions.
 */

import { RowData, TileData, RowType } from './types.js';
import { ScoreData, ScoreAnimationState, BonusLabel } from './score_types.js';

/**
 * Default animation state for score counter.
 */
const DEFAULT_SCORE_ANIMATION: ScoreAnimationState = {
    current_scale: 1.0,
    target_scale: 1.0,
    start_time: 0,
    duration: 100,
    is_animating: false,
};

/**
 * Creates the initial score data structure.
 */
export function create_initial_score_data(): ScoreData {
    return {
        total_score: 0,
        animation: { ...DEFAULT_SCORE_ANIMATION },
        bonus_labels: [],
    };
}

/**
 * Calculates the score value for a tile based on its properties.
 *
 * Scoring rules:
 * - Empty tile: 0 points
 * - Single tile (height_multiplier == 1): 1 point
 * - Double tile (height_multiplier == 1): 2 points each
 * - Single/Double tile (height_multiplier > 1): formula based on progress
 *
 * @param tile The tile data to calculate score for
 * @param row The row containing the tile
 * @returns The calculated score value
 */
export function calculate_tile_score(tile: TileData, row: RowData): number {
    // Empty tiles have no score
    if (row.row_type === RowType.EMPTY) {
        return 0;
    }

    // For standard height tiles (height_multiplier == 1)
    if (row.height_multiplier === 1) {
        if (row.row_type === RowType.SINGLE || row.row_type === RowType.START) {
            return 1;
        }
        if (row.row_type === RowType.DOUBLE) {
            return 2;
        }
        return 0;
    }

    // For long tiles (height_multiplier > 1)
    // Formula: Math.floor((hold_progress / total_progress) * row_height_multiplier) + 1
    const hold_progress = tile.progress;
    const total_progress = tile.height;
    const row_height_multiplier = row.height_multiplier;

    // If the tile was released early, calculate partial score
    if (tile.is_released_early && hold_progress < total_progress) {
        return Math.floor((hold_progress / total_progress) * row_height_multiplier) + 1;
    }

    // Full completion of long tile
    return Math.floor((total_progress / total_progress) * row_height_multiplier) + 1;
}

/**
 * Triggers the score animation (scale up then down).
 * Called whenever the score changes.
 *
 * @param score_data The current score data to update
 * @param current_time Current timestamp in milliseconds
 */
export function trigger_score_animation(score_data: ScoreData, current_time: number): void {
    score_data.animation = {
        current_scale: 1.0,
        target_scale: 1.08,
        start_time: current_time,
        duration: 100,
        is_animating: true,
    };
}

/**
 * Bonus label positioning configuration.
 * With anchor 0.5, 0.5, the position represents the center of the text.
 */
const BONUS_LABEL_POSITIONING = {
    /** Approximate height of the bonus label text (72px font) */
    TEXT_HEIGHT: 72,
    /** Half the text height for centered anchor positioning */
    HALF_TEXT_HEIGHT: 36,
    /** Gap between the tile's top edge and the center of the label text */
    GAP_ABOVE_TILE: 8,
};

/**
 * Creates a bonus label for a completed long tile.
 * Position is at the center of the tile's lane, with the label text above the tile.
 * With anchor 0.5, 0.5, the position represents the center point of the text.
 * The base_y stores the tile's Y position without scroll offset, so the label
 * can move with the tile at the same scroll speed.
 *
 * @param tile The completed tile
 * @param bonus_score The bonus score to display
 * @param current_time Current timestamp in milliseconds
 * @returns A new BonusLabel instance
 */
export function create_bonus_label(tile: TileData, bonus_score: number, current_time: number): BonusLabel {
    // Calculate center of the tile's lane
    const lane_center_x = tile.x + tile.width / 2;

    // Calculate base Y position: with anchor 0.5, 0.5, the position is the center of the text.
    // To place the label above the tile, we need the center of the text to be at:
    // tile_top - half_text_height - gap
    const label_base_y = tile.y - BONUS_LABEL_POSITIONING.HALF_TEXT_HEIGHT - BONUS_LABEL_POSITIONING.GAP_ABOVE_TILE;

    return {
        x: lane_center_x,
        base_y: label_base_y,
        text: `+${bonus_score}`,
        animation: {
            scale: 1.0,
            opacity: 1.0,
            start_time: current_time,
            scale_duration: 250, // 0.25 seconds for scale animation
            fade_duration: 500, // 0.5 seconds for fade animation
            is_complete: false,
        },
    };
}

/**
 * Updates the score animation state.
 * Handles the scale up/down effect for the score counter.
 *
 * @param score_data The score data to update
 * @param current_time Current timestamp in milliseconds
 */
export function update_score_animation(score_data: ScoreData, current_time: number): void {
    const anim = score_data.animation;
    if (!anim.is_animating) {
        return;
    }

    const elapsed = current_time - anim.start_time;

    if (elapsed < anim.duration) {
        // Scale up phase
        const progress = elapsed / anim.duration;
        anim.current_scale = 1.0 + 0.08 * progress;
    } else if (elapsed < anim.duration * 2) {
        // Scale down phase
        const progress = (elapsed - anim.duration) / anim.duration;
        anim.current_scale = 1.08 - 0.08 * progress;
    } else {
        // Animation complete
        anim.current_scale = 1.0;
        anim.is_animating = false;
    }
}

/**
 * Updates all bonus label animations.
 * Handles scale and fade effects, and removes completed labels.
 *
 * @param score_data The score data containing bonus labels
 * @param current_time Current timestamp in milliseconds
 */
export function update_bonus_label_animations(score_data: ScoreData, current_time: number): void {
    for (const label of score_data.bonus_labels) {
        const anim = label.animation;
        if (anim.is_complete) {
            continue;
        }

        const elapsed = current_time - anim.start_time;

        // Scale animation: 0-250ms scale up to 1.08, 250-500ms scale down to 1.0
        if (elapsed < anim.scale_duration) {
            // Scale up phase (0-250ms)
            const progress = elapsed / anim.scale_duration;
            anim.scale = 1.0 + 0.08 * progress;
        } else if (elapsed < anim.scale_duration * 2) {
            // Scale down phase (250-500ms)
            const progress = (elapsed - anim.scale_duration) / anim.scale_duration;
            anim.scale = 1.08 - 0.08 * progress;
        } else {
            anim.scale = 1.0;
        }

        // Fade animation: linearly decrease opacity over 500ms
        if (elapsed < anim.fade_duration) {
            anim.opacity = 1.0 - elapsed / anim.fade_duration;
        } else {
            anim.opacity = 0.0;
            anim.is_complete = true;
        }
    }

    // Remove completed labels
    score_data.bonus_labels = score_data.bonus_labels.filter(label => !label.animation.is_complete);
}

/**
 * Main ScoreManager class that encapsulates all scoring functionality.
 * Provides methods to add scores, trigger animations, and update state.
 */
export class ScoreManager {
    private score_data: ScoreData;

    constructor() {
        this.score_data = create_initial_score_data();
    }

    /**
     * Gets the current score data (read-only reference).
     */
    get_score_data(): Readonly<ScoreData> {
        return this.score_data;
    }

    /**
     * Gets the current total score.
     */
    get_total_score(): number {
        return this.score_data.total_score;
    }

    /**
     * Resets the score to initial state.
     */
    reset(): void {
        this.score_data = create_initial_score_data();
    }

    /**
     * Adds score from a completed tile.
     * Handles both regular and long tile scoring, and creates bonus labels for long tiles.
     *
     * @param tile The completed tile
     * @param row The row containing the tile
     * @param current_time Current timestamp in milliseconds
     * @returns The score added
     */
    add_tile_score(tile: TileData, row: RowData, current_time: number): number {
        const score = calculate_tile_score(tile, row);

        if (score > 0) {
            this.score_data.total_score += score;
            trigger_score_animation(this.score_data, current_time);

            // Create bonus label for long tiles (height_multiplier > 1)
            if (row.height_multiplier > 1 && !tile.is_released_early) {
                const bonus_label = create_bonus_label(tile, score, current_time);
                this.score_data.bonus_labels.push(bonus_label);
            }
        }

        return score;
    }

    /**
     * Updates all score-related animations.
     * Should be called once per frame.
     *
     * @param current_time Current timestamp in milliseconds
     */
    update(current_time: number): void {
        update_score_animation(this.score_data, current_time);
        update_bonus_label_animations(this.score_data, current_time);
    }

    /**
     * Checks if there are any active bonus labels.
     */
    has_active_bonus_labels(): boolean {
        return this.score_data.bonus_labels.length > 0;
    }
}
