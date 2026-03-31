/**
 * GraphRenderer.jsx — DOM-row based Git commit graph.
 *
 * ARCHITECTURE ENFORCE:
 * 1. Rows and Nodes are standard HTML/DOM elements (divs).
 * 2. SVG layer is used EXCLUSIVELY for drawing the bezier branch lines behind the DOM.
 * 3. Blue theme (#3b82f6) used for selection and primary accents.
 */
import React, { useRef, useMemo, useState } from 'react';
import { useGitStore } from '../../hooks/gitStore';
import Tooltip from '../common/Tooltip';
import { useMobile } from '../../hooks/useMobile';

const ROW_H = 40;         
const LANE_W = 26;        
const LEFT_MARGIN = 26;   
const DOT_SIZE = 12;      

const BRANCH_COLORS = [
  '#a78bfa', // Lighter Purple (More vibrant)
  'var(--git-accent)', 
  '#10b981', // Success Green
  '#f59e0b', // Warning Amber
  '#3b82f6', // Bright Blue
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

function getColor(lane) {
  return BRANCH_COLORS[lane % BRANCH_COLORS.length];
}

function laneX(lane) {
  return LEFT_MARGIN + lane * LANE_W + LANE_W / 2;
}

/**
 * Reusable helper for formatting commit dates.
 * Returns '—' for missing/invalid dates, otherwise local date string.
 */
export function formatCommitDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function EdgePath({ fromLane, toLane, fromIdx, toIdx, isHovered, isSelected, isSplit }) {
  const x1 = laneX(fromLane), y1 = fromIdx * ROW_H + ROW_H / 2;
  const x2 = laneX(toLane),   y2 = toIdx * ROW_H + ROW_H / 2;
  const color = getColor(Math.min(fromLane, toLane));

  const dyIdx = Math.abs(toIdx - fromIdx);
  const curveness = 0.85;
  
  let d;
  if (dyIdx <= 1) {
    // Direct or adjacent row: Use a smooth S-curve
    const cp1y = y1 + (y2 - y1) * curveness;
    const cp2y = y2 - (y2 - y1) * curveness;
    d = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
  } else {
    // Multi-row path: Use a "stanchion" approach (straight line with curves at the ends)
    if (isSplit) {
      // Curve out from child at the start, then go straight down to parent
      const yTurn = y1 + ROW_H * 0.7;
      const cp1y = y1 + (yTurn - y1) * curveness;
      const cp2y = yTurn - (yTurn - y1) * curveness;
      d = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${yTurn} L ${x2} ${y2}`;
    } else {
      // Go straight down to just above parent, then curve in
      const yTurn = y2 - ROW_H * 0.7;
      const cp1y = yTurn + (y2 - yTurn) * curveness;
      const cp2y = y2 - (y2 - yTurn) * curveness;
      d = `M ${x1} ${y1} L ${x1} ${yTurn} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
    }
  }

  return (
    <path
      d={d}
      stroke={color}
      strokeWidth={isHovered ? "2" : "1.5"}
      fill="none"
      strokeOpacity={isHovered ? "0.8" : isSelected ? "0.6" : "0.3"}
      className="transition-all duration-200"
    />
  );
}

export default function GraphRenderer() {
  const labelAreaRefs = useRef({}); // Store refs for each row's label area
  const graphLayout = useGitStore(s => s.graphLayout);
  const graphTotal = useGitStore(s => s.graphTotal);
  const graphSkip = useGitStore(s => s.graphSkip);
  const loadingState = useGitStore(s => s.loadingState);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const selectCommit = useGitStore(s => s.selectCommit);
  const fetchGraph = useGitStore(s => s.fetchGraph);
  const setMobileView = useGitStore(s => s.setMobileView);
  const isMobile = useMobile();

  const [hoveredHash, setHoveredHash] = useState(null);
  const containerRef = useRef(null);

  // Maximum lanes for calculating total graph width
  const maxLane = useMemo(() =>
    graphLayout.reduce((m, c) => Math.max(m, c.lane || 0), 0),
    [graphLayout]
  );

  const lanesWidth = (maxLane + 1) * LANE_W + LEFT_MARGIN;

  const hashToIndex = useMemo(() => {
    const map = new Map();
    graphLayout.forEach((c, i) => map.set(c.hash, i));
    return map;
  }, [graphLayout]);

  // Helper for tooltip content
  const renderCommitTooltip = (commit) => {
    const d = new Date(commit.date);
    const isValid = !isNaN(d.getTime());
    
    // Relative time logic
    const getRelative = (date) => {
      const now = new Date();
      const diffMs = now - date;
      const sec = Math.floor(diffMs / 1000);
      if (sec < 60) return 'just now';
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const days = Math.floor(hr / 24);
      if (days < 30) return `${days}d ago`;
      return date.toLocaleDateString();
    };

    const formatEmail = (email) => {
      if (!email) return '—';
      const clean = email.replace(/^\d+\+/, '');
      if (clean.length <= 32) return clean;
      
      const atIdx = clean.indexOf('@');
      if (atIdx === -1) return clean.slice(0, 29) + '...';
      
      const local = clean.slice(0, atIdx);
      const domain = clean.slice(atIdx);
      const maxLocal = 32 - domain.length - 3;
      
      if (maxLocal > 0) {
        return local.slice(0, maxLocal) + '...' + domain;
      }
      return clean.slice(0, 29) + '...';
    };

    const fullDate = isValid ? d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) : '—';

    const relative = isValid ? getRelative(d) : '';

    return (
      <div className="flex flex-col gap-1.5 p-1 min-w-[340px]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider opacity-50 font-bold w-16">Author</span>
              <span className="text-sm font-semibold text-[var(--git-accent)]">{commit.author}</span>
            </div>
            {relative && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--git-accent)]/10 text-[var(--git-accent)] font-bold">
                {relative}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-80">
            <span className="w-16"></span>
            <span className="text-[11px] opacity-60 font-mono italic truncate">{formatEmail(commit.email)}</span>
          </div>
        </div>

        <div className="h-px bg-border/20 my-0.5" />

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider opacity-50 font-bold w-16">Committer</span>
            <span className="text-[13px] font-medium">{commit.committer || commit.author}</span>
          </div>
          <div className="flex items-center gap-2 opacity-80">
            <span className="w-16"></span>
            <span className="text-[11px] opacity-60 font-mono italic truncate">{formatEmail(commit.committerEmail || commit.email)}</span>
          </div>
        </div>

        <div className="h-px bg-border/20 my-0.5" />

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider opacity-50 font-bold w-16">Date</span>
          <span className="text-[12px] font-mono">{fullDate}</span>
        </div>

        <div className="mt-1 pt-1.5 border-t border-border/30">
          <code className="text-[13px] font-bold text-[var(--git-accent)] opacity-80 break-all block font-mono bg-black/20 px-2 py-1.5 rounded tracking-tight">
            {commit.hash}
          </code>
        </div>
      </div>
    );
  };

  // Infinite scroll handler
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (atBottom && graphLayout.length < graphTotal && !loadingState.loadingGraph) {
      fetchGraph(graphSkip + 200);
    }
  };

  if (!graphLayout.length && !loadingState.loadingGraph) {
    return <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-secondary)] bg-[var(--bg-base)]">No commits found</div>;
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-auto bg-[var(--bg-surface)] relative scrollbar-none transition-colors"
    >
      {/* ── 1. SVG Layer (Background Lines) ── */}
      <svg
        width={lanesWidth}
        height={graphLayout.length * ROW_H}
        className="absolute top-0 left-0 pointer-events-none z-0"
      >
        {graphLayout.map((commit, idx) => {
          if (!commit.edges) return null;
          const isRowHovered = hoveredHash === commit.hash;
          const isSelected = selectedCommit === commit.hash;

          return commit.edges.map((edge, ei) => {
            const targetIdx = hashToIndex.get(edge.parentHash);
            if (targetIdx === undefined) return null;

            const color = getColor(edge.fromLane);
            const isLineHovered = isRowHovered || hoveredHash === edge.parentHash;

            if (edge.fromLane === edge.toLane) {
              const x = laneX(edge.fromLane);
              return (
                <line
                  key={`${commit.hash}-e${ei}`}
                  x1={x} y1={idx * ROW_H + ROW_H / 2}
                  x2={x} y2={targetIdx * ROW_H + ROW_H / 2}
                  stroke={color}
                  strokeWidth={isLineHovered ? "2" : "1.5"}
                  strokeOpacity={isLineHovered ? "0.8" : isSelected ? "0.6" : "0.3"}
                  className="transition-all duration-200"
                />
              );
            }
            return (
              <EdgePath
                key={`${commit.hash}-e${ei}`}
                fromLane={edge.fromLane}
                toLane={edge.toLane}
                fromIdx={idx}
                toIdx={targetIdx}
                isHovered={isLineHovered}
                isSelected={isSelected}
                isSplit={edge.isSplit}
              />
            );
          });
        })}
      </svg>

      {/* ── 2. DOM Layer (Rows and Nodes) ── */}
      <div className="flex flex-col min-w-max z-10 relative pb-20">
        {graphLayout.map((commit, idx) => {
          const isSelected = commit.hash === selectedCommit;
          const isHovered = commit.hash === hoveredHash;
          const color = commit.color || getColor(commit.lane || 0);

          return (
            <Tooltip 
              key={commit.hash}
              label={renderCommitTooltip(commit)}
              anchorRef={{ current: labelAreaRefs.current[commit.hash] }}
              align="left"
              contentClassName="max-w-none !p-3 !bg-[var(--bg-base)] !border-border/40 shadow-2xl"
            >
              <div
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                onClick={() => {
                  const newHash = isSelected ? null : commit.hash;
                  selectCommit(newHash);
                  if (isMobile && newHash) setMobileView('diff');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const newHash = isSelected ? null : commit.hash;
                    selectCommit(newHash);
                    if (isMobile && newHash) setMobileView('diff');
                  }
                }}
                onMouseEnter={() => setHoveredHash(commit.hash)}
                onMouseLeave={() => setHoveredHash(null)}
                style={{ height: `${ROW_H}px` }}
                className={`flex items-center group cursor-pointer transition-all duration-200 border-b border-border/10
                  ${isSelected ? 'bg-[var(--git-accent)]/10' : isHovered ? 'bg-[var(--git-accent)]/5' : ''}`}
              >
                {/* Lane Area */}
                <div style={{ width: `${lanesWidth}px` }} className="relative h-full flex-shrink-0 border-r border-border/30">
                  {/* DOM Node (Circle) */}
                  <div
                    style={{
                      left: `${laneX(commit.lane) - DOT_SIZE / 2}px`,
                      top: `${ROW_H / 2 - DOT_SIZE / 2}px`,
                      backgroundColor: isSelected || isHovered ? color : 'var(--bg-base)',
                      borderColor: color,
                      borderWidth: '2px',
                      width: `${DOT_SIZE}px`,
                      height: `${DOT_SIZE}px`,
                      boxShadow: isHovered ? `0 0 8px ${color}40` : 'none'
                    }}
                    className="absolute rounded-full z-20 transition-all duration-200"
                  >
                    {/* Selection glow */}
                    {isSelected && (
                      <div
                        className="absolute inset-[-4px] rounded-full animate-pulse opacity-20"
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </div>
                </div>

                {/* Label Area */}
                <div className="flex items-center gap-4 px-2 min-w-0 pr-8">
                  {/* Hash */}
                  <span className={`text-xs font-mono w-[72px] flex-shrink-0 transition-colors duration-200 ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                    {commit.hash.slice(0, 7)}
                  </span>

                  {/* Message */}
                  <span 
                    ref={el => labelAreaRefs.current[commit.hash] = el}
                    className={`text-sm truncate max-w-xl transition-all duration-200 ${isSelected ? 'text-[var(--text-primary)] font-bold' : isHovered ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {commit.message}
                  </span>

                  {/* Ref Badges */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {commit.refs?.map((ref, ri) => {
                      const isHEAD = ref.type === 'HEAD' || ref.type === 'HEAD_DETACHED';
                      const isTag = ref.type === 'tag';
                      const isRemote = ref.type === 'remote';
                      const badgeColor = isHEAD ? 'var(--accent)' : isTag ? 'var(--warning, #f59e0b)' : isRemote ? 'var(--success, #10b981)' : '#06b6d4';

                      return (
                        <div
                          key={`${commit.hash}-ref-${ri}`}
                          className="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all duration-200"
                          style={{
                            backgroundColor: badgeColor.startsWith('var') 
                              ? `color-mix(in srgb, ${badgeColor} 15%, transparent)` 
                              : `${badgeColor}15`,
                            color: badgeColor,
                          }}
                        >
                          {isHEAD ? '◉ ' : isTag ? '🏷 ' : ''}{ref.name}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timestamp on far right */}
                <div className={`ml-auto px-4 text-[9px] font-mono transition-all duration-300 ${isHovered || isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`} style={{ color: 'var(--text-secondary)' }}>
                  {formatCommitDate(commit.date)}
                </div>
              </div>
            </Tooltip>
          );
        })}

        {/* Loading Spinner */}
        {loadingState.loadingGraph && (
          <div className="p-4 flex items-center justify-center gap-3 text-[10px] text-[var(--text-secondary)] font-mono uppercase tracking-widest bg-[var(--bg-base)]">
            <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            Synchronizing...
          </div>
        )}
      </div>
    </div>
  );
}
