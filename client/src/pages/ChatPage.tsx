import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat, type ChatMessage } from '../hooks/useChat'
import { track } from '../lib/analytics'

// ─── MessageBubble ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
    </span>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] shadow-sm text-sm">
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
              '[&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:rounded-lg',
              '[&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre]:text-xs',
              '[&_pre_code]:text-gray-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
              '[&_code]:text-indigo-600 [&_code]:text-xs [&_code]:bg-gray-100',
              '[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
              '[&_strong]:font-semibold',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300',
              '[&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_blockquote]:italic',
            ].join(' ')}
          >
            <ReactMarkdown>{message.content}</ReactMarkdown>
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

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return
    track('chat_message_sent')
    onSend(trimmed)
    setText('')
    resetHeight()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = text.trim().length > 0 && !isStreaming

  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-white">
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any DSA topic..."
          className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          onClick={isStreaming ? onAbort : handleSend}
          disabled={!isStreaming && !canSend}
          className={[
            'absolute right-3 bottom-3 p-1.5 rounded-lg transition-colors text-xs font-medium min-w-[2rem]',
            isStreaming
              ? 'bg-red-500 text-white hover:bg-red-600'
              : canSend
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          {isStreaming ? '■' : '→'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  )
}

// ─── Quick-start chips ────────────────────────────────────────────────────────

const QUICK_STARTS = [
  'Explain sliding window technique',
  'How does Dijkstra\'s algorithm work?',
  'Compare BFS vs DFS approaches',
  'Tips for dynamic programming problems',
]

// ─── ChatPage ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { messages, isStreaming, error, send, abort } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [errorDismissed, setErrorDismissed] = useState(false)

  useEffect(() => {
    document.title = 'Chat | AIPH'
    track('chat_viewed')
  }, [])

  // Reset dismissed state when a new error arrives
  useEffect(() => {
    if (error) setErrorDismissed(false)
  }, [error])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showError = error && !errorDismissed

  return (
    <div className="flex flex-col h-[calc(100dvh-0px)] md:h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">AI Interview Coach</h1>
        <p className="text-sm text-gray-500">
          Ask about DSA concepts, get approach feedback, or explore topics
        </p>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
            <h2 className="text-lg font-semibold text-gray-700">Start a conversation</h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Ask about any DSA topic, algorithm, or system design concept.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {QUICK_STARTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer"
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
        <div className="mx-6 mb-2 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg flex justify-between items-center shrink-0">
          <span>{error}</span>
          <button
            onClick={() => setErrorDismissed(true)}
            className="ml-4 text-red-500 hover:text-red-700 font-medium"
          >
            ×
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 pb-16 md:pb-0">
        <ChatInput onSend={send} onAbort={abort} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
