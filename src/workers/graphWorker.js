/**
 * graphWorker.js — Web Worker
 * Runs the DAG lane-allocation algorithm off the main thread.
 * Receives: raw commit array from useGitStore
 * Posts back: layout array with { hash, lane, color, edges }
 */

const BRANCH_COLORS = [
  '#7c6ff7', // indigo  (primary)
  '#22d3ee', // cyan
  '#4ade80', // green
  '#fb923c', // orange
  '#f472b6', // pink
  '#2dd4bf', // teal
  '#facc15', // yellow
  '#f87171', // red
];

function computeLanes(commits) {
  if (!commits || commits.length === 0) return [];

  // Track which lane each commit is assigned to
  const hashToLane = {};
  // Track which commit is currently occupying each lane (the 'tip' of a reserved path)
  const activeLanes = [];

  const layout = commits.map((commit, idx) => {
    const { hash, parents = [] } = commit;

    let lane;
    if (hashToLane[hash] !== undefined) {
      // Use the lane reserved for us by our child
      lane = hashToLane[hash];
    } else {
      // Find the first free lane slot or create a new one
      lane = activeLanes.findIndex(h => h === null || h === undefined);
      if (lane === -1) lane = activeLanes.length;
    }

    // Mark this lane as occupied by the current commit
    activeLanes[lane] = hash;
    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length];

    const edges = [];
    parents.forEach((parentHash, pIdx) => {
      if (!parentHash) return;

      const isMerge = pIdx > 0;
      let toLane;
      let isSplit = false;

      if (hashToLane[parentHash] !== undefined) {
        // Parent already has a lane (from another child). This is a Split!
        toLane = hashToLane[parentHash];
        isSplit = true;
      } else {
        // First child to claim this parent gets the current lane if possible
        // but we only reuse the lane if it's the primary (first) parent line
        if (!isMerge) {
          toLane = lane;
          hashToLane[parentHash] = lane;
        } else {
          // Alternative parent: find a new lane for it
          toLane = activeLanes.findIndex(h => h === null || h === undefined);
          if (toLane === -1) toLane = activeLanes.length;
          hashToLane[parentHash] = toLane;
          activeLanes[toLane] = parentHash; // Reserve it
        }
      }

      edges.push({
        fromLane: lane,
        toLane,
        parentHash,
        type: isMerge ? 'merge' : 'direct',
        isSplit
      });
    });

    // After processing a commit, we can potentially free its lane
    // ONLY if it's not being continued by any of its parents
    const continuingLanes = parents.map(p => hashToLane[p]);
    if (!continuingLanes.includes(lane)) {
      activeLanes[lane] = null;
    }

    return {
      ...commit,
      lane,
      color,
      edges,
    };
  });

  return layout;
}

self.onmessage = function ({ data }) {
  try {
    if (data != null && !Array.isArray(data)) {
      throw new TypeError('Expected commits array');
    }
    const layout = computeLanes(data);
    self.postMessage({ success: true, layout });
  } catch (err) {
    self.postMessage({ success: false, error: err.message, stack: err.stack });
  }
};
