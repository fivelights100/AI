const axios = require('axios');
const FormData = require('form-data');

function registerWhisperIpc(ipcMain) {
  ipcMain.handle('send-to-whisper', async (_event, arrayBuffer) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
        return null;
      }

      const audioBuffer = Buffer.from(arrayBuffer);
      const form = new FormData();

      form.append('file', audioBuffer, {
        filename: 'command.webm',
        contentType: 'audio/webm',
      });
      form.append('model', 'whisper-1');
      form.append('language', 'ko');

      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      return response.data.text;
    } catch (error) {
      console.error('Axios OpenAI 에러:', error.response ? error.response.data : error.message);
      return null;
    }
  });
}

module.exports = { registerWhisperIpc };
