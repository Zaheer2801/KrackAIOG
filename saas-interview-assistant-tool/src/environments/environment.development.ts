export const environment = {
  apiUrl: 'https://krackai-api.onrender.com',
  websockerUrl: 'wss://krackai-api.onrender.com',
  // Voice cloning practice feature — enabled in dev so it can be worked on,
  // still OFF in production (see environment.ts). Backend must also have
  // ENABLE_VOICE_CLONE=true and ELEVENLABS_API_KEY set for it to function.
  voiceCloneEnabled: true,
};
