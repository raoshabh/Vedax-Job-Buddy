import { useState, useEffect } from 'react';
import { Search, Loader2, MapPin, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import JobCard from '../components/JobCard';
import * as api from '../api/client';
import type { Job } from '../api/client';

function SkeletonJobCard() {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <div className="skeleton h-4 w-3/4 mb-2" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="skeleton h-3 w-2/3 mb-2" />
      <div className="skeleton h-3 w-1/2 mb-4" />
      <div className="skeleton h-9 w-full rounded-xl" />
    </div>
  );
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params: api.SearchJobsParams = {};
      if (query.trim()) params.query = query.trim();
      if (location.trim()) params.location = location.trim();
      if (salaryMin) params.salaryMin = Number(salaryMin);
      if (salaryMax) params.salaryMax = Number(salaryMax);

      const results = await api.searchJobs(params);
      setJobs(results);
      if (results.length === 0) {
        toast('No jobs found. Try adjusting your search criteria.', {
          icon: '🔍',
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to search jobs'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId: string) => {
    setApplyingId(jobId);
    try {
      await api.createApplication(jobId);
      toast.success('Application submitted!');
      // Remove the job from the list or mark it
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to apply'
      );
    } finally {
      setApplyingId(null);
    }
  };

  // Auto-search on mount using profile-based matching
  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Job Search</h1>
        <p className="text-sm text-slate-500 mt-1">
          Jobs matched to your profile
        </p>
      </div>

      {/* Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search job titles, skills..."
              className="input-field pl-9"
            />
          </div>
          <div className="relative sm:w-48">
            <MapPin
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Location"
              className="input-field pl-9"
            />
          </div>
          <div className="flex gap-2 sm:w-auto">
            <input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Min $"
              className="input-field w-24"
            />
            <input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Max $"
              className="input-field w-24"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
            Search Jobs
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonJobCard key={i} />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onApply={handleApply}
              applying={applyingId === job._id}
            />
          ))}
        </div>
      ) : searched ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No jobs found
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Set up your profile first to get AI-matched jobs, or try different
            search criteria.
          </p>
          <Link to="/profile" className="btn-primary inline-flex">
            Set Up Profile
          </Link>
        </div>
      ) : null}
    </div>
  );
}
