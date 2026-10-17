import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    base: '/klondike-devcrafters/',
    plugins: [tailwindcss()],
});