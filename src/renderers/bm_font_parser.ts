/**
 * BMFont character data structure
 */
export interface BMFontChar {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    page: number;
}

/**
 * BMFont common info structure
 */
export interface BMFontCommon {
    lineHeight: number;
    base: number;
    scaleW: number;
    scaleH: number;
    pages: number;
}

/**
 * BMFont info structure
 */
export interface BMFontInfo {
    face: string;
    size: number;
    bold: number;
    italic: number;
}

/**
 * Complete BMFont data structure
 */
export interface BMFontData {
    info: BMFontInfo;
    common: BMFontCommon;
    chars: Map<number, BMFontChar>;
    page_file: string;
}

/**
 * Parses a BMFont .fnt file (text format) and returns structured font data.
 * BMFont files contain character glyph information for bitmap font rendering.
 */
export function parse_bm_font(fnt_content: string): BMFontData {
    const lines = fnt_content.split('\n');

    let info: BMFontInfo = { face: '', size: 0, bold: 0, italic: 0 };
    let common: BMFontCommon = { lineHeight: 0, base: 0, scaleW: 0, scaleH: 0, pages: 0 };
    const chars = new Map<number, BMFontChar>();
    let page_file = '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('info ')) {
            info = parse_info_line(trimmed);
        } else if (trimmed.startsWith('common ')) {
            common = parse_common_line(trimmed);
        } else if (trimmed.startsWith('page ')) {
            page_file = parse_page_line(trimmed);
        } else if (trimmed.startsWith('char ')) {
            const char_data = parse_char_line(trimmed);
            chars.set(char_data.id, char_data);
        }
    }

    return { info, common, chars, page_file };
}

/**
 * Parses the info line from BMFont file
 * Example: info face="Sofia Sans Extra Condensed Semi" size=128 bold=0 italic=0
 */
function parse_info_line(line: string): BMFontInfo {
    return {
        face: extract_string_value(line, 'face'),
        size: extract_number_value(line, 'size'),
        bold: extract_number_value(line, 'bold'),
        italic: extract_number_value(line, 'italic'),
    };
}

/**
 * Parses the common line from BMFont file
 * Example: common lineHeight=128 base=99 scaleW=1024 scaleH=1024 pages=1
 */
function parse_common_line(line: string): BMFontCommon {
    return {
        lineHeight: extract_number_value(line, 'lineHeight'),
        base: extract_number_value(line, 'base'),
        scaleW: extract_number_value(line, 'scaleW'),
        scaleH: extract_number_value(line, 'scaleH'),
        pages: extract_number_value(line, 'pages'),
    };
}

/**
 * Parses the page line from BMFont file
 * Example: page id=0 file="SofiaSansExtraCondensed_0.png"
 */
function parse_page_line(line: string): string {
    return extract_string_value(line, 'file');
}

/**
 * Parses a char line from BMFont file
 * Example: char id=83   x=0     y=573   width=31    height=66    xoffset=2     yoffset=34    xadvance=35    page=0
 */
function parse_char_line(line: string): BMFontChar {
    return {
        id: extract_number_value(line, 'id'),
        x: extract_number_value(line, 'x'),
        y: extract_number_value(line, 'y'),
        width: extract_number_value(line, 'width'),
        height: extract_number_value(line, 'height'),
        xoffset: extract_number_value(line, 'xoffset'),
        yoffset: extract_number_value(line, 'yoffset'),
        xadvance: extract_number_value(line, 'xadvance'),
        page: extract_number_value(line, 'page'),
    };
}

/**
 * Extracts a string value enclosed in quotes from a BMFont line
 */
function extract_string_value(line: string, key: string): string {
    const pattern = new RegExp(`${key}="([^"]*)"`);
    const match = line.match(pattern);
    return match?.[1] ?? '';
}

/**
 * Extracts a numeric value from a BMFont line
 */
function extract_number_value(line: string, key: string): number {
    const pattern = new RegExp(`${key}=(-?\\d+)`);
    const match = line.match(pattern);
    return match?.[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Calculates the width of a text string using the font data
 * @param text The text to measure
 * @param font_data The parsed BMFont data
 * @param scale Optional scale factor (default 1.0)
 * @returns The total width of the text in pixels
 */
export function calculate_text_width(text: string, font_data: BMFontData, scale: number = 1.0): number {
    let width = 0;
    for (const char of text) {
        const char_code = char.charCodeAt(0);
        const char_info = font_data.chars.get(char_code);
        if (char_info) {
            width += char_info.xadvance * scale;
        }
    }
    return width;
}

/**
 * Calculates the scale needed to fit text within a target width
 * @param text The text to fit
 * @param font_data The parsed BMFont data
 * @param target_width The target width to fit
 * @returns The scale factor needed
 */
export function calculate_scale_for_width(text: string, font_data: BMFontData, target_width: number): number {
    const original_width = calculate_text_width(text, font_data, 1.0);
    if (original_width === 0) return 1.0;
    return target_width / original_width;
}
