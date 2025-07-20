import { screens } from './dom-elements.js';

export const screenManager = {
    showScreen: (screenName) => {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }
};