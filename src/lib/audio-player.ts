
// src/lib/audio-player.ts
"use client";

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.");
            return null;
        }
    }
    return audioContext;
};

// Function to play a simple synth tone
const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Ensure audio context is resumed (required by modern browsers)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Fade out to prevent clicking
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
};

/**
 * Plays a short, sharp notification sound.
 * Useful for indicating an action has started (e.g., upload initiated).
 */
export const playNotificationSound = () => {
    playTone(880, 0.1, 'square'); // Higher pitch, short duration
};

/**
 * Plays a pleasant, bell-like success sound.
 * Useful for indicating a successful completion (e.g., file arrived).
 */
export const playSuccessSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const play = (freq: number, startTime: number, duration: number = 0.2) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    };

    // A simple two-tone bell sound
    play(1046.50, 0);       // C6
    play(1396.91, 0.1);     // F6
};
