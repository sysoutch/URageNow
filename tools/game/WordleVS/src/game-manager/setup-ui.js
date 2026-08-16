export function installGameManagerSetupMethods(GameManager) {
    class SetupUIMethods {
        getSetupStepKeys() {
            const steps = ['basics', 'engine'];
            if (this.getSelectedAIPlayerCount() > 0) {
                steps.push('ai');
            }
            steps.push('sources');
            return steps;
        }

        getSetupStepMeta(stepKey) {
            const meta = {
                basics: 'Players, mode, and board rules.',
                engine: 'Word generation model and candidate rules.',
                ai: 'Shared AI behavior and per-board models.',
                sources: 'Optional uploads, memory, and wordlist builder.'
            };
            return meta[stepKey] || 'Setup';
        }

        getSelectedModeLabel() {
            const input = document.getElementById('game-mode');
            if (!input) return 'Standard';
            return input.options[input.selectedIndex]?.text || 'Standard';
        }

        getSelectedPeekModeLabel() {
            const input = document.getElementById('peek-mode');
            if (!input) return 'Open letters';
            return input.options[input.selectedIndex]?.text || 'Open letters';
        }

        getSelectedAITacticLabel() {
            const input = document.getElementById('ai-tactic');
            if (!input) return 'Balanced';
            return input.options[input.selectedIndex]?.text || 'Balanced';
        }

        getSelectedAIBackendLabel() {
            const input = document.getElementById('ai-backend');
            if (!input) return 'LLM';
            return input.options[input.selectedIndex]?.text || 'LLM';
        }

        getSelectedAIWordKnowledgeLabel() {
            const input = document.getElementById('ai-word-knowledge');
            if (!input) return 'Sample seed';
            return input.options[input.selectedIndex]?.text || 'Sample seed';
        }

        getSelectedAIDecisionModeLabel() {
            const input = document.getElementById('ai-decision-mode');
            if (!input) return 'LLM-led';
            return input.options[input.selectedIndex]?.text || 'LLM-led';
        }

        getSelectedTeamModeLabel() {
            return this.isTeamModeEnabled() ? 'Teams enabled' : 'Free-for-all';
        }

        getSetupSourceSummary() {
            const uploadedEnabled = this.isUploadedWordsEnabled();
            const memoryEnabled = this.isLLMMemoryEnabled();
            if (uploadedEnabled && memoryEnabled) {
                return 'Reusable list + memory bank';
            }
            if (uploadedEnabled) {
                return 'Reusable word source';
            }
            if (memoryEnabled) {
                return 'Fresh LLM pool + memory bank';
            }
            return 'Fresh LLM pool';
        }

        updateSetupSidebarSummary() {
            const humanCount = this.getSelectedHumanPlayerCount();
            const aiCount = this.getSelectedAIPlayerCount();
            const language = this.getSelectedLanguage() || 'English';
            const wordLength = this.getSelectedWordLength();
            const rosterText = `${humanCount} human${humanCount === 1 ? '' : 's'} / ${aiCount} AI${aiCount === 1 ? '' : 's'}`;
            const modeText = `${this.getSelectedModeLabel()} · ${this.getSelectedPeekModeLabel()} · ${this.getSelectedTeamModeLabel()}`;
            const formatText = `${language} · ${wordLength} letters`;
            const aiText = aiCount <= 0
                ? 'No AI players'
                : `${aiCount} AI · ${this.getSelectedAIBackendLabel()} · ${this.getSelectedAITacticLabel()} · ${this.getSelectedAIWordKnowledgeLabel()}${this.getSelectedAIBackend() === 'llm' ? ` · ${this.getSelectedAIDecisionModeLabel()}` : ''}`;
            const sourceText = this.getSetupSourceSummary();

            const setText = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                }
            };

            setText('setup-summary-roster', rosterText);
            setText('setup-summary-mode', modeText);
            setText('setup-summary-format', formatText);
            setText('setup-summary-ai', aiText);
            setText('setup-summary-source', sourceText);
        }

        setSetupWizardStep(stepKey) {
            const visibleSteps = this.getSetupStepKeys();
            this.currentSetupStepKey = visibleSteps.includes(stepKey) ? stepKey : visibleSteps[0];
            this.updateSetupWizard();
        }

        stepSetupWizard(direction) {
            const visibleSteps = this.getSetupStepKeys();
            const currentIndex = Math.max(0, visibleSteps.indexOf(this.currentSetupStepKey));
            const nextIndex = Math.max(0, Math.min(visibleSteps.length - 1, currentIndex + direction));
            this.currentSetupStepKey = visibleSteps[nextIndex];
            this.updateSetupWizard();
        }

        setSetupSourcePanel(panelKey) {
            const nextPanel = ['upload', 'memory', 'builder'].includes(panelKey) ? panelKey : 'upload';
            this.currentSetupSourcePanel = nextPanel;
            document.querySelectorAll('.setup-source-tab').forEach(button => {
                button.classList.toggle('is-active', button.dataset.sourcePanel === nextPanel);
            });
            document.querySelectorAll('.setup-source-panel').forEach(panel => {
                panel.classList.toggle('hidden', panel.id !== `setup-source-${nextPanel}`);
                panel.classList.toggle('is-active', panel.id === `setup-source-${nextPanel}`);
            });
        }

        updateSetupWizard() {
            const visibleSteps = this.getSetupStepKeys();
            if (!visibleSteps.includes(this.currentSetupStepKey)) {
                this.currentSetupStepKey = visibleSteps[0];
            }

            const stepIndex = visibleSteps.indexOf(this.currentSetupStepKey);
            document.querySelectorAll('.setup-step').forEach(panel => {
                const isActive = panel.dataset.stepKey === this.currentSetupStepKey;
                panel.classList.toggle('hidden', !isActive);
                panel.classList.toggle('is-active', isActive);
                if (panel.tagName === 'DETAILS') {
                    panel.open = isActive;
                }
            });

            document.querySelectorAll('.setup-wizard-tab').forEach(button => {
                const stepKey = button.dataset.stepKey || '';
                const enabled = visibleSteps.includes(stepKey);
                const isActive = stepKey === this.currentSetupStepKey;
                button.classList.toggle('is-active', isActive);
                button.classList.toggle('hidden', !enabled);
                button.setAttribute('aria-selected', String(isActive));
            });

            const stepCountElement = document.getElementById('setup-step-count');
            if (stepCountElement) {
                stepCountElement.innerHTML = `<span>${stepIndex + 1}</span> Step ${stepIndex + 1} of ${visibleSteps.length}`;
            }

            const stepHintElement = document.getElementById('setup-step-hint');
            if (stepHintElement) {
                const hintLabel = this.getSetupStepMeta(this.currentSetupStepKey);
                stepHintElement.innerHTML = `<span>${stepIndex + 1}</span> ${hintLabel}`;
            }

            const summaryLine = document.getElementById('setup-summary-line');
            if (summaryLine) {
                summaryLine.textContent = this.getSetupStepMeta(this.currentSetupStepKey);
            }
            const sidebarTitle = document.getElementById('setup-sidebar-step-title');
            if (sidebarTitle) {
                sidebarTitle.textContent = this.getSetupStepMeta(this.currentSetupStepKey);
            }
            const sidebarCopy = document.getElementById('setup-sidebar-step-copy');
            if (sidebarCopy) {
                sidebarCopy.textContent = stepIndex >= visibleSteps.length - 1
                    ? 'Review the source and memory settings, then launch the match.'
                    : 'Tune this section, then use Next to keep moving without losing your place.';
            }

            const prevButton = document.getElementById('setup-prev');
            const nextButton = document.getElementById('setup-next');
            if (prevButton) {
                prevButton.disabled = stepIndex <= 0;
            }
            if (nextButton) {
                nextButton.disabled = stepIndex >= visibleSteps.length - 1;
            }

            this.setSetupSourcePanel(this.currentSetupSourcePanel);
            this.updateSetupSidebarSummary();
        }

        updateAIOptionsVisibility() {
            const aiCount = this.getSelectedAIPlayerCount();
            const aiOptions = document.getElementById('ai-options');
            const aiBackend = this.getSelectedAIBackend();
            const aiModelGroup = document.getElementById('ai-model-group');
            const aiDecisionGroup = document.getElementById('ai-decision-group');
            aiOptions.classList.toggle('hidden', aiCount <= 0);
            aiOptions.open = aiCount > 0;
            if (aiModelGroup) {
                aiModelGroup.classList.toggle('hidden', aiBackend !== 'llm');
            }
            if (aiDecisionGroup) {
                aiDecisionGroup.classList.toggle('hidden', aiBackend !== 'llm');
            }
            this.renderAIModelControls();
            this.updateSetupWizard();
        }
    }

    Object.getOwnPropertyNames(SetupUIMethods.prototype).forEach(name => {
        if (name === 'constructor') return;
        GameManager.prototype[name] = SetupUIMethods.prototype[name];
    });
}
