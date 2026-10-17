import { isRed, rankName } from './deck';
import { state } from './game';
import type { BestScore } from './scoring';
import { formatTime } from './timer';
import type { Card, PileType, Selection } from './types';

export interface RenderOptions {
    deal?: boolean;
    flipped?: string | null;
    invalid?: string | null;
}

export interface Hud {
    seconds: number;
    moves: number;
    score: number;
    best: BestScore | null;
    canUndo: boolean;
    canAutoComplete: boolean;
}

export interface WinSummary {
    score: number;
    bonus: number;
    seconds: number;
    moves: number;
    isNewBest: boolean;
    best: BestScore;
}

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
        'bg-white', 'cursor-grab', 'touch-none', 'hover:-translate-y-1', 'hover:shadow-xl',
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
        el.className =
            'pointer-events-none absolute inset-0 grid place-items-center text-3xl text-white/50';
        el.textContent = '↻';
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

export function render(selection: Selection | null, opts: RenderOptions = {}): void {
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

    const stock = slot('stock');
    stock.replaceChildren();
    const stockTop = state.stock.at(-1);
    if (stockTop) place(stock, stockTop, 'stock', 0, state.stock.length - 1);
    labelStock(stock);

    const waste = slot('waste');
    waste.replaceChildren();
    const wasteTop = state.waste.at(-1);
    if (wasteTop) place(waste, wasteTop, 'waste', 0, state.waste.length - 1);

    state.foundations.forEach((cards, i) => {
        const el = slot('foundation', i);
        el.replaceChildren();
        const top = cards.at(-1);
        if (top) place(el, top, 'foundation', i, cards.length - 1);
    });

    state.tableau.forEach((cards, i) => {
        const el = slot('tableau', i);
        el.replaceChildren();
        cards.forEach((card, index) =>
            place(el, card, 'tableau', i, index, `calc(var(--fan-step) * ${index})`),
        );
        el.style.height =
            cards.length > 1 ? `calc(var(--card-h) + var(--fan-step) * ${cards.length - 1})` : '';
    });

    if (!opts.deal) animateFrom(before);
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
    $('#auto-complete').classList.toggle('hidden', !hud.canAutoComplete);
}

function toggleWin(show: boolean): void {
    const win = $('#win');
    win.classList.toggle('hidden', !show);
    win.classList.toggle('grid', show);
}

export function showWin(s: WinSummary): void {
    $('#summary').textContent = `${formatTime(s.seconds)} · ${s.moves} movimientos`;
    $('#final-score').textContent = `${formatNumber(s.score)} puntos`;
    $('#bonus').textContent = s.bonus ? `incluye +${formatNumber(s.bonus)} de bono por tiempo` : '';

    const record = $('#record-message');
    record.textContent = s.isNewBest
        ? '🏆 ¡Nuevo récord!'
        : `Récord: ${formatNumber(s.best.score)} puntos`;
    record.className =
        'mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold ' +
        (s.isNewBest ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600');

    toggleWin(true);
}

export const hideWin = (): void => toggleWin(false);
