import {
    clearMemoryForModel,
    clampWordLength,
    clampWordPoolSize,
    clampWordlistTargetSize,
    createWordMask,
    DEFAULT_WORD_MODEL,
    DEFAULT_WORDLIST_TARGET_SIZE,
    extractOllamaText,
    generateWithOllama,
    getAlphabetKey,
    getGuessMemoryEntriesForModel,
    getMemoryWordsForModel,
    MAX_REJECTED_WORDS_PER_LANGUAGE,
    getReviewedRejectedWords,
    normalizeBucketKey,
    normalizeToWordLength,
    normalizeWordStyleOptions,
    rememberGuessMemoryForModel,
    rememberReviewedRejectedWord,
    rememberWordForModel,
    WORDLIST_BATCH_LIMIT,
    shuffleArray
} from '../shared.js';

export function installGameManagerWordSourceMethods(GameManager, constants = {}) {
    const { MEMORY_HINT_LIMIT = 24, ROUND_MEMORY_POOL_LIMIT = 80, MIN_WORD_POOL_SIZE = 20 } = constants;

    class WordSourceMethods {
        getLanguageLengthTag(language = this.getSelectedLanguage(), wordLength = this.getSelectedWordLength(), styleOptions = this.wordStyleOptions) {
            return `${this.getLanguageTag(language)}::len${clampWordLength(wordLength)}::${getAlphabetKey(styleOptions)}`;
        }

        isUploadedWordsEnabled() {
            return document.getElementById('use-uploaded-words').checked;
        }

        isLLMMemoryEnabled() {
            return document.getElementById('enable-llm-memory').checked;
        }

        updateWordFileStatus(message) {
            const element = document.getElementById('word-file-status');
            if (element) element.textContent = message;
        }

        updateWordlistStatus(message) {
            const element = document.getElementById('wordlist-status');
            if (element) element.textContent = message;
        }

        applyMatchPreset(preset) {
            const humanInput = document.getElementById('human-player-count');
            const aiInput = document.getElementById('ai-player-count');
            const modeInput = document.getElementById('game-mode');
            const peekInput = document.getElementById('peek-mode');
            if (!humanInput || !aiInput || !modeInput || !peekInput) return;

            if (preset === 'ai-vs-ai') {
                humanInput.value = '0';
                aiInput.value = '2';
                modeInput.value = 'standard';
                peekInput.value = 'open';
            } else {
                humanInput.value = '1';
                aiInput.value = '1';
                modeInput.value = 'standard';
                peekInput.value = 'open';
            }

            document.getElementById('timed-options').classList.add('hidden');
            document.getElementById('elimination-options').classList.add('hidden');
            this.peekMode = this.getSelectedPeekMode();
            document.body.dataset.peekMode = this.peekMode;
            this.currentSetupStepKey = 'basics';
            this.updateAIOptionsVisibility();
        }

        setWordlistDownloadEnabled(enabled) {
            const button = document.getElementById('download-wordlist');
            if (button) {
                button.disabled = !enabled;
            }
        }

        renderWordlistPreview(words) {
            const previewElement = document.getElementById('wordlist-preview');
            if (!previewElement) return;

            previewElement.innerHTML = '';
            if (!Array.isArray(words) || words.length === 0) {
                const emptyElement = document.createElement('div');
                emptyElement.className = 'empty-preview';
                emptyElement.textContent = 'Generated words will appear here.';
                previewElement.appendChild(emptyElement);
                this.setWordlistDownloadEnabled(false);
                return;
            }

            words.slice(0, 36).forEach(word => {
                const chip = document.createElement('span');
                chip.className = 'word-chip';
                chip.textContent = word;
                previewElement.appendChild(chip);
            });

            if (words.length > 36) {
                const moreChip = document.createElement('span');
                moreChip.className = 'word-chip';
                moreChip.textContent = `+${words.length - 36} more`;
                previewElement.appendChild(moreChip);
            }

            this.setWordlistDownloadEnabled(true);
        }

        refreshWordSourceState() {
            this.refreshWordFileStatus();
            const currentWords = this.getUploadedWordsForLanguage(
                this.getSelectedLanguage(),
                this.getSelectedWordLength(),
                this.getWordStyleOptions(true)
            );
            this.renderWordlistPreview(currentWords);
            if (currentWords.length > 0) {
                this.updateWordlistStatus(`Current reusable source contains ${currentWords.length} words for this selection.`);
            } else {
                this.updateWordlistStatus('No generated wordlist yet for the current selection.');
            }
        }

        refreshWordFileStatus() {
            const language = this.getSelectedLanguage();
            const wordLength = this.getSelectedWordLength();
            const styleOptions = this.getWordStyleOptions(true);
            const words = this.getUploadedWordsForLanguage(language, wordLength, styleOptions);
            if (words.length === 0) {
                this.updateWordFileStatus(`No reusable ${wordLength}-letter word source for ${language}.`);
                return;
            }
            const meta = this.getWordSourceMeta(language, wordLength, styleOptions);
            if (meta && meta.kind === 'file') {
                this.updateWordFileStatus(`Loaded ${words.length} ${wordLength}-letter words for ${language} from ${meta.label}.`);
                return;
            }
            if (meta && meta.kind === 'llm') {
                this.updateWordFileStatus(`Generated ${words.length} ${wordLength}-letter words for ${language} with ${meta.model}.`);
                return;
            }
            this.updateWordFileStatus(`Loaded ${words.length} reusable ${wordLength}-letter words for ${language}.`);
        }

        normalizeWordList(words, wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedLength = clampWordLength(wordLength);
            const normalized = [];
            const seen = new Set();
            words.forEach(raw => {
                const word = normalizeToWordLength(raw, normalizedLength, styleOptions);
                if (word.length === normalizedLength && !seen.has(word)) {
                    seen.add(word);
                    normalized.push(word);
                }
            });
            return normalized;
        }

        collectStringsDeep(value, out) {
            if (typeof value === 'string') {
                out.push(value);
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(item => this.collectStringsDeep(item, out));
                return;
            }
            if (value && typeof value === 'object') {
                Object.values(value).forEach(item => this.collectStringsDeep(item, out));
            }
        }

        parseWordsFromJson(text, selectedLanguage, wordLength, styleOptions = this.wordStyleOptions) {
            const parsed = JSON.parse(text);
            const collected = [];

            if (Array.isArray(parsed)) {
                this.collectStringsDeep(parsed, collected);
                return this.normalizeWordList(collected, wordLength, styleOptions);
            }

            if (parsed && typeof parsed === 'object') {
                const selectedTag = this.getLanguageTag(selectedLanguage);
                const matchedKey = Object.keys(parsed).find(key => normalizeBucketKey(key) === selectedTag);
                if (matchedKey) {
                    this.collectStringsDeep(parsed[matchedKey], collected);
                    return this.normalizeWordList(collected, wordLength, styleOptions);
                }
                if (Array.isArray(parsed.words)) {
                    this.collectStringsDeep(parsed.words, collected);
                    return this.normalizeWordList(collected, wordLength, styleOptions);
                }
                this.collectStringsDeep(parsed, collected);
                return this.normalizeWordList(collected, wordLength, styleOptions);
            }

            return [];
        }

        parseWordsFromXml(text, selectedLanguage, wordLength, styleOptions = this.wordStyleOptions) {
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'application/xml');
            if (xml.querySelector('parsererror')) {
                return [];
            }

            const selectedTag = this.getLanguageTag(selectedLanguage);
            const explicitWords = [];
            const wordNodes = xml.querySelectorAll('word');
            wordNodes.forEach(node => {
                const languageAttr = normalizeBucketKey(node.getAttribute('lang') || node.getAttribute('language') || '');
                if (languageAttr && languageAttr !== selectedTag) return;
                explicitWords.push(node.textContent || '');
            });

            if (explicitWords.length > 0) {
                return this.normalizeWordList(explicitWords, wordLength, styleOptions);
            }

            return this.normalizeWordList((xml.textContent || '').split(/[\s,;|]+/g), wordLength, styleOptions);
        }

        parseWordsFromDelimitedText(text, wordLength, styleOptions = this.wordStyleOptions) {
            return this.normalizeWordList(text.split(/[\s,;|]+/g), wordLength, styleOptions);
        }

        parseWordFile(fileName, text, selectedLanguage, wordLength, styleOptions = this.wordStyleOptions) {
            const lower = String(fileName || '').toLowerCase();
            if (lower.endsWith('.json')) {
                return this.parseWordsFromJson(text, selectedLanguage, wordLength, styleOptions);
            }
            if (lower.endsWith('.xml')) {
                return this.parseWordsFromXml(text, selectedLanguage, wordLength, styleOptions);
            }
            return this.parseWordsFromDelimitedText(text, wordLength, styleOptions);
        }

        getWordSourceMeta(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            const meta = this.wordSourceMetaByLanguage[languageTag];
            return meta && typeof meta === 'object' ? meta : null;
        }

        saveWordSourceWords(language, wordLength, styleOptions, words, meta = null) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            this.uploadedWordsByLanguage[languageTag] = words;
            this.usedUploadedWordsByLanguage[languageTag] = new Set();
            if (meta) {
                this.wordSourceMetaByLanguage[languageTag] = meta;
            } else {
                delete this.wordSourceMetaByLanguage[languageTag];
            }
        }

        async handleWordFileUpload(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) {
                this.refreshWordSourceState();
                return;
            }

            const selectedLanguage = this.getSelectedLanguage();
            const selectedWordLength = this.getSelectedWordLength();
            const styleOptions = this.getWordStyleOptions(true);
            try {
                const text = await file.text();
                const words = this.parseWordFile(file.name, text, selectedLanguage, selectedWordLength, styleOptions);
                if (words.length === 0) {
                    this.updateWordFileStatus(`No valid ${selectedWordLength}-letter words found in ${file.name} for ${selectedLanguage}.`);
                    return;
                }

                this.saveWordSourceWords(selectedLanguage, selectedWordLength, styleOptions, words, {
                    kind: 'file',
                    label: file.name,
                    count: words.length
                });
                this.updateWordlistStatus(`Loaded ${words.length} words from ${file.name}.`);
                this.renderWordlistPreview(words);
                this.setWordlistDownloadEnabled(true);
                this.updateWordFileStatus(`Loaded ${words.length} ${selectedWordLength}-letter words for ${selectedLanguage} from ${file.name}.`);
            } catch (error) {
                console.error('Failed to parse uploaded word file', error);
                this.updateWordFileStatus(`Failed to parse ${file.name}.`);
                this.updateWordlistStatus(`Failed to parse ${file.name}.`);
            }
        }

        getUploadedWordsForLanguage(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            const words = this.uploadedWordsByLanguage[languageTag];
            return Array.isArray(words) ? words : [];
        }

        getCurrentRoundCandidatePool(wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            return this.normalizeCandidatePool(this.currentRoundCandidatePool, wordLength, styleOptions);
        }

        getCurrentMatchCandidatePool(wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            return this.normalizeCandidatePool(this.currentMatchCandidatePool, wordLength, styleOptions);
        }

        getAIWordUniverse(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            return this.normalizeCandidatePool([
                ...this.getCurrentRoundCandidatePool(wordLength, styleOptions),
                ...this.getCurrentMatchCandidatePool(wordLength, styleOptions),
                ...this.getUploadedWordsForLanguage(language, wordLength, styleOptions),
                ...this.getModelMemoryWords(this.wordModel, language, wordLength, styleOptions, 120, 'word')
            ], wordLength, styleOptions);
        }

        getAIKnowledgeSampleKey(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, playerId = 0, model = '') {
            return `${this.getLanguageLengthTag(language, wordLength, styleOptions)}::player${playerId}::${normalizeBucketKey(model, 'model')}`;
        }

        getSampledAIKnowledgeWord(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, playerId = 0, model = '') {
            const universe = this.getAIWordUniverse(language, wordLength, styleOptions);
            if (universe.length === 0) {
                return '';
            }

            const sampleKey = this.getAIKnowledgeSampleKey(language, wordLength, styleOptions, playerId, model);
            const existing = this.currentRoundAIKnowledgeSamples[sampleKey];
            if (existing && universe.includes(existing)) {
                return existing;
            }

            const sampledWord = universe[Math.floor(Math.random() * universe.length)] || '';
            if (sampledWord) {
                this.currentRoundAIKnowledgeSamples[sampleKey] = sampledWord;
            }
            return sampledWord;
        }

        getAIKnowledgeWords(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, playerId = 0, model = '') {
            const universe = this.getAIWordUniverse(language, wordLength, styleOptions);
            if (this.aiWordKnowledge === 'full') {
                return universe;
            }
            if (this.aiWordKnowledge !== 'sample' || universe.length === 0) {
                return [];
            }
            const sampledWord = this.getSampledAIKnowledgeWord(language, wordLength, styleOptions, playerId, model);
            return sampledWord ? [sampledWord] : [];
        }

        getAIOpeningGuess(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, playerId = 0, model = '') {
            const openingKey = this.getAIKnowledgeSampleKey(language, wordLength, styleOptions, playerId, model);
            const existing = this.currentRoundAIOpeningGuesses[openingKey];
            if (existing) {
                return existing;
            }

            let openingGuess = '';
            if (this.aiWordKnowledge === 'sample') {
                openingGuess = this.getSampledAIKnowledgeWord(language, wordLength, styleOptions, playerId, model);
            } else if (this.aiWordKnowledge === 'full') {
                const universe = this.getAIWordUniverse(language, wordLength, styleOptions);
                if (universe.length > 0) {
                    openingGuess = universe[Math.floor(Math.random() * universe.length)] || '';
                }
            }

            if (openingGuess) {
                this.currentRoundAIOpeningGuesses[openingKey] = openingGuess;
            }
            return openingGuess;
        }

        getAllowedGuessWords(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            if (!this.isUploadedWordsEnabled()) {
                return [];
            }
            return this.normalizeCandidatePool(this.getUploadedWordsForLanguage(language, wordLength, styleOptions), wordLength, styleOptions);
        }

        validateSubmittedGuess(guess, language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedLength = clampWordLength(wordLength);
            const normalizedGuess = normalizeToWordLength(guess, normalizedLength, styleOptions);
            if (normalizedGuess.length !== normalizedLength) {
                return { allowed: false, reason: `Guess must be exactly ${normalizedLength} letters.` };
            }

            const allowedWords = this.getAllowedGuessWords(language, normalizedLength, styleOptions);
            if (allowedWords.length === 0) {
                return { allowed: true, reason: '' };
            }

            if (allowedWords.includes(normalizedGuess)) {
                return { allowed: true, reason: '' };
            }

            return { allowed: false, reason: 'Guess is not in the active reusable wordlist.' };
        }

        pickUploadedWord(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            const words = this.getUploadedWordsForLanguage(language, wordLength, styleOptions);
            if (words.length === 0) return '';

            let usedSet = this.usedUploadedWordsByLanguage[languageTag];
            if (!(usedSet instanceof Set)) {
                usedSet = new Set();
                this.usedUploadedWordsByLanguage[languageTag] = usedSet;
            }

            let candidates = words.filter(word => !usedSet.has(word));
            if (candidates.length === 0) {
                usedSet.clear();
                candidates = [...words];
            }

            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            usedSet.add(pick);
            return pick;
        }

        getUsedRoundSolutions(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            let usedSet = this.usedRoundSolutionsByLanguage[languageTag];
            if (!(usedSet instanceof Set)) {
                usedSet = new Set();
                this.usedRoundSolutionsByLanguage[languageTag] = usedSet;
            }
            return usedSet;
        }

        markUsedRoundSolution(language, word, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedLength = clampWordLength(wordLength);
            const normalized = normalizeToWordLength(word, normalizedLength, styleOptions);
            if (normalized.length !== normalizedLength) return;
            this.getUsedRoundSolutions(language, normalizedLength, styleOptions).add(normalized);
        }

        getRejectedGenerationWords(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            const words = this.rejectedGenerationWordsByLanguage[languageTag];
            return Array.isArray(words) ? words : [];
        }

        addRejectedGenerationWord(language, word, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedLength = clampWordLength(wordLength);
            const normalized = normalizeToWordLength(word, normalizedLength, styleOptions);
            if (normalized.length !== normalizedLength) return;
            const languageTag = this.getLanguageLengthTag(language, normalizedLength, styleOptions);
            const existing = this.getRejectedGenerationWords(language, normalizedLength, styleOptions);
            this.rejectedGenerationWordsByLanguage[languageTag] = [
                normalized,
                ...existing.filter(existingWord => existingWord !== normalized)
            ].slice(0, MAX_REJECTED_WORDS_PER_LANGUAGE);
        }

        getPersistentlyRejectedWords(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, limit = MAX_REJECTED_WORDS_PER_LANGUAGE) {
            return getReviewedRejectedWords(language, wordLength, styleOptions, limit);
        }

        rememberPersistentlyRejectedWord(language, word, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, review = null) {
            rememberReviewedRejectedWord(language, word, wordLength, styleOptions, review);
        }

        clearRejectedGenerationWords(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const languageTag = this.getLanguageLengthTag(language, wordLength, styleOptions);
            delete this.rejectedGenerationWordsByLanguage[languageTag];
        }

        getModelMemoryWords(model, language, wordLength, styleOptions = this.wordStyleOptions, limit = 120, role = 'generic') {
            if (!this.isLLMMemoryEnabled()) return [];
            const rejectedWords = new Set(this.getPersistentlyRejectedWords(language, wordLength, styleOptions, 400));
            const primaryWords = getMemoryWordsForModel(model, language, wordLength, styleOptions, limit, role)
                .filter(word => !rejectedWords.has(word));
            if (role !== 'ai') {
                return primaryWords;
            }

            const sharedWords = getMemoryWordsForModel('__shared__', language, wordLength, styleOptions, limit, 'ai-shared')
                .filter(word => !rejectedWords.has(word));
            return this.normalizeCandidatePool([...primaryWords, ...sharedWords], wordLength, styleOptions)
                .slice(0, Math.max(1, limit));
        }

        getModelGuessMemory(model, language, wordLength, styleOptions = this.wordStyleOptions, limit = 120, role = 'generic') {
            if (!this.isLLMMemoryEnabled()) return [];
            const rejectedWords = new Set(this.getPersistentlyRejectedWords(language, wordLength, styleOptions, 400));
            const mergeEntries = entries => {
                const merged = new Map();
                entries.forEach(entry => {
                    if (!entry || !entry.guess || rejectedWords.has(entry.guess)) return;
                    const key = `${entry.signature || ''}::${entry.guess}`;
                    const existing = merged.get(key);
                    if (!existing) {
                        merged.set(key, { ...entry });
                        return;
                    }
                    merged.set(key, {
                        ...existing,
                        solved: existing.solved || entry.solved,
                        effectiveness: Math.max(existing.effectiveness || 0, entry.effectiveness || 0),
                        guessNumber: existing.guessNumber > 0
                            ? Math.min(existing.guessNumber, entry.guessNumber || existing.guessNumber)
                            : (entry.guessNumber || 0),
                        count: (existing.count || 1) + Math.max(1, entry.count || 1),
                        lastUsedAt: Math.max(existing.lastUsedAt || 0, entry.lastUsedAt || 0)
                    });
                });
                return Array.from(merged.values())
                    .sort((left, right) => Number(right.solved) - Number(left.solved)
                        || (right.effectiveness || 0) - (left.effectiveness || 0)
                        || (right.count || 0) - (left.count || 0)
                        || (right.lastUsedAt || 0) - (left.lastUsedAt || 0))
                    .slice(0, Math.max(1, limit));
            };

            const primaryEntries = getGuessMemoryEntriesForModel(model, language, wordLength, styleOptions, limit, role);
            if (role !== 'ai') {
                return mergeEntries(primaryEntries);
            }

            const sharedEntries = getGuessMemoryEntriesForModel('__shared__', language, wordLength, styleOptions, limit, 'ai-shared');
            return mergeEntries([...primaryEntries, ...sharedEntries]);
        }

        rememberModelWord(model, language, word, wordLength, styleOptions = this.wordStyleOptions, role = 'generic') {
            if (!this.isLLMMemoryEnabled()) return;
            if (this.getPersistentlyRejectedWords(language, wordLength, styleOptions, 400).includes(word)) return;
            rememberWordForModel(model, language, word, wordLength, styleOptions, role);
            if (role === 'ai') {
                rememberWordForModel('__shared__', language, word, wordLength, styleOptions, 'ai-shared');
            }
        }

        rememberModelGuessMemory(model, language, entry, wordLength, styleOptions = this.wordStyleOptions, role = 'generic') {
            if (!this.isLLMMemoryEnabled()) return;
            if (entry?.guess && this.getPersistentlyRejectedWords(language, wordLength, styleOptions, 400).includes(entry.guess)) return;
            rememberGuessMemoryForModel(model, language, entry, wordLength, styleOptions, role);
            if (role === 'ai') {
                rememberGuessMemoryForModel('__shared__', language, entry, wordLength, styleOptions, 'ai-shared');
            }
        }

        resetSelectedLLMMemory() {
            const selectedWordModel = this.getSelectedModel('word-model', 'custom-word-model', this.wordModel);
            const selectedAIModels = [...new Set(this.getSelectedAIModels())];
            clearMemoryForModel(selectedWordModel, 'word');
            selectedAIModels.forEach(model => clearMemoryForModel(model, 'ai'));
            const aiModelLabel = selectedAIModels.length > 0
                ? selectedAIModels.map(model => `"${model}"`).join(', ')
                : 'none selected';
            this.updateRoundStatus(`Cleared LLM memory for word-model "${selectedWordModel}" and ai-models ${aiModelLabel}.`);
        }

        getRoundMemoryWords(language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, limit = ROUND_MEMORY_POOL_LIMIT) {
            return this.getModelMemoryWords(this.wordModel, language, wordLength, styleOptions, limit, 'word');
        }

        getPromptMemoryWords(memoryWords) {
            return shuffleArray(Array.isArray(memoryWords) ? memoryWords : []).slice(0, MEMORY_HINT_LIMIT);
        }

        normalizeCandidatePool(rawCandidates, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedLength = clampWordLength(wordLength);
            if (!Array.isArray(rawCandidates)) return [];

            const unique = [];
            const seen = new Set();
            rawCandidates.forEach(entry => {
                const word = normalizeToWordLength(entry, normalizedLength, styleOptions);
                if (!word || seen.has(word)) return;
                seen.add(word);
                unique.push(word);
            });
            return unique;
        }

        extractWordArrayPayload(parsed) {
            if (Array.isArray(parsed)) return parsed;
            if (!parsed || typeof parsed !== 'object') return [];
            if (Array.isArray(parsed.candidates)) return parsed.candidates;
            if (Array.isArray(parsed.words)) return parsed.words;
            return [];
        }

        extractRawWordArrayResponse(rawText) {
            if (typeof rawText !== 'string' || !rawText.trim()) return [];
            try {
                const parsed = JSON.parse(rawText);
                return this.extractWordArrayPayload(parsed);
            } catch {
                return rawText.split(/[\s,;|]+/g);
            }
        }

        parseWordArrayResponse(rawText, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            return this.normalizeCandidatePool(this.extractRawWordArrayResponse(rawText), wordLength, styleOptions);
        }

        getMinimumCandidatePoolSize(targetPoolSize = this.wordPoolSize) {
            const normalizedTarget = clampWordPoolSize(targetPoolSize);
            return Math.max(MIN_WORD_POOL_SIZE, Math.floor(normalizedTarget * 0.8));
        }

        pickRandomRoundSolution(candidates, language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, rejectedWords = new Set()) {
            const randomizedCandidates = shuffleArray(candidates);
            const usedSolutions = this.getUsedRoundSolutions(language, wordLength, styleOptions);
            let availableCandidates = randomizedCandidates.filter(candidate =>
                !rejectedWords.has(candidate)
                && !usedSolutions.has(candidate)
            );

            if (availableCandidates.length === 0 && usedSolutions.size > 0) {
                console.info(`[Round ${this.roundNumber}] Reusing prior solution words for ${language} after exhausting the available ${wordLength}-letter pool.`);
                usedSolutions.clear();
                availableCandidates = randomizedCandidates.filter(candidate => !rejectedWords.has(candidate));
            }

            return availableCandidates[0] || '';
        }

        getWordPromptRuleLines(language, wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedStyle = normalizeWordStyleOptions(styleOptions);
            const rules = [];

            if (normalizedStyle.allowExtendedLetters) {
                rules.push('- Letters may include language-specific characters with diacritics.');
            } else {
                rules.push('- Use only A-Z letters with no diacritics.');
            }

            if (normalizedStyle.onlySingular) {
                rules.push('- Every word must be a singular noun.');
            } else {
                rules.push('- Every word must be a common standalone word suitable for Wordle.');
                rules.push('- Prefer words naturally usable as nouns, verbs, or adjectives.');
            }

            if (normalizedStyle.customInstructions) {
                rules.push(`- Additional user style constraints: ${normalizedStyle.customInstructions}`);
            }

            rules.push(`- Every word must be exactly ${wordLength} letters.`);
            rules.push(`- Every word must be a common ${language} word.`);

            return rules;
        }

        getSelectedWordlistTargetSize() {
            const input = document.getElementById('wordlist-target-size');
            const selected = clampWordlistTargetSize(input ? input.value : DEFAULT_WORDLIST_TARGET_SIZE);
            if (input) input.value = String(selected);
            return selected;
        }

        async repairSingularLengthVariants(rawCandidates, language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const normalizedStyle = normalizeWordStyleOptions(styleOptions);
            const normalizedLength = clampWordLength(wordLength);
            if (!normalizedStyle.onlySingular || !Array.isArray(rawCandidates) || rawCandidates.length === 0) {
                return [];
            }

            const mismatched = [];
            const seen = new Set();
            rawCandidates.forEach(entry => {
                const lettersOnly = String(entry || '')
                    .trim()
                    .normalize('NFC')
                    .toUpperCase()
                    .match(normalizedStyle.allowExtendedLetters ? /\p{L}+/gu : /[A-Z]+/g);
                const collapsed = Array.isArray(lettersOnly) ? lettersOnly.join('') : '';
                if (!collapsed || collapsed.length === normalizedLength || seen.has(collapsed)) return;
                seen.add(collapsed);
                mismatched.push(collapsed);
            });

            if (mismatched.length === 0) {
                return [];
            }

            const prompt = `You are fixing candidate words for a ${language} Wordle game.
The list should contain singular nouns only, and every repaired word must be exactly ${normalizedLength} letters.
Return JSON only with this schema:
{"repairs":[{"source":"TOKEN","singular":"${createWordMask(normalizedLength)}"}]}
Rules:
- For each source token, return its singular noun form in "singular" only if that singular noun is a common standalone ${language} word with exactly ${normalizedLength} letters.
- If no valid singular noun of exactly ${normalizedLength} letters exists, use an empty string for "singular".
- Keep "source" unchanged from the input token.
- Use only letters${normalizedStyle.allowExtendedLetters ? ' from the target language' : ' A-Z with no diacritics'}.
Source tokens:
${mismatched.slice(0, 40).join(', ')}`;

            try {
                const data = await generateWithOllama({
                    model: this.wordModel,
                    prompt,
                    format: 'json',
                    stream: false,
                    think: false,
                    options: {
                        temperature: 0.0,
                        num_predict: 320,
                        top_p: 0.8
                    }
                });
                const rawResponse = extractOllamaText(data);
                let parsed;
                try {
                    parsed = JSON.parse(rawResponse);
                } catch {
                    return [];
                }
                const repairs = Array.isArray(parsed?.repairs) ? parsed.repairs : [];
                return this.normalizeCandidatePool(
                    repairs.map(entry => entry?.singular || ''),
                    normalizedLength,
                    normalizedStyle
                );
            } catch (error) {
                console.warn('Could not repair singular length variants.', error);
                return [];
            }
        }

        async parseCandidatePoolResponse(rawText, targetPoolSize = this.wordPoolSize, wordLength = this.wordLength, styleOptions = this.wordStyleOptions, language = this.getSelectedLanguage()) {
            const rawCandidates = this.extractRawWordArrayResponse(rawText);
            const candidates = this.parseWordArrayResponse(rawText, wordLength, styleOptions);
            const repairedCandidates = await this.repairSingularLengthVariants(rawCandidates, language, wordLength, styleOptions);
            const mergedCandidates = this.normalizeCandidatePool(
                [...candidates, ...repairedCandidates],
                wordLength,
                styleOptions
            );
            const minimumPoolSize = this.getMinimumCandidatePoolSize(targetPoolSize);
            return {
                candidates: mergedCandidates,
                poolSize: mergedCandidates.length,
                minimumPoolSize,
                isPartial: mergedCandidates.length > 0 && mergedCandidates.length < minimumPoolSize
            };
        }

        async generateWordListWithLLM() {
            const button = document.getElementById('generate-wordlist');
            if (button) {
                button.disabled = true;
                button.textContent = 'Generating...';
            }

            const language = this.getSelectedLanguage();
            const wordLength = this.getSelectedWordLength();
            const styleOptions = this.getWordStyleOptions(true);
            const model = this.getSelectedModel('word-model', 'custom-word-model', DEFAULT_WORD_MODEL);
            const targetSize = this.getSelectedWordlistTargetSize();
            const collected = new Set();
            const maxBatches = Math.max(3, Math.ceil(targetSize / WORDLIST_BATCH_LIMIT) + 2);
            const ruleLines = this.getWordPromptRuleLines(language, wordLength, styleOptions);

            this.updateWordlistStatus(`Generating ${targetSize} words for ${language}...`);

            try {
                for (let batchIndex = 0; batchIndex < maxBatches && collected.size < targetSize; batchIndex++) {
                    const remaining = targetSize - collected.size;
                    const requestSize = Math.min(remaining, WORDLIST_BATCH_LIMIT);
                    const excludeWords = Array.from(collected).slice(-220);
                    const exclusionRule = excludeWords.length
                        ? `- Do not repeat any of these words: ${excludeWords.join(', ')}.`
                        : '';
                    const prompt = `Task: Generate a reusable Wordle wordlist in ${language}.
Return JSON only with this schema:
{"words":["${createWordMask(wordLength)}"]}
Rules:
- Return exactly ${requestSize} unique words.
${ruleLines.join('\n')}
${exclusionRule}
- Do not output anything except valid JSON.`;

                    console.log('[Wordlist Builder Prompt]', prompt);
                    const data = await generateWithOllama({
                        model,
                        prompt,
                        format: 'json',
                        stream: false,
                        think: false,
                        options: {
                            temperature: 0.2,
                            num_predict: Math.max(320, Math.min(900, requestSize * 14)),
                            top_p: 0.9
                        }
                    });

                    const batchWords = this.parseWordArrayResponse(extractOllamaText(data), wordLength, styleOptions);
                    batchWords.forEach(word => collected.add(word));
                    this.updateWordlistStatus(`Generating ${language} wordlist... ${collected.size}/${targetSize} collected.`);
                }

                const finalWords = Array.from(collected).slice(0, targetSize);
                if (finalWords.length === 0) {
                    throw new Error('The model returned no valid words.');
                }

                this.saveWordSourceWords(language, wordLength, styleOptions, finalWords, {
                    kind: 'llm',
                    model,
                    count: finalWords.length,
                    createdAt: new Date().toISOString()
                });

                document.getElementById('use-uploaded-words').checked = true;
                this.renderWordlistPreview(finalWords);
                this.refreshWordFileStatus();

                if (finalWords.length < targetSize) {
                    this.updateWordlistStatus(`Generated ${finalWords.length}/${targetSize} words for ${language}. The partial list is ready and enabled as the round source.`);
                } else {
                    this.updateWordlistStatus(`Generated ${finalWords.length} words for ${language} and enabled them as the round source.`);
                }
            } catch (error) {
                console.error('Failed to generate LLM wordlist', error);
                this.updateWordlistStatus(`Wordlist generation failed: ${error.message || error}`);
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Generate with LLM';
                }
            }
        }

        downloadCurrentWordList() {
            const language = this.getSelectedLanguage();
            const wordLength = this.getSelectedWordLength();
            const styleOptions = this.getWordStyleOptions(true);
            const words = this.getUploadedWordsForLanguage(language, wordLength, styleOptions);

            if (words.length === 0) {
                this.updateWordlistStatus(`No reusable wordlist available for ${language} to download.`);
                return;
            }

            const payload = {
                language,
                wordLength,
                styleOptions: normalizeWordStyleOptions(styleOptions),
                source: this.getWordSourceMeta(language, wordLength, styleOptions),
                words
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const languageTag = normalizeBucketKey(language, 'language').replace(/[^a-z0-9-]/g, '-');
            link.href = url;
            link.download = `wordlevs-${languageTag}-len${wordLength}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            this.updateWordlistStatus(`Downloaded ${words.length} words for ${language}.`);
        }

        buildRoundCandidatePool(candidates, memoryWords, rejectedWords, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            return this.normalizeCandidatePool(
                [
                    ...(Array.isArray(candidates) ? candidates : []),
                    ...(Array.isArray(memoryWords) ? memoryWords : [])
                ],
                wordLength,
                styleOptions
            ).filter(word => !rejectedWords.has(word));
        }
    }

    Object.getOwnPropertyNames(WordSourceMethods.prototype).forEach(name => {
        if (name === 'constructor') return;
        GameManager.prototype[name] = WordSourceMethods.prototype[name];
    });
}
