// Simple test script to verify the chat API
const testMessage = {
    messages: [
        { role: 'user', content: 'Say hello in one sentence' }
    ]
};

async function testChatAPI() {
    console.log('Testing /api/chat endpoint...');

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testMessage),
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return;
        }

        if (!response.body) {
            console.error('No response body');
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        console.log('\nStreaming response:');
        console.log('-------------------');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            process.stdout.write(chunk);
        }

        console.log('\n-------------------');
        console.log('\nFull response length:', fullResponse.length);
        console.log('Full response:', fullResponse);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testChatAPI();
