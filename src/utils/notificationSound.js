let audioContext = null;

// Create different notification sounds using Web Audio API
function createNotificationSound(context, type = 'chime') {
  const duration = 0.5;
  const sampleRate = context.sampleRate;
  const numSamples = duration * sampleRate;
  
  // Create buffer
  const buffer = context.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);
  
  switch (type) {
    case 'ping': {
      // Triple ascending high-pitched pings (uh ah ahh style)
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        // First ping
        if (t < 0.1) {
          const envelope = Math.exp(-20 * t);
          data[i] = envelope * 0.4 * Math.sin(2 * Math.PI * 1200 * t);
        }
        // Second ping
        if (t >= 0.12 && t < 0.22) {
          const t2 = t - 0.12;
          const envelope = Math.exp(-20 * t2);
          data[i] += envelope * 0.4 * Math.sin(2 * Math.PI * 1400 * t2);
        }
        // Third ping
        if (t >= 0.24 && t < 0.34) {
          const t3 = t - 0.24;
          const envelope = Math.exp(-20 * t3);
          data[i] += envelope * 0.4 * Math.sin(2 * Math.PI * 1600 * t3);
        }
      }
      break;
    }
    case 'pulse': {
      // Soft, low-frequency pulse
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        if (t < 0.4) {
          const envelope = Math.sin(Math.PI * t / 0.4) * Math.exp(-2 * t);
          data[i] = envelope * 0.5 * Math.sin(2 * Math.PI * 440 * t);
        }
      }
      break;
    }
    case 'tech': {
      // Quick digital blip sequence
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        if (t < 0.3) {
          const segment = Math.floor(t * 30) % 2;
          const envelope = Math.exp(-20 * (t % 0.05));
          const freq = 600 + (Math.floor(t * 10) * 200);
          data[i] = segment * envelope * 0.3 * Math.sin(2 * Math.PI * freq * t);
        }
      }
      break;
    }
    case 'calm': {
      // Gentle, fading warm tone
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        if (t < 0.5) {
          const envelope = Math.pow(Math.sin(Math.PI * t / 0.5), 0.5) * Math.exp(-2 * t);
          data[i] = envelope * 0.4 * (
            Math.sin(2 * Math.PI * 523.25 * t) + // C5
            0.5 * Math.sin(2 * Math.PI * 783.99 * t) // G5
          ) / 1.5;
        }
      }
      break;
    }
    case 'chime':
    default: {
      // Generate a pleasant notification sound (two-tone chime)
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let sample = 0;
        
        // First tone (higher pitch)
        if (t < 0.15) {
          const envelope = Math.sin(Math.PI * t / 0.15);
          sample += envelope * 0.3 * Math.sin(2 * Math.PI * 880 * t); // A5
        }
        
        // Second tone (lower pitch)
        if (t >= 0.15 && t < 0.3) {
          const envelope = Math.sin(Math.PI * (t - 0.15) / 0.15);
          sample += envelope * 0.3 * Math.sin(2 * Math.PI * 659.25 * t); // E5
        }
        
        data[i] = sample;
      }
      break;
    }
  }
  
  return buffer;
}

// Play the notification sound
export async function playNotificationSound() {
  try {
    // Check if sound is enabled
    const settings = JSON.parse(localStorage.getItem('gemini-tools-settings') || '{}');
    if (!settings.enableNotificationSound) {
      return;
    }
    
    // Create or resume audio context
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume context if it's suspended (required for some browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Create the notification sound
    const soundType = settings.notificationSoundType || 'chime';
    const buffer = createNotificationSound(audioContext, soundType);
    
    // Play the sound
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    const volume = Math.max(0, Math.min(1, settings.notificationSoundVolume ?? 0.5));
    gainNode.gain.value = volume; // Clamped to 0-1 range, default 50%
    // TODO: Add notification sound customize to settings.
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start();
    
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}
