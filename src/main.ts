import './style.css';
import { enableDrag } from './drag';
import {
  autoCompleteStep, canAutoComplete, canPick, canUndo, draw, findHint, getPile, hasWon,
  isStuck, isValidMove, move, newGame, sendToFoundation, state, undo,
} from './game';
import { mountIcons } from './icons';
import { hideStuck, hideWin, render, showHint, showStuck, showWin, updateHud } from './render';
import type { RenderOptions } from './render';
import { currentScore, loadBest, saveBest, winBonus } from './scoring';
import * as timer from './timer';
import type { PileType, Selection } from './types';

const AUTO_COMPLETE_DELAY = 110; // ms between cards while auto-completing
const DIALOG_DELAY = 400;        // let the last card land before showing a dialog
const HINTS_PER_GAME = 3;

let selection: Selection | null = null;
let best = loadBest();
let hintsLeft = HINTS_PER_GAME;
let autoCompleting = false;
let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
let pausedWhileHidden = false;

// While auto-completing, or once the game is won, the table ignores input
const isLocked = (): boolean => autoCompleting || hasWon();

function refreshHud(): void {
  const seconds = timer.elapsedSeconds();
  updateHud({
    seconds,
    moves: state.moves,
    score: currentScore(state.score, seconds),
    best,
    canUndo: canUndo() && !isLocked(),
    canAutoComplete: canAutoComplete() && !isLocked(),
    hintsLeft,
    canHint: hintsLeft > 0 && !isLocked(),
  });
}

function startGame(): void {
  clearTimeout(pendingTimeout);
  autoCompleting = false;
  pausedWhileHidden = false;
  selection = null;
  hintsLeft = HINTS_PER_GAME;
  newGame();
  timer.reset();
  hideWin();
  hideStuck();
  render(null, { deal: true });
  refreshHud();
}

// After every valid move: start the clock on the first one, redraw and check how the game stands
function afterMove(opts: RenderOptions = {}): void {
  selection = null;
  if (!timer.isRunning()) timer.start(refreshHud);
  render(null, opts);
  if (hasWon()) finishGame();
  else checkStuck();
  refreshHud();
}

// No useful move left: the game is over (the dialog still offers undo)
function checkStuck(): void {
  if (!isStuck()) return;
  timer.stop();
  const undoable = canUndo();
  pendingTimeout = setTimeout(() => showStuck(undoable), DIALOG_DELAY);
}

function finishGame(): void {
  timer.stop();
  const seconds = timer.elapsedSeconds();
  const bonus = winBonus(seconds);
  const score = currentScore(state.score, seconds) + bonus;

  const previous = loadBest() ?? best; // another tab may have set a new record meanwhile
  const record = previous && previous.score >= score
    ? previous
    : { score, seconds, moves: state.moves, date: new Date().toISOString() };
  const isNewBest = record !== previous;
  if (isNewBest) saveBest(record);
  best = record;

  const summary = { score, bonus, seconds, moves: state.moves, isNewBest, best: record };
  pendingTimeout = setTimeout(() => showWin(summary), DIALOG_DELAY);
}

function tryMove(from: Selection, type: PileType, pile: number): void {
  const r = move(from, type, pile);
  if (r.valid) afterMove({ flipped: r.flipped });
  else render(null, { invalid: getPile(from.type, from.pile)[from.index]?.id });
}

function clickPile(type: PileType, pile: number, index: number): void {
  const cards = getPile(type, pile);

  if (selection) {
    const from = selection;
    selection = null;
    const samePile = from.type === type && from.pile === pile;

    // Clicking the selected card again: try to send it to a foundation
    if (samePile && index === from.index && index === cards.length - 1) {
      const r = sendToFoundation(from);
      if (r.valid) afterMove({ flipped: r.flipped });
      else render(null);
      return;
    }
    if (samePile) {
      render(null);
      return;
    }

    tryMove(from, type, pile);
    return;
  }

  const from = { type, pile, index };
  if (!canPick(from)) return;
  selection = from;
  render(selection);
}

function undoMove(): void {
  if (isLocked() || !undo()) return;
  clearTimeout(pendingTimeout);
  hideStuck();
  selection = null;
  render(null);
  checkStuck();
  refreshHud();
}

function useHint(): void {
  if (isLocked() || hintsLeft === 0) return;
  const hint = findHint();
  if (!hint) return;
  hintsLeft--;
  selection = null;
  render(null);
  showHint(hint);
  refreshHud();
}

function autoComplete(): void {
  if (isLocked() || !canAutoComplete()) return;
  autoCompleting = true;

  const step = () => {
    const r = autoCompleteStep();
    if (!r.valid || hasWon()) autoCompleting = false;
    if (r.valid) afterMove({ flipped: r.flipped });
    else refreshHud();
    if (autoCompleting) pendingTimeout = setTimeout(step, AUTO_COMPLETE_DELAY);
  };
  step();
}

const table = document.querySelector<HTMLElement>('#table')!;

table.addEventListener('click', (e) => {
  if (isLocked()) return;
  const target = e.target as HTMLElement;
  const slotEl = target.closest<HTMLElement>('[data-pile]');
  if (!slotEl) return;

  if (slotEl.dataset.pile === 'stock') {
    const recycled = state.stock.length === 0; // drawing from an empty stock turns the waste over
    const r = draw();
    if (r.valid) {
      afterMove({ flipped: r.flipped, recycled });
    } else {
      selection = null;
      render(null);
    }
    return;
  }

  const cardEl = target.closest<HTMLElement>('.card');
  const index = cardEl ? Number(cardEl.dataset.cardIndex) : -1;
  clickPile(slotEl.dataset.pile as PileType, Number(slotEl.dataset.pileIndex), index);
});

enableDrag(table, {
  canDrag: (from) => !isLocked() && canPick(from),
  isValidTarget: isValidMove,
  onDrop: (from, target) => {
    selection = null;
    if (target && canPick(from)) tryMove(from, target.type, target.pile);
    else render(null); // dropped nowhere useful: the cards fly back
  },
});

document.querySelector('#undo')!.addEventListener('click', undoMove);
document.querySelector('#hint')!.addEventListener('click', useHint);
document.querySelector('#auto-complete')!.addEventListener('click', autoComplete);
document.querySelector('#new-game')!.addEventListener('click', startGame);
document.querySelector('#play-again')!.addEventListener('click', startGame);
document.querySelector('#stuck-undo')!.addEventListener('click', undoMove);
document.querySelector('#stuck-new')!.addEventListener('click', startGame);
document.querySelector('#stuck-close')!.addEventListener('click', hideStuck);

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'z') {
    e.preventDefault();
    undoMove();
  } else if (key === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    useHint();
  } else if (e.key === 'Escape') {
    hideStuck();
    if (selection) {
      selection = null;
      render(null);
    }
  }
});

// The clock doesn't run while the tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden && timer.isRunning()) {
    timer.stop();
    pausedWhileHidden = true;
  } else if (!document.hidden && pausedWhileHidden) {
    pausedWhileHidden = false;
    timer.start(refreshHud);
  }
});

mountIcons();
startGame();
