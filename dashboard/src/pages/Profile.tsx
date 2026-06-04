import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent, type DragEvent } from 'react';
import { Upload, X, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuthStore } from '../context/AuthContext';
import * as api from '../api/client';

const popularSkills = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
  'Java', 'SQL', 'AWS', 'Docker', 'Git',
  'GraphQL', 'REST API', 'MongoDB', 'PostgreSQL', 'Kubernetes',
];

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [targetCities, setTargetCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');
  const [salaryMin, setSalaryMin] = useState<number | ''>('');
  const [salaryMax, setSalaryMax] = useState<number | ''>('');
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [resumeFile, setResumeFile] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await api.getProfile();
        setTitle(profile.title || '');
        setSummary(profile.summary || '');
        setSkills(profile.skills || []);
        setTargetCities(profile.targetCities || []);
        setSalaryMin(profile.salaryMin ?? '');
        setSalaryMax(profile.salaryMax ?? '');
        setExperienceYears(profile.experienceYears ?? '');
        setResumeFile(profile.resumeFile || '');
      } catch {
        // Profile might not exist yet
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        title,
        summary,
        skills,
        targetCities,
        salaryMin: salaryMin === '' ? undefined : salaryMin,
        salaryMax: salaryMax === '' ? undefined : salaryMax,
        experienceYears: experienceYears === '' ? undefined : experienceYears,
      });
      toast.success('Profile saved successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  const addCity = (city: string) => {
    const trimmed = city.trim();
    if (trimmed && !targetCities.includes(trimmed)) {
      setTargetCities([...targetCities, trimmed]);
    }
    setCityInput('');
  };

  const removeCity = (city: string) => {
    setTargetCities(targetCities.filter((c) => c !== city));
  };

  const handleCityKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCity(cityInput);
    }
  };

  const handleFileUpload = async (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF, DOC, or DOCX file');
      return;
    }
    setUploading(true);
    try {
      const result = await api.uploadResume(file);
      setResumeFile(result.filename);
      toast.success('Resume uploaded!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-8 w-40 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="skeleton h-6 w-32 mb-4" />
            <div className="skeleton h-10 w-full mb-3" />
            <div className="skeleton h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Job Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Set up your preferences for AI-powered job search
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Info */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Personal Info
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                value={user?.name || ''}
                readOnly
                className="input-field bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="label">Professional Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Senior Frontend Engineer"
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Summary</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary of your experience and goals..."
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </div>
        </div>

        {/* Job Preferences */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Job Preferences
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Target Cities</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {targetCities.map((city) => (
                  <span
                    key={city}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-lg"
                  >
                    {city}
                    <button
                      type="button"
                      onClick={() => removeCity(city)}
                      className="hover:text-indigo-900"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={handleCityKeyDown}
                placeholder="Type a city and press Enter or comma"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Min Salary ($)</label>
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) =>
                    setSalaryMin(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="e.g., 80000"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Max Salary ($)</label>
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) =>
                    setSalaryMax(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="e.g., 150000"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label">Experience (years)</label>
              <input
                type="number"
                value={experienceYears}
                onChange={(e) =>
                  setExperienceYears(
                    e.target.value ? Number(e.target.value) : ''
                  )
                }
                placeholder="e.g., 5"
                className="input-field w-full sm:w-40"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Skills</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-lg"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="hover:text-emerald-900"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="Type a skill and press Enter"
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={() => addSkill(skillInput)}
              className="btn-secondary px-3"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="mt-3">
            <p className="text-xs text-slate-400 mb-2">Popular skills:</p>
            <div className="flex flex-wrap gap-1.5">
              {popularSkills
                .filter((s) => !skills.includes(s))
                .slice(0, 10)
                .map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => addSkill(skill)}
                    className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
                  >
                    + {skill}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Resume */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Resume</h3>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragActive
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
              className="hidden"
            />
            {uploading ? (
              <Loader2 size={32} className="mx-auto text-indigo-500 animate-spin" />
            ) : (
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
            )}
            <p className="text-sm font-medium text-slate-600 mt-2">
              {resumeFile
                ? `Current: ${resumeFile}`
                : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              PDF, DOC, or DOCX (max 5MB)
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 px-8"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
