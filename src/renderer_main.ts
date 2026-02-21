import { GameController } from "./game/game_controller.js";
import { SCREEN_CONFIG } from "./game/types.js";

async function main(): Promise<void> {
    const canvas = document.getElementById("game_canvas") as HTMLCanvasElement;

    if (!canvas) {
        console.error("Canvas element not found");
        return;
    }

    canvas.width = SCREEN_CONFIG.WIDTH;
    canvas.height = SCREEN_CONFIG.HEIGHT;

    const game_controller = new GameController();

    const initialized = await game_controller.initialize(canvas);

    if (!initialized) {
        console.error("Failed to initialize game");
        const error_div = document.getElementById("error_message");
        if (error_div) {
            error_div.style.display = "block";
            error_div.textContent = "WebGPU is not supported in this browser. Please use a WebGPU-compatible browser.";
        }
        return;
    }

    window.addEventListener("resize", () => {
        game_controller.resize(SCREEN_CONFIG.WIDTH, SCREEN_CONFIG.HEIGHT);
    });

    document.addEventListener("keydown", (event: KeyboardEvent) => {
        if (["d", "D", "f", "F", "j", "J", "k", "K"].includes(event.key)) {
            game_controller.set_keyboard_input();
        }
    });

    game_controller.start();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
} else {
    main();
}
