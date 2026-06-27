import { useState } from 'react'

export default function RatingStars({ onSubmit, disabled }) {
  const [hover, setHover] = useState(0)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)

  const handleSubmit = async () => {
    if (!stars || pending) return
    setPending(true)
    try {
      await onSubmit({ stars, comment })
      setSubmitted(true)
    } finally {
      setPending(false)
    }
  }

  if (submitted) return <p className="text-green-600 text-sm">Rating submitted. Thank you!</p>

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => !disabled && setHover(0)}
            onClick={() => !disabled && setStars(n)}
            className={`text-2xl transition-colors leading-none ${
              n <= (hover || stars) ? 'text-amber-400' : 'text-gray-300'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
          >
            ★
          </button>
        ))}
      </div>

      {disabled ? (
        <p className="text-sm text-gray-400">Log in to rate this skill.</p>
      ) : (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!stars || pending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {pending ? 'Submitting…' : 'Submit'}
          </button>
        </>
      )}
    </div>
  )
}
