import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateSkill } from '../api/client.js'

export default function SkillEditor() {
  const navigate = useNavigate()
  const createSkill = useCreateSkill()
  const [form, setForm] = useState({
    id: '',
    name: '',
    summary: '',
    description: '',
    usage: '',
    tags: '',
    author: '',
    latest_version: '1.0.0',
  })
  const [error, setError] = useState(null)

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const tags = form.tags
      ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []
    try {
      await createSkill.mutateAsync({ ...form, tags, origin: 'local' })
      navigate('/skills')
    } catch (err) {
      setError(err?.response?.data?.detail ?? 'Failed to publish skill.')
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-2xl font-bold">Publish Skill</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <Field
          label="Skill ID"
          name="id"
          value={form.id}
          onChange={handleChange}
          required
          placeholder="my-skill-id"
        />
        <Field
          label="Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          placeholder="My Skill"
        />
        <Field
          label="Summary"
          name="summary"
          value={form.summary}
          onChange={handleChange}
          required
          placeholder="One-line description"
        />
        <Field
          label="Author"
          name="author"
          value={form.author}
          onChange={handleChange}
          placeholder="username"
        />
        <Field
          label="Version"
          name="latest_version"
          value={form.latest_version}
          onChange={handleChange}
          required
          placeholder="1.0.0"
        />
        <Field
          label="Tags (comma-separated)"
          name="tags"
          value={form.tags}
          onChange={handleChange}
          placeholder="llm, productivity"
        />
        <TextareaField
          label="Description"
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
          placeholder="Full description (Markdown supported)"
        />
        <TextareaField
          label="Usage Instructions"
          name="usage"
          value={form.usage}
          onChange={handleChange}
          rows={6}
          placeholder="How to use this skill (Markdown supported)"
        />

        <button
          type="submit"
          disabled={createSkill.isPending}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-40"
        >
          {createSkill.isPending ? 'Publishing…' : 'Publish'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, name, value, onChange, required, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}

function TextareaField({ label, name, value, onChange, rows, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
      />
    </div>
  )
}
