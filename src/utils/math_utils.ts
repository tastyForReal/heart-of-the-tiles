import { Color } from '../graphics/color.js';
import { Point } from '../graphics/point.js';
import { Rectangle } from '../graphics/rectangle.js';
import { Vector2 } from '../graphics/vector2.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function random_int(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function random_float(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

export function lerp_vector2(start: Vector2, end: Vector2, t: number): Vector2 {
    return Vector2.lerp(start, end, t);
}

export function color_to_normalized(color: Color): [number, number, number, number] {
    return [color.r / 255, color.g / 255, color.b / 255, color.a / 255];
}

export function point_in_rect(
    point_x: number,
    point_y: number,
    rect_x: number,
    rect_y: number,
    rect_width: number,
    rect_height: number,
): boolean {
    return point_x >= rect_x && point_x <= rect_x + rect_width && point_y >= rect_y && point_y <= rect_y + rect_height;
}

export function point_in_rectangle(point: Point, rect: Rectangle): boolean {
    return rect.contains(point);
}

export function vector2_distance(v1: Vector2, v2: Vector2): number {
    return Vector2.distance(v1, v2);
}

export function ease_out_quad(t: number): number {
    return t * (2 - t);
}

export function ease_in_out_quad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function ease_in_quad(t: number): number {
    return t * t;
}

export function ease_out_cubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

export function ease_in_out_cubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(distance_squared(x1, y1, x2, y2));
}

export function distance_squared(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}

export function normalize_angle(angle: number): number {
    return ((angle % 360) + 360) % 360;
}

export function deg_to_rad(degrees: number): number {
    return degrees * DEG_TO_RAD;
}

export function rad_to_deg(radians: number): number {
    return radians * RAD_TO_DEG;
}
