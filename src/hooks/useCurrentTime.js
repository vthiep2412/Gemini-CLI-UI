import { useState, useEffect } from 'react';

const subscribers = new Set();
let intervalId = null;

export const useCurrentTime = (updateInterval = 60000) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    subscribers.add(setTime);

    if (!intervalId) {
      intervalId = setInterval(() => {
        const now = new Date();
        subscribers.forEach(cb => cb(now));
      }, updateInterval);
    }

    return () => {
      subscribers.delete(setTime);
      if (subscribers.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [updateInterval]);

  return time;
};
