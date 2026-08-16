import { SALOONS } from '../config/saloons.js';

function formatCash(amount) {
  return `$${amount.toLocaleString()}`;
}

export class SaloonMenu {
  #container;
  #onSelect;

  constructor({ container, onSelect }) {
    this.#container = container;
    this.#onSelect = onSelect;
  }

  open({ bankroll, selectedSaloonId }) {
    if (!this.#container) return;

    this.#container.innerHTML = `
      <section class="saloon-menu" role="dialog" aria-modal="true" aria-labelledby="saloon-menu-title">
        <header class="saloon-menu__header">
          <span class="saloon-menu__eyebrow">Ultimate Texas Hold'em</span>
          <h1 id="saloon-menu-title">Choose Your Saloon</h1>
          <p>Travel from friendly low-stakes tables to the Black Diamond. Choose an opening Ante to sit down.</p>
          <strong class="saloon-menu__bankroll">Bankroll ${formatCash(bankroll)}</strong>
        </header>
        <div class="saloon-map">
          ${SALOONS.map((saloon, index) => this.#renderSaloon(saloon, index, bankroll, selectedSaloonId)).join('')}
        </div>
        <p class="saloon-menu__note">Your buy-in remains in your playable chip stack; entering a saloon does not charge a fee.</p>
      </section>
    `;
    this.#container.classList.add('modal-overlay--visible', 'modal-overlay--saloon');
    this.#bindActions();
  }

  close() {
    if (!this.#container) return;
    this.#container.classList.remove('modal-overlay--visible', 'modal-overlay--saloon');
    this.#container.innerHTML = '';
  }

  #renderSaloon(saloon, index, bankroll, selectedSaloonId) {
    const isLocked = bankroll < saloon.minimumBankroll;
    const isSelected = saloon.id === selectedSaloonId;
    return `
      <article class="saloon-stop saloon-stop--${saloon.accent} ${isLocked ? 'saloon-stop--locked' : ''} ${isSelected ? 'saloon-stop--selected' : ''}">
        <div class="saloon-stop__route" aria-hidden="true">${index + 1}</div>
        <div class="saloon-stop__copy">
          <span class="saloon-stop__room">${saloon.room}</span>
          <h2>${saloon.name}</h2>
          <p>${saloon.description}</p>
          <span class="saloon-stop__requirement">Minimum buy-in ${formatCash(saloon.minimumBankroll)}</span>
        </div>
        <div class="saloon-stop__bets" aria-label="${saloon.name} quick Ante bets">
          ${isLocked
            ? '<span class="saloon-stop__locked-label">Locked</span>'
            : saloon.quickBets.map(amount => `
                <button type="button" data-saloon-id="${saloon.id}" data-saloon-bet="${amount}">
                  <span>Ante</span>
                  <strong>${formatCash(amount)}</strong>
                </button>
              `).join('')}
        </div>
      </article>
    `;
  }

  #bindActions() {
    this.#container.querySelectorAll('[data-saloon-id][data-saloon-bet]').forEach(button => {
      button.addEventListener('click', () => {
        const saloon = SALOONS.find(entry => entry.id === button.dataset.saloonId);
        const ante = Number.parseInt(button.dataset.saloonBet, 10);
        if (!saloon || !Number.isFinite(ante)) return;

        this.close();
        this.#onSelect?.({ saloon, ante });
      });
    });
  }
}
