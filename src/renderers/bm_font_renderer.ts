import { GPUContext } from "./gpu_context.js";
import { BMFontData, parse_bm_font, calculate_scale_for_width, calculate_text_width } from "./bm_font_parser.js";
import { SCREEN_CONFIG } from "../game/types.js";

interface TextVertex {
    position: [number, number];
    tex_coord: [number, number];
    color: [number, number, number, number];
}

/**
 * Manages BMFont text rendering using WebGPU.
 * Loads font texture atlas and renders text as textured quads.
 */
export class BMFontRenderer {
    private gpu_context: GPUContext;
    private font_data: BMFontData | null = null;
    private font_texture: GPUTexture | null = null;
    private font_sampler: GPUSampler | null = null;
    private text_pipeline: GPURenderPipeline | null = null;
    private vertex_buffer: GPUBuffer | null = null;
    private uniform_buffer: GPUBuffer | null = null;
    private bind_group: GPUBindGroup | null = null;
    private bind_group_layout: GPUBindGroupLayout | null = null;
    private font_loaded: boolean = false;

    constructor(gpu_context: GPUContext) {
        this.gpu_context = gpu_context;
    }

    /**
     * Loads the BMFont file and texture atlas.
     * The texture file path is read from the .fnt file's page entry.
     * @param font_url Path to the .fnt file
     */
    async initialize(font_url: string): Promise<boolean> {
        const device = this.gpu_context.get_device();
        if (!device) {
            return false;
        }

        try {
            // Load the .fnt file
            const font_response = await fetch(font_url);
            if (!font_response.ok) {
                console.error(`Failed to load font file: ${font_url}`);
                return false;
            }
            const font_content = await font_response.text();
            this.font_data = parse_bm_font(font_content);

            // Get the texture file path from the .fnt file's page entry
            const texture_filename = this.font_data.page_file;
            if (!texture_filename) {
                console.error("No texture file specified in .fnt file");
                return false;
            }

            // Construct the texture URL from the font URL's directory
            const font_url_parts = font_url.split("/");
            font_url_parts.pop(); // Remove the .fnt filename
            const texture_url = font_url_parts.length > 0
                ? `${font_url_parts.join("/")}/${texture_filename}`
                : texture_filename;

            // Load the texture atlas
            const texture_response = await fetch(texture_url);
            if (!texture_response.ok) {
                console.error(`Failed to load font texture: ${texture_url}`);
                return false;
            }
            const texture_blob = await texture_response.blob();
            const texture_bitmap = await createImageBitmap(texture_blob);

            // Create GPU texture
            this.font_texture = device.createTexture({
                size: { width: texture_bitmap.width, height: texture_bitmap.height },
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            });

            device.queue.copyExternalImageToTexture(
                { source: texture_bitmap },
                { texture: this.font_texture },
                { width: texture_bitmap.width, height: texture_bitmap.height },
            );

            // Create sampler
            this.font_sampler = device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
            });

            // Create the render pipeline
            const pipeline_created = this.create_pipeline();
            if (!pipeline_created) {
                return false;
            }

