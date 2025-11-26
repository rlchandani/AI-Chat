/**
 * Script to list all available OpenAI models via the API
 * Run with: node list-openai-models.js
 */

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('Missing OPENAI_API_KEY environment variable');
    console.error('Please set it in your .env.local file or export it:');
    console.error('export OPENAI_API_KEY=your_api_key_here');
    process.exit(1);
}

async function listOpenAIModels() {
    try {
        console.log('Fetching available OpenAI models...\n');
        
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error:', data);
            return;
        }

        console.log('Available OpenAI Models:');
        console.log('======================\n');

        // Filter and group models
        const chatModels = data.data
            .filter(model => 
                model.id.includes('gpt') || 
                model.id.includes('o1') || 
                model.id.includes('o3') ||
                model.id.includes('o4')
            )
            .sort((a, b) => a.id.localeCompare(b.id));

        // Group by model family
        const grouped = {
            'GPT-4o': [],
            'GPT-4': [],
            'GPT-3.5': [],
            'o-Series': [],
            'Other': [],
        };

        chatModels.forEach(model => {
            if (model.id.includes('gpt-4o')) {
                grouped['GPT-4o'].push(model);
            } else if (model.id.includes('gpt-4')) {
                grouped['GPT-4'].push(model);
            } else if (model.id.includes('gpt-3.5')) {
                grouped['GPT-3.5'].push(model);
            } else if (model.id.includes('o1') || model.id.includes('o3') || model.id.includes('o4')) {
                grouped['o-Series'].push(model);
            } else {
                grouped['Other'].push(model);
            }
        });

        // Print grouped models
        Object.entries(grouped).forEach(([category, models]) => {
            if (models.length > 0) {
                console.log(`\n${category}:`);
                console.log('-'.repeat(50));
                models.forEach(model => {
                    console.log(`  • ${model.id}`);
                    if (model.owned_by) {
                        console.log(`    Owned by: ${model.owned_by}`);
                    }
                });
            }
        });

        console.log('\n\nAll Model IDs (for reference):');
        console.log('-'.repeat(50));
        chatModels.forEach(model => {
            console.log(`  ${model.id}`);
        });

    } catch (error) {
        console.error('Failed to list models:', error);
    }
}

listOpenAIModels();

