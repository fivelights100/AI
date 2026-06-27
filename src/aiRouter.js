// src/aiRouter.js
const { appSettings } = require('./configManager');

// AI 모델 라우터 및 통신 전담 함수
async function sendMessageToAI(messagesBody, temperature) {
  if (appSettings.modelType === 'local') {
    // 1. 로컬 모델 (Ollama) 통신
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: appSettings.localModel, 
        messages: messagesBody,
        stream: false,
        options: { temperature: temperature }
      })
    });
    if (!response.ok) throw new Error('로컬 Ollama 서버가 꺼져있거나 응답하지 않아.');
    const data = await response.json();
    return data.message.content;

  } else if (appSettings.modelType === 'cloud') {
    const apiKey = appSettings.cloudApiKey.trim();
    if (!apiKey) throw new Error('고급 설정에서 클라우드 API 키를 먼저 입력해 줘!');

    const provider = appSettings.cloudProvider;
    const systemPrompt = messagesBody.find(m => m.role === 'system')?.content || "";
    const chatHistoryOnly = messagesBody.filter(m => m.role !== 'system');

    if (provider === 'gpt') {
      // 2. OpenAI (GPT) 통신
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', 
          messages: messagesBody,
          temperature: temperature
        })
      });
      if (!response.ok) throw new Error('OpenAI API 키가 틀렸거나 응답 오류야.');
      const data = await response.json();
      return data.choices[0].message.content;

    } else if (provider === 'gemini') {
      // 3. Google (Gemini) 통신
      const geminiMessages = chatHistoryOnly.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMessages,
          generationConfig: { temperature: temperature }
        })
      });
      if (!response.ok) throw new Error('Gemini API 키가 틀렸거나 응답 오류야.');
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;

    } else if (provider === 'claude') {
      // 4. Anthropic (Claude) 통신
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          system: systemPrompt,
          messages: chatHistoryOnly,
          max_tokens: 1024,
          temperature: temperature
        })
      });
      if (!response.ok) throw new Error('Claude API 키가 틀렸거나 응답 오류야.');
      const data = await response.json();
      return data.content[0].text;
    }
  }
}

// 외부에서 쓸 수 있도록 내보냅니다.
module.exports = {
  sendMessageToAI
};