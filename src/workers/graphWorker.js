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
  // NOTE: Expects commits in topological order (children before parents).
  // Passing unsorted commits will produce incorrect lane assignments.
  if (!commits || commits.length === 0) return [];

  // Track which lanes are "active" (have an open branch tip)
  // activeLanes[lane] = hash of the commit that opened it (its child)
  const activeLanes = [];
  // parentToLane: hash → lane (set when we process a commit's children)
  const hashToLane = {};

  const layout = commits.map((commit) => {
    if (!commit) {
      throw new Error('Commit element is null or undefined');
    }
    const { hash, parents = [] } = commit;
    if (!hash) {
      throw new Error('Commit missing required "hash" property');
    }
    let lane;

    if (hashToLane[hash] !== undefined) {
      // This commit already has a lane reserved by its child
      lane = hashToLane[hash];
    } else {
      // Find the first free lane slot
      lane = activeLanes.findIndex((h) => h === null || h === undefined);
      if (lane === -1) lane = activeLanes.length;
    }

    activeLanes[lane] = hash;
    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length];

    // Build edge descriptors for this commit
    const edges = [];

    parents.forEach((parentHash, pIdx) => {
      // Validate parentHash exists before using it to avoid invalid edges/lanes
      if (!parentHash) return;

      if (pIdx === 0) {
        // First parent: continue in the same lane
        if (hashToLane[parentHash] === undefined) {
          hashToLane[parentHash] = lane;
        }
        edges.push({ fromLane: lane, toLane: hashToLane[parentHash] ?? lane, parentHash, type: 'direct' });
      } else {
        // Merge parent: find or allocate a lane for it
        let mergeLane = hashToLane[parentHash];
        if (mergeLane === undefined) {
          mergeLane = activeLanes.findIndex((h) => h === null || h === undefined);
          if (mergeLane === -1) mergeLane = activeLanes.length;
          hashToLane[parentHash] = mergeLane;
          activeLanes[mergeLane] = parentHash;
        }
        edges.push({ fromLane: lane, toLane: mergeLane, parentHash, type: 'merge' });
      }
    });

    // After processing, free the lane if it's not continued by the first parent
    // (This happens if it's a root commit or if it merges into an existing lane)
    const isContinued = parents.length > 0 && hashToLane[parents[0]] === lane;
    if (!isContinued) {
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
