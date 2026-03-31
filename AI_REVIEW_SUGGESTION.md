# AI Code Review Tab: Feature Proposal & Implementation Guide

This document outlines the architecture and layout for a dedicated **AI Review Tab** in your Gemini-CLI-UI project. This feature moves the "AI Review" logic from a simple popup into a professional, data-rich dashboard.

## 1. UI Layout (The "Bento" Dashboard)

This layout should be implemented in a new component: `src/components/AIReviewTab.jsx`.

```text
+----------------------------------------------------------------------------------+
| [Header: Gemini Code UI]          [Chat | IDE | Review* | Shell | Git | Preview] |
+------------------------+------------------------------------+--------------------+
| 📂 STAGED FILES        | 🧠 AI ANALYSIS DASHBOARD           | 📄 DIFF VIEW       |
|------------------------|------------------------------------|--------------------|
| > src/auth.js (+12/-2) | +--------------------------------+ | @@ -10,6 +10,7 @@ |
| > src/db.js   (+4/-0)  | |  [ 8.5/10 ]  | EXCELLENT SCORE | | -  hasUsers()    |
|                        | +--------------------------------+ | +  await hasUsers()|
| [ Analyze Button ]     |                                    |                    |
|                        | [ 📝 SUMMARY ]                     | [ LINE COMMENTS ]  |
|                        | "The changes improve async safety  | L12: Missing await |
|                        | but could use more error handling."| L45: Perf loss     |
|                        |                                    |                    |
|                        | [ 🚨 ISSUES ]    [ ✅ SUGGESTIONS ]|                    |
|                        | - Error at L12   - Use .map() here |                    |
|                        | - Missing await  - Add Type check   |                    |
+------------------------+------------------------------------+--------------------+
```

## 2. Backend Implementation (`server/routes/git.js`)

We need to add a specialized endpoint that doesn't just generate a commit message, but performs a **full code audit**.

```javascript
// POST /api/git/review-changes
router.post('/review-changes', authenticateToken, async (req, res) => {
  const { projectPath, files } = req.body;
  
  // 1. Get the Full Diff for the staged files
  const combinedDiff = execSync(`git -C "${projectPath}" diff --cached`, { encoding: 'utf-8' });
  
  // 2. CodeRabbit-Style "Senior Staff Engineer" System Prompt
  const systemPrompt = `
# Role: Senior Staff Software Engineer (Code Auditor)
You are an elite developer acting as a primary code reviewer. Your goal is to improve code quality, maintain architectural integrity, and minimize technical debt.

## Review Philosophy:
- **High Signal-to-Noise:** ONLY comment on substantive issues (bugs, security risks, performance bottlenecks).
- **Avoid Nitpicking:** Ignore trivial stylistic or formatting issues (Prettier handles these).
- **Actionable Feedback:** Every suggestion must include the "why" and a concrete code snippet for "how".

## Your Tasks:
1. **Critical Focus:** Prioritize security vulnerabilities, race conditions, and incorrect business logic.
2. **Architecture:** Suggest structural improvements for modularity and testability.
3. **Tone:** Professional, direct, and collaborative.

Respond ONLY with a JSON object:
{
  "score": number (0-10),
  "summary": "2-3 sentence overview of intent/impact",
  "issues": [{"message": string, "severity": "error|warning|info", "line": number}],
  "suggestions": [string]
}

DIFF TO ANALYZE:
${combinedDiff}`;

  // 3. Call Gemini with the high-signal prompt
  const review = await reviewCodeChanges(systemPrompt);
  res.json({ review });
});
```

## 3. Frontend Integration

### Step A: Update `App.jsx`
Add `'review'` to the `activeTab` states and add a condition in `MainContent` to render `<AIReviewTab />` when selected.

### Step B: Update `FloatingNav.jsx`
Add the "Sparkles" icon to the top navigation bar.

### Step C: `AIReviewTab.jsx` Component
Use a 3-pane Grid layout with `lucide-react` icons.

```javascript
// src/components/AIReviewTab.jsx
export default function AIReviewTab({ selectedProject }) {
  const [review, setReview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // 1. fetch staged files on mount
  // 2. call backend /api/git/review-changes
  // 3. render 3-pane layout
}
```

## 4. Why this is better than "Project 7001":
1. **Focus**: 7001 uses a modal that blocks the UI. This tab allows you to keep the review open while you jump to the IDE to fix bugs.
2. **Context**: By adding the **Diff View** in the same tab, you can see exactly where the AI is pointing without switching context.
3. **Complexity**: We will integrate the `analyzeCodeComplexity` metric directly into the Score Card.
