import { isRed, rankName } from './deck';
import { state } from './game';
import type { Hint } from './game';
import { icon, RotateCcw, Trophy } from './icons';
import type { BestScore } from './scoring';
import { formatTime } from './timer';
import type { Card, PileType, Selection } from './types';

export interface RenderOptions {
    deal?: boolean;
    flipped?: string | null;
    invalid?: string | null;
    recycled?: boolean;
}

export interface Hud {
    seconds: number;
    moves: number;
    score: number;
    best: BestScore | null;
    canUndo: boolean;
    canAutoComplete: boolean;
    hintsLeft: number;
    canHint: boolean;
}

export interface WinSummary {
    score: number;
    bonus: number;
    seconds: number;
    moves: number;
    isNewBest: boolean;
    best: BestScore;
}

const RECYCLE_GHOSTS = 6; // cards shown flying back when the waste is turned over
const HINT_DURATION = 4000; // ms the hinted cards keep pulsing

let hintTimeout: ReturnType<typeof setTimeout> | undefined;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;

const slot = (type: PileType | 'stock', pile = 0) =>
    $(`[data-pile="${type}"][data-pile-index="${pile}"]`);

const formatNumber = (n: number): string => n.toLocaleString('es-ES');

function createCard(card: Card, index: number): HTMLElement {
    const el = document.createElement('div');
    el.className =
        'card absolute left-0 w-(--card-w) h-(--card-h) rounded-lg shadow-md ' +
        'select-none transition-[translate,box-shadow] duration-150';
    el.dataset.id = card.id;
    el.dataset.cardIndex = String(index);

    if (!card.faceUp) {
        el.classList.add('card-back', 'border-2', 'border-white', 'cursor-pointer');
        return el;
    }

    // touch-none: lets a finger drag the card instead of scrolling the page
    el.classList.add(
        'bg-white', 'border', 'border-black', 'cursor-grab', 'touch-none', 'hover:-translate-y-1', 'hover:shadow-xl',
        isRed(card) ? 'text-red-600' : 'text-slate-900',
    );
    el.innerHTML = `
    <span class="corner-text absolute left-1.5 top-1 text-center font-bold leading-none">
      ${rankName(card.rank)}<br>${card.suit}
    </span>
    <span class="center-text absolute inset-0 grid place-items-center">${card.suit}</span>`;
    return el;
}

// Cards left in the stock; once it's empty, a hint that clicking turns the waste over
function labelStock(stock: HTMLElement): void {
    const el = document.createElement('span');
    const left = state.stock.length;
    if (left) {
        el.className =
            'pointer-events-none absolute -bottom-2.5 left-1/2 z-10 min-w-6 -translate-x-1/2 ' +
            'rounded-full bg-slate-900/85 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums shadow';
        el.textContent = String(left);
        stock.title = `Quedan ${left} cartas en el mazo`;
    } else if (state.waste.length) {
        el.className = 'pointer-events-none absolute inset-0 grid place-items-center text-white/50';
        el.append(icon(RotateCcw, 'size-1/2'));
        stock.title = 'Volver a pasar el descarte al mazo';
    } else {
        stock.title = 'Mazo vacío';
    }
    stock.append(el);
}

function capturePositions(): Map<string, DOMRect> {
    const positions = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>('.card').forEach((el) => {
        positions.set(el.dataset.id!, el.getBoundingClientRect());
    });
    return positions;
}

function animateFrom(before: Map<string, DOMRect>): void {
    if (reducedMotion.matches) return;
    document.querySelectorAll<HTMLElement>('.card').forEach((el) => {
        const previous = before.get(el.dataset.id!);
        if (!previous) return;
        const current = el.getBoundingClientRect();
        const dx = previous.left - current.left;
        const dy = previous.top - current.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

        el.style.zIndex = '50'; // fly above the other cards
        const animation = el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
        animation.onfinish = () => (el.style.zIndex = '');
    });
}

// A loose two-sided copy of a card, outside the table, that only lives while it animates
function createGhost(card: Card, at: DOMRect): HTMLElement {
    const ghost = document.createElement('div');
    ghost.className = 'ghost pointer-events-none fixed';
    Object.assign(ghost.style, {
        left: `${at.left}px`, top: `${at.top}px`,
        width: `${at.width}px`, height: `${at.height}px`,
        transformStyle: 'preserve-3d',
    });

    const front = createCard({ ...card, faceUp: true }, 0);
    const back = createCard({ ...card, faceUp: false }, 0);
    back.style.transform = 'rotateY(180deg)';
    for (const face of [front, back]) {
        face.classList.remove('card'); // keep it out of the FLIP bookkeeping and dragging
        face.style.backfaceVisibility = 'hidden';
    }
    ghost.append(front, back);
    return ghost;
}

