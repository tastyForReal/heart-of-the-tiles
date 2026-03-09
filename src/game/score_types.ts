export interface ScoreAnimationState {
    current_scale: number;

    target_scale: number;

    start_time: number;

    duration: number;

    is_animating: boolean;
}

export interface BonusLabelAnimation {
    scale: number;

    opacity: number;

    start_time: number;

    scale_duration: number;

    fade_duration: number;

    is_complete: boolean;
}

export interface BonusLabel {
    x: number;

    base_y: number;

    text: string;

    animation: BonusLabelAnimation;
}

export interface ScoreData {
    total_score: number;

    animation: ScoreAnimationState;

    bonus_labels: BonusLabel[];

    override_display_text?: string;
}
