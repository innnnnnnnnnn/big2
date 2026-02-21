import { Howl } from 'howler';
import { useEffect, useRef } from 'react';

// Pre-load all sounds to prevent delay on first interaction
const sounds = {
    play: new Howl({ src: ['/big2/sounds/card_play.mp3'], volume: 1.0, preload: true }),
    slide: new Howl({ src: ['/big2/sounds/card_slide.mp3'], volume: 0.6, preload: true }),
    deal: new Howl({ src: ['/big2/sounds/card_deal.mp3'], volume: 0.8, preload: true }),
    pass: new Howl({ src: ['/big2/sounds/pass.mp3'], volume: 0.5, preload: true }),
    error: new Howl({ src: ['/big2/sounds/error.mp3'], volume: 0.4, preload: true }),
    win: new Howl({ src: ['/big2/sounds/win.mp3'], volume: 0.7, preload: true }),
};

export const useAudio = () => {
    // Reference to allow safe calling inside useEffects
    const playSound = (type: keyof typeof sounds) => {
        if (sounds[type]) {
            sounds[type].play();
        }
    };

    return { playSound };
};
