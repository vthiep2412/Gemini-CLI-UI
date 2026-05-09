## 2026-05-09 - Hoisted dynamic import outside loop
**Learning:** Dynamic module imports (e.g., `await import(...)`) placed inside loops act as a significant performance bottleneck in Node.js by yielding to the event loop on every iteration, even when the module is cached.
**Action:** Always hoist dynamic imports outside of loops to optimize execution time.
