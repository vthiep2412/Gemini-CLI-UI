import { useState, useEffect } from 'react';

const subscribers = new Set();
let intervalId = null;

export const useCurrentTime = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    subscribers.add(setTime);

    if (!intervalId) {
      intervalId = setInterval(() => {
        const now = new Date();
        subscribers.forEach(cb => cb(now));
      }, 60000);
    }

    return () => {
      subscribers.delete(setTime);
      if (subscribers.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, []);

  return time;
};
