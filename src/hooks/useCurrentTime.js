import { useState, useEffect } from 'react';

// Singleton interval state
const subscribers = new Set();
let timerId = null;
let currentGlobalTime = new Date();

const startTimer = () => {
  if (!timerId) {
    timerId = setInterval(() => {
      currentGlobalTime = new Date();
      subscribers.forEach((callback) => callback(currentGlobalTime));
    }, 60000); // 60 seconds
  }
};

const stopTimer = () => {
  if (subscribers.size === 0 && timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

export const useCurrentTime = () => {
  const [time, setTime] = useState(currentGlobalTime);

  useEffect(() => {
    const callback = (newTime) => setTime(newTime);
    subscribers.add(callback);
    startTimer();

    return () => {
      subscribers.delete(callback);
      stopTimer();
    };
  }, []);

  return time;
};
