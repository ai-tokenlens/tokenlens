import { useState } from 'react'

export default function SkillEditor() {
  const [form, setForm] = useState({ name: '', description: '', tags: '' })

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO(spec): wire to POST /api/v1/skills once server endpoint exists
    alert(`Skill "${form.name}" ready to publish (API not wired yet)`)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-2xl font-bold">Publish Skill</h2>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <Field label="Name" name="name" value={form.name} onChange={handleChange} required />
        <Field label="Description" name="description" value={form.description} onChange={handleChange} />
        <Field label="Tags (comma-separated)" name="tags" value={form.tags} onChange={handleChange} />

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Publish
        </button>
      </form>
    </div>
  )
}

function Field({ label, name, value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}
