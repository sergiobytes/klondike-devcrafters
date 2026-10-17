import {
    createElement, createIcons, Frown, Lightbulb, PartyPopper, RotateCcw, Shuffle, Spade, Trophy, Undo2, Zap,
} from 'lucide';

export { RotateCcw, Trophy };

// Swaps every <i data-lucide="…"> in the page for its SVG. Only the icons listed
// here (and the ones imported elsewhere) end up in the bundle
export function mountIcons(): void {
    createIcons({ icons: { Frown, Lightbulb, PartyPopper, RotateCcw, Shuffle, Spade, Trophy, Undo2, Zap } });
}

export const icon = (node: Parameters<typeof createElement>[0], className: string): SVGElement =>
    createElement(node, { class: `lucide ${className}`, 'aria-hidden': 'true' });
