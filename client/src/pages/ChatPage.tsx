import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat, type ChatMessage } from '../hooks/useChat'
import { HistoryDropdown } from '../components/chat/HistoryDropdown'
import { track } from '../lib/analytics'

// ─── Icons ────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <rect x="4" y="4" width="12" height="12" rx="2" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}

// ─── Copyable code block ──────────────────────────────────────────────────────

function CopyableCodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)

  let codeText = ''
  let language = ''
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === 'code') {
      const p = child.props as { className?: string; children?: React.ReactNode }
      codeText = String(p.children ?? '').replace(/\n$/, '')
      language = (p.className ?? '').replace('language-', '')
    }
  })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable (non-HTTPS dev environment)
    }
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-700 text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5">
        <span className="text-gray-400 font-mono">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className={[
            'flex items-center gap-1.5 font-medium transition-colors',
            copied ? 'text-green-400' : 'text-gray-400 hover:text-white',
          ].join(' ')}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Code body */}
      <pre className="bg-gray-950 text-gray-100 px-4 py-3 overflow-x-auto m-0 leading-relaxed">
        {children}
      </pre>
    </div>
  )
}

// ─── Markdown renderer config ─────────────────────────────────────────────────

const markdownComponents = {
  pre: CopyableCodeBlock,
  // Inline code — keep it styled but don't add copy to single backticks
  code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    // If className has a language- prefix it's a block code inside <pre>
    // (react-markdown wraps block code in both pre and code)
    const isBlock = (className ?? '').startsWith('language-')
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>
    }
    return (
      <code
        className="text-indigo-600 text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono"
        {...props}
      >
        {children}
      </code>
    )
  },
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
    </span>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%] shadow-sm text-sm leading-relaxed">
        {message.pending && message.content === '' ? (
          <TypingDots />
        ) : (
          <div
            className={[
              '[&_p]:mb-2 [&_p:last-child]:mb-0',
              '[&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-2',
              '[&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-2',
              '[&_li]:mb-1',
              '[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2',
              '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-1',
              '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1',
              '[&_strong]:font-semibold',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300',
              '[&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_blockquote]:italic',
            ].join(' ')}
          >
            <ReactMarkdown components={markdownComponents as any}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ChatInput ────────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onAbort,
  isStreaming,
}: {
  onSend: (text: string) => void
  onAbort: () => void
  isStreaming: boolean
}) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const syncHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    syncHeight(e.target)
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return
    track('chat_message_sent')
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = text.trim().length > 0 && !isStreaming

  return (
    <div className="px-4 py-3 bg-white/80 backdrop-blur-sm">
      {/* Input card */}
      <div
        className={[
          'relative bg-white rounded-2xl border shadow-md transition-all duration-150',
          'focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-400',
          'border-gray-300',
        ].join(' ')}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any DSA topic, algorithm, or system design…"
          disabled={isStreaming && text.trim() === ''}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-12 text-sm text-gray-900 placeholder-gray-400 focus:outline-none rounded-2xl"
          style={{ maxHeight: '160px' }}
        />

        {/* Bottom bar inside the card */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 rounded-b-2xl">
          <span className="text-xs text-gray-400 select-none">
            {isStreaming
              ? 'Responding…'
              : 'Enter to send · Shift+Enter for newline'}
          </span>

          <div className="flex items-center gap-2">
            {text.length > 180 && (
              <span className={`text-xs tabular-nums ${text.length > 1000 ? 'text-red-400' : 'text-gray-400'}`}>
                {text.length}
              </span>
            )}
            <button
              onClick={isStreaming ? onAbort : handleSend}
              disabled={!isStreaming && !canSend}
              title={isStreaming ? 'Stop' : 'Send'}
              className={[
                'flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 shadow-sm',
                isStreaming
                  ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                  : canSend
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {isStreaming ? <StopIcon /> : <SendIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick-start chips ────────────────────────────────────────────────────────

const QUICK_STARTS = [
  'Explain the sliding window technique',
  "How does Dijkstra's algorithm work?",
  'Compare BFS vs DFS with examples',
  'Tips for dynamic programming problems',
]

// ─── ChatPage ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const {
    sessions,
    activeSessionId,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isStreaming,
    error,
    send,
    abort,
    newChat,
    loadSession,
  } = useChat()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    document.title = 'Chat | AIPH'
    track('chat_viewed')
  }, [])

  useEffect(() => {
    if (error) setErrorDismissed(false)
  }, [error])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showError = error && !errorDismissed

  // Active session title for the header
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div className="flex flex-col h-[calc(100dvh-0px)] md:h-screen bg-gray-50">

      {/* Header */}
      <div
        ref={headerRef}
        className="px-4 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3 relative"
      >
        {/* History dropdown trigger */}
        <div className="relative">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setDropdownOpen(open => !open)}
            className={[
              'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
              dropdownOpen
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900',
            ].join(' ')}
          >
            {/* Hamburger / history icon */}
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
            History
            <svg viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          <HistoryDropdown
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={isLoadingSessions}
            isOpen={dropdownOpen}
            onClose={() => setDropdownOpen(false)}
            onSelect={(id) => { loadSession(id); setDropdownOpen(false) }}
            onNewChat={() => { newChat(); setDropdownOpen(false) }}
          />
        </div>

        {/* Active session title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">
            {activeSession ? activeSession.title : 'AI Interview Coach'}
          </h1>
          {!activeSession && (
            <p className="text-xs text-gray-500">DSA · Algorithms · System Design</p>
          )}
        </div>

        {/* New chat shortcut */}
        <button
          onClick={() => newChat()}
          title="New chat"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200 hover:border-indigo-200 shrink-0"
        >
          <PlusIcon />
          New
        </button>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 min-h-0 relative">

        {/* Session-switch loading overlay */}
        {isLoadingMessages && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
            <div className="flex gap-1.5">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isStreaming && !isLoadingMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-12 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Start a conversation</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ask about any algorithm, pattern, or system design concept.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_STARTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {showError && (
        <div className="mx-4 mb-1 px-4 py-2.5 bg-red-50 text-red-700 text-sm rounded-xl flex justify-between items-center border border-red-100 shrink-0">
          <span>{error}</span>
          <button
            onClick={() => setErrorDismissed(true)}
            className="ml-4 text-red-400 hover:text-red-600 font-bold text-base leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 pb-16 md:pb-0">
        <ChatInput onSend={send} onAbort={abort} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
