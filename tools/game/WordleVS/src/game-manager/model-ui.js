import {
    CUSTOM_MODEL_VALUE,
    DEFAULT_AI_MODEL,
    DEFAULT_WORD_MODEL,
    OLLAMA_TAGS_PATH
} from '../shared.js';

const hasWordleServerProxy = !window.location.pathname.startsWith('/tools/');

export function installGameManagerModelUIMethods(GameManager) {
    class ModelUIMethods {
        getFallbackModelNames() {
            return [...new Set([
                DEFAULT_AI_MODEL,
                DEFAULT_WORD_MODEL,
                'llama3.2:3b',
                'mistral'
            ])];
        }

        getAvailableModelNames() {
            return Array.isArray(this.availableModelNames) && this.availableModelNames.length > 0
                ? this.availableModelNames
                : this.getFallbackModelNames();
        }

        toggleCustomModelInput(selectId, inputId) {
            const modelSelect = document.getElementById(selectId);
            const customModelInput = document.getElementById(inputId);
            this.toggleCustomModelElements(modelSelect, customModelInput);
        }

        toggleCustomModelElements(modelSelect, customModelInput) {
            if (!modelSelect || !customModelInput) return;
            customModelInput.classList.toggle('hidden', modelSelect.value !== CUSTOM_MODEL_VALUE);
        }

        getSelectedModel(selectId, inputId, defaultModel) {
            const modelSelect = document.getElementById(selectId);
            const customModelInput = document.getElementById(inputId);
            return this.getSelectedModelFromElements(modelSelect, customModelInput, defaultModel);
        }

        getSelectedModelFromElements(modelSelect, customModelInput, defaultModel) {
            if (!modelSelect) {
                return defaultModel;
            }
            if (modelSelect.value === CUSTOM_MODEL_VALUE) {
                return customModelInput && customModelInput.value.trim() ? customModelInput.value.trim() : defaultModel;
            }
            return modelSelect.value || defaultModel;
        }

        configureModelSelect(selectElement, customInputElement, previousModel, defaultModel) {
            if (!selectElement) return;

            const availableModels = this.getAvailableModelNames();
            selectElement.innerHTML = '';
            availableModels.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                selectElement.appendChild(option);
            });

            const customOption = document.createElement('option');
            customOption.value = CUSTOM_MODEL_VALUE;
            customOption.textContent = 'Custom...';
            selectElement.appendChild(customOption);

            if (availableModels.includes(previousModel)) {
                selectElement.value = previousModel;
            } else if (availableModels.includes(defaultModel)) {
                selectElement.value = defaultModel;
            } else {
                selectElement.value = availableModels[0];
            }

            if (!availableModels.includes(previousModel) && previousModel !== defaultModel) {
                selectElement.value = CUSTOM_MODEL_VALUE;
                if (customInputElement) {
                    customInputElement.value = previousModel;
                }
            }

            this.toggleCustomModelElements(selectElement, customInputElement);
        }

        getSelectedAIModels(aiCount = this.getSelectedAIPlayerCount()) {
            const selectedModels = [];
            for (let index = 0; index < aiCount; index++) {
                selectedModels.push(this.getSelectedModel(
                    `ai-model-${index}`,
                    `custom-ai-model-${index}`,
                    DEFAULT_AI_MODEL
                ));
            }
            return selectedModels;
        }

        buildAIPlayerNames(models) {
            const counts = new Map();
            return models.map(model => {
                const baseName = String(model || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;
                const seen = (counts.get(baseName) || 0) + 1;
                counts.set(baseName, seen);
                return seen === 1 ? baseName : `${baseName} ${seen}`;
            });
        }

        renderAIModelControls(previousModels = null) {
            const aiCount = this.getSelectedAIPlayerCount();
            const container = document.getElementById('ai-model-list');
            if (!container) return;

            const modelsToKeep = Array.isArray(previousModels) ? previousModels : this.getSelectedAIModels();
            container.innerHTML = '';

            for (let index = 0; index < aiCount; index++) {
                const entry = document.createElement('div');
                entry.className = 'ai-model-entry';

                const heading = document.createElement('div');
                heading.className = 'ai-model-entry-heading';
                heading.textContent = `AI ${index + 1}`;

                const controls = document.createElement('div');
                controls.className = 'ai-model-entry-controls';

                const select = document.createElement('select');
                select.id = `ai-model-${index}`;

                const customInput = document.createElement('input');
                customInput.type = 'text';
                customInput.id = `custom-ai-model-${index}`;
                customInput.className = 'hidden';
                customInput.placeholder = `Enter model for AI ${index + 1}`;

                this.configureModelSelect(
                    select,
                    customInput,
                    modelsToKeep[index] || DEFAULT_AI_MODEL,
                    DEFAULT_AI_MODEL
                );

                select.onchange = () => this.toggleCustomModelInput(select.id, customInput.id);

                controls.appendChild(select);
                controls.appendChild(customInput);
                entry.appendChild(heading);
                entry.appendChild(controls);
                container.appendChild(entry);
            }
        }

        async loadAvailableModels() {
            const wordModelSelect = document.getElementById('word-model');
            const wordCustomInput = document.getElementById('custom-word-model');
            const previousWordModel = this.getSelectedModel('word-model', 'custom-word-model', DEFAULT_WORD_MODEL);
            const previousAIModels = this.getSelectedAIModels();

            if (!hasWordleServerProxy) {
                this.availableModelNames = this.getFallbackModelNames();
                this.configureModelSelect(wordModelSelect, wordCustomInput, previousWordModel, DEFAULT_WORD_MODEL);
                this.toggleCustomModelInput('word-model', 'custom-word-model');
                this.renderAIModelControls(previousAIModels);
                return;
            }

            try {
                const response = await fetch(OLLAMA_TAGS_PATH);
                if (!response.ok) {
                    throw new Error(`Could not fetch models (${response.status})`);
                }

                const data = await response.json();
                const models = (data.models || [])
                    .map(model => model.name)
                    .filter(name => typeof name === 'string' && name.length > 0);

                if (models.length === 0) {
                    return;
                }

                this.availableModelNames = [...new Set(models)];
                this.configureModelSelect(wordModelSelect, wordCustomInput, previousWordModel, DEFAULT_WORD_MODEL);
            } catch (error) {
                console.warn('Could not load Ollama model list from /api/tags. Using defaults.', error);
            } finally {
                this.toggleCustomModelInput('word-model', 'custom-word-model');
                this.renderAIModelControls(previousAIModels);
            }
        }
    }

    Object.getOwnPropertyNames(ModelUIMethods.prototype).forEach(name => {
        if (name === 'constructor') return;
        GameManager.prototype[name] = ModelUIMethods.prototype[name];
    });
}
