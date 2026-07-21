import { useState, useEffect } from 'react';
import { Search, Eye, Download, Trash2, Building2, Calendar } from 'lucide-react';
import './Pages.css';

import API_BASE from '../config';

function SavedJDs({ onNavigate, onJDLoad }) {
  const [jds, setJds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');

  useEffect(() => { fetchJDs(); }, []);

  const fetchJDs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/saved`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setJds(await res.json());
    } catch (err) { console.error('Failed to fetch JDs:', err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this JD? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/saved/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setJds(prev => prev.filter(j => j.id !== id));
    } catch (err) { console.error('Delete failed:', err); }
  };

  const handleView = (jd) => {
    onJDLoad(jd.jd_text, { job_title: jd.job_title, company_name: jd.company_name, industry: jd.industry });
    onNavigate('output');
  };

  const handleDownloadPDF = async (jd) => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = document.createElement('div');
      el.style.cssText = 'font-family: Inter, sans-serif; padding: 40px; color: #2F2F2F; width: 750px;';
      el.innerHTML = `
        <div style="text-align:center; border-bottom: 3px solid #E8510A; padding-bottom: 20px; margin-bottom: 24px;">
          <div style="font-family: Poppins, sans-serif; font-size: 26px; font-weight: 900; color: #E8510A; margin-bottom: 4px;">AmbiDer</div>
          <div style="font-size: 13px; color: #6B7280;">ADVISORS & MANAGEMENT CONSULTANTS LLP</div>
        </div>
        <div style="font-size:22px;font-weight:700;color:#2F2F2F;margin-bottom:8px;">${jd.job_title}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
          ${jd.company_name ? `<span style="font-size:13px;color:#6B7280;">Company: <strong>${jd.company_name}</strong></span>` : ''}
          ${jd.industry ? `<span style="font-size:13px;color:#6B7280;">Industry: <strong>${jd.industry}</strong></span>` : ''}
          <span style="font-size:13px;color:#6B7280;">Generated: <strong>${new Date(jd.created_at).toLocaleDateString()}</strong></span>
        </div>
        <div style="white-space:pre-wrap;font-size:13px;line-height:1.7;color:#374151;">${jd.jd_text}</div>
        <div style="margin-top:40px;padding-top:16px;border-top:1px solid #FDDECE;font-size:11px;color:#9CA3AF;text-align:center;">
          AmbiDer Advisors & Management Consultants LLP | ambider.com
        </div>`;
      document.body.appendChild(el);
      await html2pdf().set({ margin: 0.75, filename: `${jd.job_title.replace(/\s+/g, '_')}_JD.pdf`, html2canvas: { scale: 2 }, jsPDF: { format: 'a4' } }).from(el).save();
      document.body.removeChild(el);
    } catch (err) { alert('PDF generation failed. Please use the View button and download from the Output Page.'); }
  };

  const industries = [...new Set(jds.map(j => j.industry).filter(Boolean))];

  const filteredJDs = jds.filter(jd =>
    ((jd.job_title || '').toLowerCase().includes(search.toLowerCase()) ||
     (jd.company_name || '').toLowerCase().includes(search.toLowerCase())) &&
    (!industryFilter || jd.industry === industryFilter)
  );

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h2>Saved Job Descriptions</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select className="filter-select" value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
            <option value="">All Industries</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search by title or company..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading your saved JDs...</div>
      ) : filteredJDs.length === 0 ? (
        <div className="empty-state">
          <img src="/logo.png" alt="AmbiDer" onError={e => e.target.style.display='none'} />
          <p><strong>No saved JDs yet.</strong><br />Generate your first one!</p>
        </div>
      ) : (
        <div className="jds-grid">
          {filteredJDs.map(jd => {
            const dateStr = new Date(jd.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <div className="jd-list-card" key={jd.id}>
                <div className="jd-card-info">
                  <div className="jd-card-title">{jd.job_title}</div>
                  {jd.company_name && <div className="jd-card-company">{jd.company_name}</div>}
                  <div className="jd-card-meta">
                    {jd.industry && <span className="industry-tag">{jd.industry}</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {dateStr}</span>
                  </div>
                </div>
                <div className="jd-card-actions">
                  <button className="action-btn view" onClick={() => handleView(jd)}>
                    <Eye size={14} /> View
                  </button>
                  <button className="action-btn" onClick={() => handleDownloadPDF(jd)}>
                    <Download size={14} /> PDF
                  </button>
                  <button className="action-btn delete" onClick={() => handleDelete(jd.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SavedJDs;
