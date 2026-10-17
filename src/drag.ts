import type { PileType, Selection } from './types';

export interface DropTarget {
    type: PileType;
    pile: number;
}

export interface DragOptions {
    canDrag: (from: Selection) => boolean;
    isValidTarget: (from: Selection, type: PileType, pile: number) => boolean;
    onDrop: (from: Selection, target: DropTarget | null) => void;
}

interface Drag {
    from: Selection;
    pointerId: number;
    startX: number;
    startY: number;
    cards: HTMLElement[];        // the grabbed card plus every card on top of it
    active: boolean;             // false until the pointer travels past THRESHOLD
    target: HTMLElement | null;  // highlighted slot where the cards would land
}

const THRESHOLD = 6; // px the pointer must travel before a press becomes a drag

function overlap(a: DOMRect, b: DOMRect): number {
    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return width > 0 && height > 0 ? width * height : 0;
}

// Pointer events cover mouse, touch and pen with the same code
export function enableDrag(table: HTMLElement, opts: DragOptions): void {
    let drag: Drag | null = null;
    let swallowClick = false;

    // Among the valid slots, the one the grabbed card covers the most
    const findTarget = (d: Drag): HTMLElement | null => {
        const card = d.cards[0].getBoundingClientRect();
        const slots = table.querySelectorAll<HTMLElement>('[data-pile="foundation"], [data-pile="tableau"]');
        let best: HTMLElement | null = null;
        let bestArea = 0;
        for (const slot of Array.from(slots)) {
            if (!opts.isValidTarget(d.from, slot.dataset.pile as PileType, Number(slot.dataset.pileIndex))) continue;
            const area = overlap(card, slot.getBoundingClientRect());
            if (area > bestArea) {
                best = slot;
                bestArea = area;
            }
        }
        return best;
    };

    const finish = (dropped: boolean): void => {
        const d = drag;
        drag = null;
        if (!d?.active) return;

        document.body.classList.remove('is-dragging');
        d.target?.classList.remove('drop-target');
        // The browser may still fire a click once the drag ends; ignore it
        swallowClick = true;
        setTimeout(() => (swallowClick = false));

        const target = dropped && d.target
            ? { type: d.target.dataset.pile as PileType, pile: Number(d.target.dataset.pileIndex) }
            : null;
        // onDrop re-renders while the cards are still where they were dropped,
        // so they animate from there to their final place
        opts.onDrop(d.from, target);
        d.cards.forEach((el) => {
            el.classList.remove('dragging');
            el.style.transform = '';
        });
    };

    table.addEventListener('pointerdown', (e) => {
        if (drag || !e.isPrimary || e.button !== 0) return;
        const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.card');
        const slot = cardEl?.closest<HTMLElement>('[data-pile]');
        if (!cardEl || !slot || slot.dataset.pile === 'stock') return;

        const from: Selection = {
            type: slot.dataset.pile as PileType,
            pile: Number(slot.dataset.pileIndex),
            index: Number(cardEl.dataset.cardIndex),
        };
        if (!opts.canDrag(from)) return;

        const cards = Array.from(slot.querySelectorAll<HTMLElement>('.card'))
            .filter((el) => Number(el.dataset.cardIndex) >= from.index);
        drag = { from, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, cards, active: false, target: null };
    });

    window.addEventListener('pointermove', (e) => {
        const d = drag;
        if (!d || e.pointerId !== d.pointerId) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;

        if (!d.active) {
            if (Math.hypot(dx, dy) < THRESHOLD) return;
            d.active = true;
            d.cards.forEach((el) => el.classList.add('dragging'));
            document.body.classList.add('is-dragging');
        }
        d.cards.forEach((el) => (el.style.transform = `translate(${dx}px, ${dy}px)`));

        const target = findTarget(d);
        if (target !== d.target) {
            d.target?.classList.remove('drop-target');
            target?.classList.add('drop-target');
            d.target = target;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (drag?.pointerId === e.pointerId) finish(true);
    });
    window.addEventListener('pointercancel', (e) => {
        if (drag?.pointerId === e.pointerId) finish(false);
    });
    document.addEventListener('click', (e) => {
        if (!swallowClick) return;
        swallowClick = false;
        e.stopPropagation();
    }, true);
}