// Turning the waste over: its top cards fly back one after another, flipping face down
function animateRecycle(stock: HTMLElement): void {
    if (reducedMotion.matches) return;
    const from = slot('waste').getBoundingClientRect();
    const to = stock.getBoundingClientRect();
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const arc = Math.min(28, Math.hypot(dx, dy) * 0.25); // lift the cards a bit mid-flight

    // The stock fills up when the first card lands
    const landed = Array.from(stock.children) as HTMLElement[];
    landed.forEach((el) => (el.style.visibility = 'hidden'));

    // The stock is the old waste upside down, so the old top cards are now at its start
    state.stock.slice(0, RECYCLE_GHOSTS).forEach((card, i) => {
        const ghost = createGhost(card, from);
        ghost.style.zIndex = String(60 - i); // the old top card starts above the rest
        document.body.append(ghost);

        const animation = ghost.animate(
            [
                { transform: 'perspective(800px) translate(0, 0) rotateY(0deg) scale(1)' },
                {
                    transform: `perspective(800px) translate(${dx / 2}px, ${dy / 2 - arc}px) rotateY(-90deg) scale(1.08)`,
                    offset: 0.5,
                },
                { transform: `perspective(800px) translate(${dx}px, ${dy}px) rotateY(-180deg) scale(1)` },
            ],
            { duration: 380, delay: i * 45, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        );
        animation.onfinish = () => {
            if (i === 0) landed.forEach((el) => (el.style.visibility = ''));
            ghost.remove();
        };
    });
}

export function render(selection: Selection | null, opts: RenderOptions = {}): void {
    if (opts.deal) document.querySelectorAll('.ghost').forEach((el) => el.remove());
    clearHint();
    const before = capturePositions();
    let order = 0;

    const place = (
        container: HTMLElement, card: Card,
        type: PileType | 'stock', pile: number, index: number, top = '0px',
    ) => {
        const el = createCard(card, index);
        el.style.top = top;
        if (selection?.type === type && selection.pile === pile && index >= selection.index) {
            el.classList.add('ring-4', 'ring-amber-300', '-translate-y-1');
        }
        if (opts.deal) {
            el.classList.add('motion-safe:animate-deal');
            el.style.animationDelay = `${order++ * 30}ms`;
        }
        if (card.id === opts.flipped) el.classList.add('motion-safe:animate-flip');
        if (card.id === opts.invalid) el.classList.add('motion-safe:animate-shake');
        container.append(el);
    };

    // Stacked piles show their top card plus the one beneath it, so the pile
    // doesn't look empty while the top card is being dragged away
    const placeTop = (el: HTMLElement, cards: Card[], type: PileType | 'stock', pile = 0) => {
        el.replaceChildren();
        const top = cards.slice(-2);
        top.forEach((card, k) => place(el, card, type, pile, cards.length - top.length + k));
    };

    const stock = slot('stock');
    placeTop(stock, state.stock, 'stock');
    labelStock(stock);

    placeTop(slot('waste'), state.waste, 'waste');

    state.foundations.forEach((cards, i) => placeTop(slot('foundation', i), cards, 'foundation', i));

    state.tableau.forEach((cards, i) => {
        const el = slot('tableau', i);
        el.replaceChildren();
        cards.forEach((card, index) =>
            place(el, card, 'tableau', i, index, `calc(var(--fan-step) * ${index})`),
        );
        el.style.height =
            cards.length > 1 ? `calc(var(--card-h) + var(--fan-step) * ${cards.length - 1})` : '';
    });

    // Nothing else moves when the waste is turned over, so skip the regular FLIP
    if (opts.recycled) animateRecycle(stock);
    else if (!opts.deal) animateFrom(before);
}

export function updateHud(hud: Hud): void {
    $('#time').textContent = formatTime(hud.seconds);
    $('#moves').textContent = String(hud.moves);
    $('#score').textContent = formatNumber(hud.score);
    $('#best').textContent = hud.best ? formatNumber(hud.best.score) : '—';
    $('#best-box').title = hud.best
        ? `${formatTime(hud.best.seconds)} · ${hud.best.moves} movimientos`
        : 'Aún no hay récord';
    $<HTMLButtonElement>('#undo').disabled = !hud.canUndo;
    $('#auto-complete').hidden = !hud.canAutoComplete;

    const hint = $<HTMLButtonElement>('#hint');
    hint.disabled = !hud.canHint;
    if (!hud.hintsLeft) hint.title = 'Ya no te quedan pistas en esta partida';
    else hint.title = hud.hintsLeft === 1 ? 'Pista (H) · te queda 1' : `Pista (H) · te quedan ${hud.hintsLeft}`;
    $('#hints-left').textContent = String(hud.hintsLeft);
}

export function clearHint(): void {
    clearTimeout(hintTimeout);
    document.querySelectorAll('.hint').forEach((el) => el.classList.remove('hint'));
}

// Makes the suggested cards and the spot where they go pulse for a few seconds
export function showHint(hint: Hint): void {
    clearHint();
    if (hint.kind === 'draw') {
        slot('stock').classList.add('hint');
    } else {
        const cards = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('.card'));
        cards(slot(hint.from.type, hint.from.pile))
            .filter((el) => Number(el.dataset.cardIndex) >= hint.from.index)
            .forEach((el) => el.classList.add('hint'));
        const target = slot(hint.to, hint.pile);
        (cards(target).at(-1) ?? target).classList.add('hint');
    }
    hintTimeout = setTimeout(clearHint, HINT_DURATION);
}

function toggleDialog(id: string, show: boolean): void {
    const dialog = $(id);
    dialog.classList.toggle('hidden', !show);
    dialog.classList.toggle('grid', show);
}

export function showWin(s: WinSummary): void {
    $('#summary').textContent = `${formatTime(s.seconds)} · ${s.moves} movimientos`;
    $('#final-score').textContent = `${formatNumber(s.score)} puntos`;
    $('#bonus').textContent = s.bonus ? `incluye +${formatNumber(s.bonus)} de bono por tiempo` : '';

    const record = $('#record-message');
    record.replaceChildren(
        icon(Trophy, 'size-4'),
        s.isNewBest ? '¡Nuevo récord!' : `Récord: ${formatNumber(s.best.score)} puntos`,
    );
    record.className =
        'mt-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ' +
        (s.isNewBest ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600');

    toggleDialog('#win', true);
}

export const hideWin = (): void => toggleDialog('#win', false);

export function showStuck(canUndo: boolean): void {
    $('#stuck-undo').hidden = !canUndo;
    toggleDialog('#stuck', true);
}

export const hideStuck = (): void => toggleDialog('#stuck', false);
