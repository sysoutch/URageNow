import { initInteractiveBook } from './js/main.js';

initInteractiveBook().catch(error => {
    const status = document.getElementById('book-status');
    if (status) {
        status.textContent = `Interactive Book Creator failed to initialize: ${error?.message || 'Unknown error'}`;
    }
});
