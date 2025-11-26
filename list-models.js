const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
    console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
    process.exit(1);
}

async function listModels() {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Error:', data);
            return;
        }

        console.log('Available models:');
        console.log('================\n');

        data.models.forEach(model => {
            console.log(`Name: ${model.name}`);
            console.log(`Display Name: ${model.displayName}`);
            console.log(`Supported Methods: ${model.supportedGenerationMethods?.join(', ')}`);
            console.log('---');
        });
    } catch (error) {
        console.error('Failed to list models:', error);
    }
}

listModels();