            this.font_loaded = true;
            return true;
        } catch (error) {
            console.error("Failed to initialize BMFontRenderer:", error);
            return false;
        }
    }

    /**
     * Creates the WebGPU render pipeline for text rendering
     */
    private create_pipeline(): boolean {
        const device = this.gpu_context.get_device();
        const format = this.gpu_context.get_format();

        if (!device || !format || !this.font_texture || !this.font_sampler) {
            return false;
        }

        const text_shader = device.createShaderModule({
            code: `
                struct Uniforms {
                    screen_width: f32,
                    screen_height: f32,
                }

                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                @group(0) @binding(1) var font_texture: texture_2d<f32>;
                @group(0) @binding(2) var font_sampler: sampler;

                struct VertexInput {
                    @location(0) position: vec2<f32>,
                    @location(1) tex_coord: vec2<f32>,
                    @location(2) color: vec4<f32>,
                }

                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) tex_coord: vec2<f32>,
                    @location(1) color: vec4<f32>,
                }

                @vertex
                fn vertex_main(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;
                    let x = (input.position.x / uniforms.screen_width) * 2.0 - 1.0;
                    let y = 1.0 - (input.position.y / uniforms.screen_height) * 2.0;
                    output.position = vec4<f32>(x, y, 0.0, 1.0);
                    output.tex_coord = input.tex_coord;
                    output.color = input.color;
                    return output;
                }

                @fragment
                fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
                    let tex_color = textureSample(font_texture, font_sampler, input.tex_coord);
                    return vec4<f32>(input.color.rgb, tex_color.r * input.color.a);
                }
            `,
        });

        // Create bind group layout
        this.bind_group_layout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" },
                },
            ],
        });

        // Create uniform buffer
        this.uniform_buffer = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.uniform_buffer, 0, new Float32Array([SCREEN_CONFIG.WIDTH, SCREEN_CONFIG.HEIGHT]));

        // Create bind group
        this.bind_group = device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [
                { binding: 0, resource: { buffer: this.uniform_buffer } },
                { binding: 1, resource: this.font_texture.createView() },
                { binding: 2, resource: this.font_sampler },
            ],
        });

        const pipeline_layout = device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout],
        });

        this.text_pipeline = device.createRenderPipeline({
            layout: pipeline_layout,
            vertex: {
                module: text_shader,
                entryPoint: "vertex_main",
                buffers: [
                    {
                        arrayStride: 32, // 2 + 2 + 4 floats = 8 * 4 = 32 bytes
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x2", // position
                            },
                            {
                                shaderLocation: 1,
                                offset: 8,
                                format: "float32x2", // tex_coord
                            },
                            {
                                shaderLocation: 2,
                                offset: 16,
                                format: "float32x4", // color
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: text_shader,
                entryPoint: "fragment_main",
                targets: [
                    {
                        format: format,
                        blend: {
                            color: {
                                srcFactor: "src-alpha",
                                dstFactor: "one-minus-src-alpha",
                                operation: "add",
                            },
                            alpha: {
                                srcFactor: "one",
                                dstFactor: "one-minus-src-alpha",
                                operation: "add",
                            },
                        },
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
            },
        });

        return true;
    }

    /**
     * Checks if the font has been successfully loaded
     */
    is_loaded(): boolean {
        return this.font_loaded;
    }

    /**
     * Renders text at the specified position with the given parameters
     */
    render_text(
        text: string,
        x: number,
        y: number,
        scale: number,
        color: [number, number, number, number],
        scroll_offset: number,
        render_pass: GPURenderPassEncoder,
    ): void {
        if (!this.font_data || !this.text_pipeline || !this.bind_group || !this.vertex_buffer) {
            return;
        }

        const vertices = this.create_text_vertices(text, x, y, scale, color, scroll_offset);
        if (vertices.length === 0) {
            return;
        }

        const device = this.gpu_context.get_device();
        if (!device) {
            return;
        }

        // Flatten vertices
        const vertex_data = new Float32Array(vertices.length * 8);
        for (let i = 0; i < vertices.length; i++) {
            const vertex = vertices[i];
            if (!vertex) continue;
            const offset = i * 8;
            vertex_data[offset] = vertex.position[0] ?? 0;
            vertex_data[offset + 1] = vertex.position[1] ?? 0;
            vertex_data[offset + 2] = vertex.tex_coord[0] ?? 0;
            vertex_data[offset + 3] = vertex.tex_coord[1] ?? 0;
            vertex_data[offset + 4] = vertex.color[0] ?? 0;
            vertex_data[offset + 5] = vertex.color[1] ?? 0;
            vertex_data[offset + 6] = vertex.color[2] ?? 0;
            vertex_data[offset + 7] = vertex.color[3] ?? 0;
        }

        // Update vertex buffer if needed
        const buffer_size = vertex_data.byteLength;
        if (!this.vertex_buffer || this.vertex_buffer.size < buffer_size) {
            this.vertex_buffer = device.createBuffer({
                size: Math.max(buffer_size, 1024 * 64), // At least 64KB
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        device.queue.writeBuffer(this.vertex_buffer, 0, vertex_data);

        render_pass.setPipeline(this.text_pipeline);
        render_pass.setBindGroup(0, this.bind_group);
        render_pass.setVertexBuffer(0, this.vertex_buffer);
        render_pass.draw(vertices.length);
    }

    /**
     * Creates vertex data for rendering text
     */
    private create_text_vertices(
        text: string,
        x: number,
        y: number,
        scale: number,
        color: [number, number, number, number],
        scroll_offset: number,
    ): TextVertex[] {
        if (!this.font_data) {
            return [];
        }

        const vertices: TextVertex[] = [];
        let cursor_x = x;
        const cursor_y = y + scroll_offset;

        const { scaleW, scaleH } = this.font_data.common;

        for (const char of text) {
            const char_code = char.charCodeAt(0);
            const char_info = this.font_data.chars.get(char_code);

            if (!char_info) {
                continue;
            }

            const char_x = cursor_x + char_info.xoffset * scale;
            const char_y = cursor_y + char_info.yoffset * scale;
            const char_width = char_info.width * scale;
            const char_height = char_info.height * scale;

            // Calculate UV coordinates
            const u0 = char_info.x / scaleW;
            const v0 = char_info.y / scaleH;
            const u1 = (char_info.x + char_info.width) / scaleW;
            const v1 = (char_info.y + char_info.height) / scaleH;

            // Create two triangles (6 vertices) for the character quad
            vertices.push(
                // Triangle 1
                { position: [char_x, char_y], tex_coord: [u0, v0], color },
                { position: [char_x + char_width, char_y], tex_coord: [u1, v0], color },
                { position: [char_x + char_width, char_y + char_height], tex_coord: [u1, v1], color },
                // Triangle 2
                { position: [char_x, char_y], tex_coord: [u0, v0], color },
                { position: [char_x + char_width, char_y + char_height], tex_coord: [u1, v1], color },
                { position: [char_x, char_y + char_height], tex_coord: [u0, v1], color },
            );

            cursor_x += char_info.xadvance * scale;
        }

        return vertices;
    }

    /**
     * Calculates the scale needed to fit text within a percentage of a tile's width
     */
    calculate_scale_for_tile(text: string, tile_width: number, width_percentage: number): number {
        if (!this.font_data) {
            return 1.0;
        }
        const target_width = tile_width * width_percentage;
        return calculate_scale_for_width(text, this.font_data, target_width);
    }

    /**
     * Ensures the vertex buffer is created
     */
    ensure_vertex_buffer(): void {
        if (!this.vertex_buffer) {
            const device = this.gpu_context.get_device();
            if (device) {
                this.vertex_buffer = device.createBuffer({
                    size: 1024 * 64, // 64KB initial size
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
            }
        }
    }

    /**
     * Calculates the width of text at a given scale
     */
    get_text_width(text: string, scale: number): number {
        if (!this.font_data) {
            return 0;
        }
        return calculate_text_width(text, this.font_data, scale);
    }
}
