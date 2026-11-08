/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    base: '/klondike-devcrafters/',
    plugins: [tailwindcss()],
    test: {
        coverage: {
            // The DOM-free game logic; render.ts, drag.ts and main.ts aren't unit tested
            include: ['src/game.ts', 'src/rules.ts', 'src/deck.ts', 'src/scoring.ts'],
            reporter: ['text', 'html'],
        },
    },
});
