import { useState, useEffect } from 'react';
import { Mic, Sparkles, ChevronRight, Lightbulb, CheckCircle2 } from 'lucide-react';
import './InputForm.css';
import API_BASE from '../config';

const DEPARTMENTS = [
  'Engineering', 'Human Resources', 'Marketing', 'Sales',
  'Finance', 'Operations', 'Design', 'Product', 'Legal', 'Other'
];

const EXPERIENCE_LEVELS = [
  'Fresher', '1-3 years', '3-5 years', '5-8 years', '8+ years'
];

const EMPLOYMENT_TYPES = [
  'Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'
];

const RECOMMENDED_SKILLS = [
  'TypeScript', 'Express.js', 'Next.js', 'HTML', 'CSS', 'Git', 'REST APIs'
];

const POPULAR_TITLES = [
  'Software Engineer', 'Frontend Developer', 'Full Stack Developer',
  'Backend Developer', 'Data Analyst'
];

function InputForm({ onGenerate, initialData }) {
  const [formData, setFormData] = useState({
    job_title: '',
    department: '',
    experience: '',
    employment_type: '',
    nature_of_job: '',
    location: '',
    skills: [],
    company_name: '',
    additional_info: '',
    reporting_to: '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser.');
      return;
    }
    if (isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setFormData(prev => ({
        ...prev,
        additional_info: prev.additional_info ? prev.additional_info + ' ' + transcript : transcript
      }));
    };
    
    recognition.onerror = (event) => {
      console.error('Speech error', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  useEffect(() => {
    if (initialData && initialData.job_title) {
      setFormData((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  const addSkill = (skill) => {
    const trimmed = skill.trim();
    if (trimmed && !formData.skills.includes(trimmed)) {
      setFormData({ ...formData, skills: [...formData.skills, trimmed] });
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skillToRemove),
    });
  };

  const handleTitleClick = (title) => {
    setFormData({ ...formData, job_title: title });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.job_title.trim()) {
      setError('Please enter a Job Title.');
      return;
    }
    setLoading(true);
    
    console.log('Sending to API:', {
      job_title: formData.job_title,
      industry: formData.industry,
      skills: formData.skills,
      nature_of_job: formData.nature_of_job,
      reporting_to: formData.reporting_to
    });
    
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: formData.job_title,
          industry: formData.industry,
          department: formData.department,
          experience: formData.experience,
          employment_type: formData.employment_type,
          nature_of_job: formData.nature_of_job,
          location: formData.location,
          skills: formData.skills.join(', '),
          company_name: formData.company_name,
          reporting_to: formData.reporting_to,
          tone: formData.tone || 'Formal',
          additional_notes: formData.additional_info
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        onGenerate(data.jd, formData);
      }
    } catch (err) {
      setError('Failed to connect to the backend server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="input-form-page">
      <div className="form-area">
        <div className="page-header">
          <h2>Create a Job Description</h2>
          <p>Fill in the details below and let AI generate a professional job description for you.</p>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          {/* Row 1: Job Title + Voice */}
          <div className="form-row">
            <div className="title-row">
              <div className="form-group">
                <label htmlFor="job_title">Job Title <span className="required">*</span></label>
                <input
                  type="text"
                  id="job_title"
                  name="job_title"
                  placeholder="e.g. Software Engineer"
                  value={formData.job_title}
                  onChange={handleChange}
                />
              </div>
              <button type="button" className="voice-btn" id="voice-btn" onClick={toggleVoiceInput} style={{ background: isListening ? '#FEF2F2' : '', color: isListening ? '#DC2626' : '', borderColor: isListening ? '#FECACA' : '' }}>
                <Mic className="voice-icon" style={{ animation: isListening ? 'pulse 1.5s infinite' : 'none' }} />
                {isListening ? 'Listening...' : 'Use Voice Input'}
              </button>
            </div>
          </div>

          {/* Row 2: Industry | Department | Reporting To */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="industry">Industry</label>
              <input type="text" id="industry" name="industry" placeholder="e.g. Technology" value={formData.industry} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input type="text" id="department" name="department" placeholder="e.g. Engineering" value={formData.department} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="reporting_to">Reporting To</label>
              <input
                type="text"
                id="reporting_to"
                name="reporting_to"
                placeholder="e.g. Senior Engineering Manager"
                value={formData.reporting_to}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 3: Employment Type | Nature of Job | Location */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employment_type">Employment Type</label>
              <select id="employment_type" name="employment_type" value={formData.employment_type} onChange={handleChange}>
                <option value="">Select employment type</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="nature_of_job">Nature of Job</label>
              <select id="nature_of_job" name="nature_of_job" value={formData.nature_of_job} onChange={handleChange}>
                <option value="">Select work mode</option>
                <option value="On-site">On-site (Work from office full time)</option>
                <option value="Remote">Remote (Work from home full time)</option>
                <option value="Hybrid">Hybrid (Mix of office and home)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="location">Job Location</label>
              <input type="text" id="location" name="location" placeholder="e.g. Bangalore, India" value={formData.location} onChange={handleChange} />
            </div>
          </div>

          {/* Row 4: Required Skills */}
          <div className="form-row" style={{ flexDirection: 'column' }}>
            <div className="form-group full-width">
              <label htmlFor="skills-input">Required Skills</label>
              <div className="tag-input-wrapper" onClick={() => document.getElementById('skills-input').focus()}>
                {formData.skills.map((skill) => (
                  <span className="tag" key={skill}>
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>×</button>
                  </span>
                ))}
                <input
                  type="text"
                  id="skills-input"
                  className="tag-input-field"
                  placeholder={formData.skills.length === 0 ? 'Add skills and press Enter' : ''}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                />
              </div>
            </div>
          </div>

          {/* Row 5: Company Name */}
          <div className="form-row" style={{ flexDirection: 'column' }}>
            <div className="form-group full-width">
              <label htmlFor="company_name">Company Name</label>
              <input type="text" id="company_name" name="company_name" placeholder="e.g. TechNova Solutions" value={formData.company_name} onChange={handleChange} />
            </div>
          </div>

          {/* Row 6: Additional Information */}
          <div className="form-row" style={{ flexDirection: 'column' }}>
            <div className="form-group full-width">
              <label htmlFor="additional_info">Additional Information <span className="optional-tag">(Optional)</span></label>
              <div className="textarea-wrapper">
                <textarea
                  id="additional_info"
                  name="additional_info"
                  placeholder="Add any specific requirements, responsibilities, or preferences..."
                  value={formData.additional_info}
                  onChange={(e) => { if (e.target.value.length <= 500) handleChange(e); }}
                  maxLength={500}
                />
                <span className="char-counter">{formData.additional_info.length}/500</span>
              </div>
            </div>
          </div>

          <div className="generate-btn-wrapper">
            <button type="submit" className="generate-btn" disabled={loading} id="generate-btn">
              {loading ? (
                <><span className="btn-spinner"></span> Generating...</>
              ) : (
                <><Sparkles className="btn-icon" /> Generate Job Description</>
              )}
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}
        </form>
      </div>

      {/* ── Right Panel: AI Suggestions ── */}
      <div className="suggestions-panel">
        <div className="suggestion-card">
          <div className="card-title purple">
            <Sparkles className="card-icon" /> AI Suggestions
          </div>
          <div className="recommended-label">Recommended Skills</div>
          <div className="skill-tags">
            {RECOMMENDED_SKILLS.map((skill) => (
              <span className="skill-tag" key={skill} onClick={() => addSkill(skill)}>{skill}</span>
            ))}
          </div>
        </div>

        <div className="suggestion-card">
          <div className="card-title">Popular Job Titles</div>
          <div className="job-title-list">
            {POPULAR_TITLES.map((title) => (
              <div className="job-title-item" key={title} onClick={() => handleTitleClick(title)}>
                <span>{title}</span>
                <ChevronRight className="arrow" />
              </div>
            ))}
          </div>
          <button type="button" className="view-all-link">View all templates →</button>
        </div>

        <div className="suggestion-card">
          <div className="card-title">
            <Lightbulb className="card-icon" /> Tips for Better Results
          </div>
          <div className="tips-list">
            <div className="tip-item"><CheckCircle2 className="tip-icon" /><span>Be specific about the role and requirements</span></div>
            <div className="tip-item"><CheckCircle2 className="tip-icon" /><span>Add must-have skills and experience</span></div>
            <div className="tip-item"><CheckCircle2 className="tip-icon" /><span>Include company and job location</span></div>
            <div className="tip-item"><CheckCircle2 className="tip-icon" /><span>More details = better AI output</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InputForm;
