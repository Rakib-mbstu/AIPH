# Cycle I — Chat Page (Detailed Implementation Plan)

> Self-contained plan. Every file path, hook interface, and design decision is
> specified so an agent can execute without ambiguity.

---

## Goal

Build the Chat page — a context-aware AI conversation interface for DSA/system
design learning. The backend (`POST /api/chat` SSE, `GET /api/chat/history`) and
the client hook (`useChat`) are fully implemented. This cycle is purely a UI build
on top of the existing hook.

---

## Existing infrastructure (do NOT modify)

### `client/src/hooks/useChat.ts`

Already complete. Returns:

```ts
{
  messages: ChatMessage[],    // { id, role, content, pending? }
  isStreaming: boolean,
  error: string | null,
  send: (text: string) => Promise<void>,
  abort: () => void,
}
```

- Loads history on mount (`GET /api/chat/history`)
- `send(text)` appends user + empty assistant message, streams tokens via SSE
- `abort()` cancels the in-flight stream
- `pending: true` on the assistant message while streaming

### `client/src/lib/api.ts`

- `streamChat()` — async generator that yields delta strings from SSE
- `api.chatHistory(token, limit)` — fetches history

### Server

- `POST /api/chat` — SSE stream, persists both sides
- `GET /api/chat/history?limit=N` — last N messages (max 200)
- Chat context includes: weak areas, pattern mastery, recent patterns

---

## Step 1 — Install `react-markdown`

The AI returns responses with markdown formatting (code blocks, lists, bold,
inline code). We need a markdown renderer.

```bash
npm install react-markdown -w client
```

This is the **only new dependency** in this cycle.

---

## Step 2 — Create `client/src/pages/ChatPage.tsx`

### Page structure

