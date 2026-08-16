export function installGameManagerScoringMethods(GameManager, constants = {}) {
    const { FIRST_SOLVE_BONUS = 2, AI_REVEAL_VALID_WORD_PENALTY = 3 } = constants;

    class ScoringMethods {
        describeSteps(steps) {
            if (!steps || steps <= 0) return '0 steps';
            return `${steps} ${steps === 1 ? 'step' : 'steps'}`;
        }

        calculateSolvePoints(guessCount, isFirstSolver = false) {
            const normalizedGuessCount = Math.max(1, Math.min(6, parseInt(guessCount, 10) || 6));
            const efficiencyPoints = Math.max(1, this.wordLength + 2 - normalizedGuessCount);
            return efficiencyPoints + (isFirstSolver ? FIRST_SOLVE_BONUS : 0);
        }

        awardSolvePoints(player, guessCount) {
            if (!player || this.roundScoredPlayerIds.has(player.id)) return 0;

            const isFirstSolver = this.roundFirstSolverId === null;
            if (isFirstSolver) {
                this.roundFirstSolverId = player.id;
            }

            const points = this.calculateSolvePoints(guessCount, isFirstSolver);
            this.roundScoredPlayerIds.add(player.id);
            player.awardSolvePoints(
                points,
                isFirstSolver
                    ? `+${points} pts including first-solve bonus`
                    : `+${points} pts for solving this round`
            );
            return points;
        }

        getAIRevealPenaltyPoints() {
            const configured = parseInt(AI_REVEAL_VALID_WORD_PENALTY, 10);
            return Number.isFinite(configured) ? Math.max(1, configured) : 3;
        }

        applyPenaltyPoints(player, points, note = '') {
            if (!player) return 0;
            const penalty = Math.max(0, parseInt(points, 10) || 0);
            if (penalty <= 0) return 0;

            if (typeof player.applyPointDelta === 'function') {
                player.applyPointDelta(-penalty, note || `-${penalty} pts penalty`);
            } else {
                player.stats.points = (player.stats.points || 0) - penalty;
                if (player.lastRoundSummary) {
                    player.lastRoundSummary.text = note || `-${penalty} pts penalty`;
                }
                if (typeof player.updateUI === 'function') {
                    player.updateUI();
                }
            }
            return penalty;
        }

        escapeHTML(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        renderStatsGuessRows(player) {
            if (!Array.isArray(player?.guesses) || player.guesses.length === 0) {
                return '<div class="stats-empty-guesses">No guesses recorded in the final round.</div>';
            }

            return player.guesses.map(guess => {
                const letters = String(guess.word || '').split('');
                const result = Array.isArray(guess.result) ? guess.result : [];
                const tiles = letters.map((letter, index) =>
                    `<span class="stats-tile" data-state="${this.escapeHTML(result[index] || 'empty')}">${this.escapeHTML(letter)}</span>`
                ).join('');
                return `<div class="stats-guess-row">${tiles}</div>`;
            }).join('');
        }

        renderPlayerRoundRecap(player) {
            return `<article class="stats-recap-card">
            <div class="stats-recap-header">
                <div>
                    <h4>${this.escapeHTML(player.name)}</h4>
                    <p>${this.escapeHTML(player.lastRoundSummary?.title || player.roundNote || 'Round recap')}</p>
                </div>
                <span class="stats-recap-status" data-status="${this.escapeHTML(player.status)}">${this.escapeHTML(player.status)}</span>
            </div>
            <div class="stats-recap-grid">${this.renderStatsGuessRows(player)}</div>
        </article>`;
        }

        renderTeamSummary() {
            if (!this.teamModeEnabled) {
                return '';
            }

            const cards = Array.from({ length: this.teamCount }, (_, teamId) => {
                const teamName = this.getTeamName(teamId);
                const members = this.players.filter(player => player.teamId === teamId);
                const points = members.reduce((sum, player) => sum + (player.stats.points || 0), 0);
                const solved = members.reduce((sum, player) => sum + (player.stats.passed || 0), 0);
                return `<article class="stats-highlight">
                    <span>${this.escapeHTML(teamName)}</span>
                    <strong>${points} pts</strong>
                    <em>${solved} solves</em>
                </article>`;
            }).join('');

            return `<div class="stats-highlights stats-team-highlights">${cards}</div>`;
        }

        endGame(message) {
            if (this.gameEnded) return;
            this.gameEnded = true;
            this.roundTransitioning = false;
            clearInterval(this.timerInterval);
            this.updateRoundStatus(message);
            this.setViewState('stats');
            document.getElementById('players-wrapper').classList.add('hidden');
            document.getElementById('team-panel').classList.add('hidden');
            const statsScreen = document.getElementById('stats-screen');
            statsScreen.classList.remove('hidden');

            const rankedPlayers = [...this.players].sort((left, right) =>
                (right.stats.points - left.stats.points)
                || (right.stats.passed - left.stats.passed)
                || ((left.stats.bestSolveSteps ?? Infinity) - (right.stats.bestSolveSteps ?? Infinity))
                || left.name.localeCompare(right.name)
            );
            const leader = rankedPlayers[0];
            const leaderBest = leader && leader.stats.bestSolveSteps !== null
                ? this.describeSteps(leader.stats.bestSolveSteps)
                : '\u2014';
            const finalSolution = this.players.find(player => typeof player.solution === 'string' && player.solution.length === this.wordLength)?.solution || '';
            const recapCards = rankedPlayers.map(player => this.renderPlayerRoundRecap(player)).join('');
            const averageOf = player => player.stats.passed > 0
                ? (player.stats.totalSolveSteps / player.stats.passed).toFixed(1)
                : '\u2014';
            const reviewNote = this.latestSolvedWordReview?.word === finalSolution
                ? this.latestSolvedWordReview.note
                : '';

            let statsHTML = `<div class="result-banner"><p class="eyebrow">Match Complete</p><h3>${message}</h3><p>Rounds played: ${this.roundNumber}</p></div>
            <div class="stats-highlights">
                <div class="stats-highlight"><span>Leader</span><strong>${leader ? leader.name : '—'}</strong></div>
                <div class="stats-highlight"><span>Top Score</span><strong>${leader ? leader.stats.points : 0}</strong></div>
                <div class="stats-highlight"><span>Best Solve</span><strong>${leaderBest}</strong></div>
            </div>
            ${this.renderTeamSummary()}
            <div class="stats-recap-panel">
                <div class="stats-recap-intro">
                    <div>
                        <p class="eyebrow">Final Round</p>
                        <h3>Round recap</h3>
                        ${reviewNote ? `<p class="stats-review-note">${this.escapeHTML(reviewNote)}</p>` : ''}
                    </div>
                    <div class="stats-solution-chip">Solution <strong>${this.escapeHTML(finalSolution || 'Hidden')}</strong></div>
                </div>
                <div class="stats-recap-list">${recapCards}</div>
            </div>
            <table class="stats-table">
            <thead><tr><th>Player</th><th>Score</th><th>Solved</th><th>Best</th><th>Avg Steps</th><th>Failed</th><th>Skipped</th></tr></thead>
            <tbody>`;

            rankedPlayers.forEach(player => {
                statsHTML += `<tr><td>${player.name}</td><td>${player.stats.points}</td><td>${player.stats.passed}</td><td>${player.stats.bestSolveSteps === null ? '—' : this.describeSteps(player.stats.bestSolveSteps)}</td><td>${averageOf(player)}</td><td>${player.stats.failed}</td><td>${player.stats.skipped}</td></tr>`;
            });

            statsHTML += '</tbody></table>';
            document.getElementById('stats-content').innerHTML = statsHTML;
        }
    }

    Object.getOwnPropertyNames(ScoringMethods.prototype).forEach(name => {
        if (name === 'constructor') return;
        GameManager.prototype[name] = ScoringMethods.prototype[name];
    });
}
