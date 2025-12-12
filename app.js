// =====================
// APPLICATION ENTRY POINT
// =====================

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create MVC components
        const storageModel = new StorageModel();
        const view = new QuizView();
        const controller = new QuizController(storageModel, view);
        
        // Initialize application
        await controller.init();
        
        console.log('Quiz application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Error starting application. Please refresh the page.');
    }
});