```
┌──────────────────────────────────────────────────┐
│  AI Interview Coach                              │
│  ────────────────────────────────────────────── │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │                                          │    │
│  │  (scrollable message area)               │    │
│  │                                          │    │
│  │  ┌──────────────────────────────┐        │    │
│  │  │ User: How does binary search │        │    │
│  │  │ work on rotated arrays?      │        │    │
│  │  └──────────────────────────────┘        │    │
│  │                                          │    │
│  │  ┌──────────────────────────────┐        │    │
│  │  │ Assistant: Great question!   │        │    │
│  │  │ When dealing with a rotated  │        │    │
│  │  │ sorted array, the key        │        │    │
│  │  │ insight is...                │        │    │
│  │  │                              │        │    │
│  │  │ ```python                    │        │    │
│  │  │ def search(nums, target):    │        │    │
│  │  │   ...                        │        │    │
│  │  │ ```                          │        │    │
│  │  └──────────────────────────────┘        │    │
│  │                                          │    │
│  │  ┌──────────────────────────────┐        │    │
│  │  │ Assistant: ● (typing...)     │        │    │
│  │  └──────────────────────────────┘        │    │
│  │                                          │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  [  Type your message...            ] [→] │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Component breakdown

Single file: `client/src/pages/ChatPage.tsx`. Internal (non-exported) components:

1. **`ChatPage`** (default export) — wires `useChat`, manages input, auto-scroll
2. **`MessageBubble`** — renders a single message (user or assistant)
3. **`ChatInput`** — input bar with send/abort button

### Detailed requirements

#### ChatPage (default export)

- Call `useChat()` to get `{ messages, isStreaming, error, send, abort }`
- Fire `track('chat_viewed')` on mount
- Maintain a ref (`messagesEndRef`) for auto-scrolling
- Auto-scroll to bottom whenever `messages` array changes (use `useEffect` with
  `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`)

- **Layout structure:**
  ```
  <div className="flex flex-col h-full">      ← fills Layout content area
    <header>                                   ← fixed at top
    <div className="flex-1 overflow-y-auto">   ← scrollable message area
      {messages.map(...)}
      <div ref={messagesEndRef} />             ← scroll anchor
    </div>
    {error && <ErrorBanner />}                 ← error bar
    <ChatInput />                              ← fixed at bottom
  </div>
  ```

- **Header:** `<div className="px-6 py-4 border-b border-gray-200 bg-white">`
  - Title: `"AI Interview Coach"` (text-lg font-semibold)
  - Subtitle: `"Ask about DSA concepts, get approach feedback, or explore topics"`
    (text-sm text-gray-500)

- **Empty state:** When `messages.length === 0` and not loading, show a centered
  block with:
  - Heading: "Start a conversation"
  - Subtitle: "Ask about any DSA topic, algorithm, or system design concept."
  - 3-4 quick-start suggestion chips (clickable, calls `send()` on click):
    - "Explain sliding window technique"
    - "How does Dijkstra's algorithm work?"
    - "Compare BFS vs DFS approaches"
    - "Tips for dynamic programming problems"
  - Chips: `bg-white border border-gray-200 rounded-full px-4 py-2 text-sm
    text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer`

- **Error banner:** When `error` is non-null, show a dismissible banner above
  the input bar:
  `<div className="mx-6 mb-2 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg flex justify-between">`
  with the error text and an "×" dismiss button that clears the error (note:
  `useChat` doesn't expose a `clearError` — just render the banner conditionally,
  it will clear on next successful send)

#### MessageBubble

Props: `message: ChatMessage` (from useChat: `{ id, role, content, pending? }`)

- **User messages:**
  - Aligned right: `flex justify-end`
  - Bubble: `bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2
    max-w-[80%]`
  - Content: plain text (no markdown rendering needed for user messages)

- **Assistant messages:**
  - Aligned left: `flex justify-start`
  - Bubble: `bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3
    max-w-[80%] shadow-sm`
  - Content: render through `<ReactMarkdown>` (import from `react-markdown`)
  - Apply prose-like styling to the markdown container:
    `prose prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100
    prose-pre:rounded-lg prose-pre:p-3 prose-code:text-indigo-600
    prose-code:before:content-none prose-code:after:content-none`

    > **Important:** The `prose` classes require `@tailwindcss/typography`.
    > Check if it's installed. If NOT installed, do NOT install it — instead
    > apply manual styling:
    > - `[&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:rounded-lg
    >   [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre]:text-sm`
    > - `[&_code]:text-indigo-600 [&_code]:text-sm [&_code]:bg-gray-100
    >   [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded`
    > - `[&_pre_code]:text-gray-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0`
    > - `[&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4`
    > - `[&_p]:mb-2 [&_li]:mb-1`
    > - `[&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold
    >   [&_h3]:text-sm [&_h3]:font-semibold`

  - **Streaming indicator:** When `pending === true` AND `content === ''`, show a
    typing indicator instead of ReactMarkdown:
    `<span className="inline-flex gap-1"><span className="w-2 h-2 bg-gray-400
    rounded-full animate-bounce" /><span className="w-2 h-2 bg-gray-400
    rounded-full animate-bounce [animation-delay:0.15s]" /><span className="w-2
    h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" /></span>`

  - When `pending === true` AND `content !== ''`, render the partial content
    through ReactMarkdown normally (tokens are streaming in)

- **Spacing between messages:** `space-y-4` on the parent, plus `mt-6` when
  role changes from user to assistant or vice versa (group indicator)

#### ChatInput

Props: `onSend: (text: string) => void`, `onAbort: () => void`,
`isStreaming: boolean`

- Container: `<div className="px-6 py-4 border-t border-gray-200 bg-white">`

- Input: `<textarea>` (NOT `<input>`) so multiline messages work
  - `rows={1}` with auto-resize up to 4 rows:
    ```ts
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
      e.target.style.height = 'auto'
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    }
    ```
  - Placeholder: `"Ask about any DSA topic..."`
  - Styling: `w-full resize-none rounded-xl border border-gray-300 px-4 py-3
    pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500
    focus:border-transparent`

- **Send button** (positioned inside the textarea container, absolute right):
  - When NOT streaming: arrow icon or "Send" text, enabled when input is non-empty
  - When streaming: changes to "Stop" / square-stop icon, calls `onAbort`
  - Styling: `absolute right-3 bottom-3 p-1.5 rounded-lg`
  - Active: `bg-indigo-600 text-white hover:bg-indigo-700`
  - Disabled: `bg-gray-200 text-gray-400 cursor-not-allowed`

- **Send on Enter:** `onKeyDown` handler:
  - `Enter` (no shift) → submit (call `onSend(text)`, clear input, reset height)
  - `Shift+Enter` → newline (default behavior)
  - Don't submit if `isStreaming` or input is empty (whitespace-only)

- After sending, clear the textarea and reset its height to `rows={1}`

- Fire `track('chat_message_sent')` inside the `onSend` handler before calling
  the parent's `onSend`

---

## Step 3 — Update `client/src/App.tsx`

1. Import `ChatPage` from `./pages/ChatPage`.
2. Remove the commented-out `// import ChatPage` line.
3. Replace the chat route WIP placeholder:

```tsx
// Before:
<Route path="/chat" element={<ProtectedLayout><div className="p-8 text-gray-500">Chat — coming soon</div></ProtectedLayout>} />

// After:
<Route path="/chat" element={<ProtectedLayout><ChatPage /></ProtectedLayout>} />
```

> **Note:** If Cycle G hasn't been applied yet, wrap in `<SignedIn>` directly.

---

## Step 4 — Chat page height management

The chat page needs to fill the Layout's content area exactly — no page-level
scrollbar, just the message area scrolls. The page's container div must be
`h-full` (or `h-[calc(100vh-...)]`).

**Key:** The Layout's content area (`flex-1 overflow-y-auto`) needs to NOT
set `overflow-y-auto` for the chat page, or the chat page needs to manage its
own scroll context.

**Simplest approach:** Make the ChatPage root div `h-full flex flex-col` and
the message list `flex-1 overflow-y-auto`. This works because the Layout
content area has `min-h-screen` and the ChatPage fills it as a flex child.

If the chat page scrolls the outer container instead of just the message area,
adjust the Layout's content wrapper to `h-screen overflow-hidden` and have
each page opt into scrolling. BUT — this would affect RoadmapPage and
TrackerPage which currently scroll the whole page. **Do NOT change the Layout
for this.** Instead, make ChatPage use `h-[calc(100vh-<header-height>)]` or
similar to constrain itself.

**Recommended:** Use `h-[calc(100dvh-<offset>)]` on the ChatPage root where
offset accounts for the Layout sidebar header. This is fragile. Better: use
`flex flex-col` + `flex-1 min-h-0 overflow-y-auto` on the message area and
let the parent flexbox handle sizing. Test this during verification.

---

## Step 5 — Type-check

```bash
npm run type-check -w client
cd server && npx tsc --noEmit
```

### Common issues

- `react-markdown` types: the default export is a React component. Import as
  `import ReactMarkdown from 'react-markdown'`. If types are missing, install
  `@types/react-markdown` — but `react-markdown` v9+ bundles its own types,
  so this shouldn't be needed
- The `prose` Tailwind classes will be ignored if `@tailwindcss/typography` isn't
  installed — this is fine, use the manual `[&_pre]` approach described above

---

## Files touched

| File | Action |
|---|---|
| `client/src/pages/ChatPage.tsx` | **Create** |
| `client/src/App.tsx` | **Edit** — import + wire ChatPage |
| `client/package.json` | **Modified by npm install** (react-markdown) |
| `package-lock.json` | **Modified by npm install** |

---

## What NOT to do

- Do NOT modify `useChat.ts` — it's complete and tested
- Do NOT modify any server files
- Do NOT add syntax highlighting (e.g., `react-syntax-highlighter`) — it's a
  large dependency; plain `<pre><code>` with dark background is sufficient for MVP
- Do NOT implement chat history management (clear, delete, export)
- Do NOT add a topic selector or context switcher — the backend handles context
  automatically from the user's mastery/weakness data
- Do NOT store chat state in Zustand — the hook's local state is correct
- Do NOT add typing sound effects or animations beyond the bounce dots
- Do NOT lazy-load the ChatPage — premature for 4 routes

---

## Verification checklist

- [ ] `npm install` succeeds (react-markdown added)
- [ ] `npm run type-check -w client` passes
- [ ] `cd server && npx tsc --noEmit` passes
- [ ] Chat page renders with empty state and quick-start chips
- [ ] Clicking a quick-start chip sends that message
- [ ] User message appears on the right in indigo bubble
- [ ] Assistant response streams in on the left with typing indicator
- [ ] Markdown renders correctly: code blocks, lists, bold, inline code
- [ ] Code blocks have dark background and horizontal scroll
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Textarea auto-resizes up to 4 lines
- [ ] [Stop] button appears during streaming and aborts the stream
- [ ] Error banner appears on stream failure
- [ ] Auto-scroll follows new messages
- [ ] History loads on page mount (if there are prior messages)
- [ ] `chat_viewed` analytics event fires on mount
- [ ] `chat_message_sent` analytics event fires on send
