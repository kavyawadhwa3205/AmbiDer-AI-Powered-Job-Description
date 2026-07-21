import { useState, useEffect, useRef } from 'react';
import { FileText, Download, CheckSquare, Square, BarChart2, Bookmark } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import './Reports.css';
import './Pages.css';

import API_BASE from '../config';

function Reports() {
  const [jds, setJds] = useState([]);
  const [selectedJdId, setSelectedJdId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBulk, setSelectedBulk] = useState(new Set());
  const [generating1, setGenerating1] = useState(false);
  const [generating2, setGenerating2] = useState(false);
  const [generating3, setGenerating3] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const h = { 'Authorization': `Bearer ${token}` };
      const [jdRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/saved`, { headers: h }),
        fetch(`${API_BASE}/analytics`, { headers: h })
      ]);
      if (jdRes.ok) {
        const data = await jdRes.json();
        setJds(data);
        if (data.length > 0) setSelectedJdId(data[0].id.toString());
      }
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (err) { console.error('Failed to fetch report data:', err); }
    finally { setLoading(false); }
  };

  const toggleBulk = (id) => {
    const s = new Set(selectedBulk);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedBulk(s);
  };

  const buildPDFHeader = () => `
    <div style="text-align:center; border-bottom: 3px solid #E8510A; padding-bottom: 20px; margin-bottom: 24px;">
      <div style="font-family: 'Poppins', Arial, sans-serif; font-size: 28px; font-weight: 900; color: #E8510A;">AmbiDer</div>
      <div style="font-size: 13px; color: #6B7280; margin-top: 4px;">ADVISORS & MANAGEMENT CONSULTANTS LLP</div>
    </div>`;

  const buildPDFFooter = () => `
    <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #FDDECE; font-size: 11px; color: #9CA3AF; text-align: center;">
      AmbiDer Advisors & Management Consultants LLP &nbsp;|&nbsp; ambider.com
    </div>`;

  const generatePDF = async (html, filename, setGen) => {
    setGen(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = document.createElement('div');
      el.style.cssText = 'font-family: Inter, Arial, sans-serif; padding: 40px; color: #2F2F2F; width: 780px; background: white;';
      el.innerHTML = html;
      document.body.appendChild(el);
      await html2pdf().set({
        margin: 0.75,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      }).from(el).save();
      document.body.removeChild(el);
    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF generation failed. Try again.');
    } finally { setGen(false); }
  };

  const handleJDReport = async () => {
    const jd = jds.find(j => j.id.toString() === selectedJdId);
    if (!jd) return alert('Please select a JD.');
    const html = `
      ${buildPDFHeader()}
      <h1 style="font-size:22px;font-weight:700;color:#2F2F2F;margin-bottom:8px;">${jd.job_title}</h1>
      <div style="display:flex;gap:16px;flex-wrap:wrap;background:#FFF7F5;padding:14px;border-radius:8px;border-left:4px solid #E8510A;margin-bottom:20px;font-size:13px;">
        ${jd.company_name ? `<span>Company: <strong>${jd.company_name}</strong></span>` : ''}
        ${jd.industry ? `<span>Industry: <strong>${jd.industry}</strong></span>` : ''}
        <span>Generated: <strong>${new Date(jd.created_at).toLocaleDateString()}</strong></span>
      </div>
      <div style="white-space:pre-wrap;font-size:13px;line-height:1.7;color:#374151;">${jd.jd_text}</div>
      ${buildPDFFooter()}`;
    await generatePDF(html, `${(jd.job_title || 'JD').replace(/\s+/g,'_')}_Report.pdf`, setGenerating1);
  };

  const handleAnalyticsReport = async () => {
    if (!analytics) return alert('Analytics not loaded.');
    const s = analytics.stats;
    const html = `
      ${buildPDFHeader()}
      <h1 style="font-size:22px;font-weight:700;margin-bottom:4px;">Monthly Analytics Report</h1>
      <p style="color:#6B7280;font-size:13px;margin-bottom:24px;">Report Date: ${new Date().toLocaleDateString()}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        ${[['Total JDs Generated', s.total_jds], ['Most Used Industry', s.most_used_industry], ['Total Edits Made', s.total_edits], ['JDs This Week', s.jds_this_week]]
          .map(([label, val]) => `
            <div style="border:1px solid #FDDECE;padding:16px;border-radius:8px;background:#FFF7F5;text-align:center;">
              <div style="font-size:12px;color:#6B7280;margin-bottom:8px;">${label}</div>
              <div style="font-size:24px;font-weight:700;color:#E8510A;">${val}</div>
            </div>`).join('')}
      </div>
      <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">Top 5 Job Titles</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#FFF7F5;">
          <th style="text-align:left;padding:10px 14px;color:#E8510A;border-bottom:1px solid #FDDECE;">Rank</th>
          <th style="text-align:left;padding:10px 14px;color:#E8510A;border-bottom:1px solid #FDDECE;">Job Title</th>
          <th style="text-align:left;padding:10px 14px;color:#E8510A;border-bottom:1px solid #FDDECE;">Count</th>
        </tr></thead>
        <tbody>
          ${analytics.top_titles.map((t,i) => `
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #FDDECE;font-weight:700;color:#E8510A;">#${i+1}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #FDDECE;">${t.title}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #FDDECE;">${t.count} JDs</td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${buildPDFFooter()}`;
    await generatePDF(html, 'AmbiDer_Analytics_Report.pdf', setGenerating2);
  };

  const handleBulkReport = async () => {
    const bulkJDs = jds.filter(j => selectedBulk.has(j.id));
    if (bulkJDs.length === 0) return alert('Select at least one JD.');
    const pages = bulkJDs.map((jd, idx) => `
      <div style="${idx > 0 ? 'page-break-before: always;' : ''}">
        ${buildPDFHeader()}
        <h1 style="font-size:20px;font-weight:700;margin-bottom:8px;">${jd.job_title}</h1>
        <div style="display:flex;gap:16px;flex-wrap:wrap;background:#FFF7F5;padding:12px;border-radius:8px;border-left:4px solid #E8510A;margin-bottom:16px;font-size:12px;">
          ${jd.company_name ? `<span>Company: <strong>${jd.company_name}</strong></span>` : ''}
          ${jd.industry ? `<span>Industry: <strong>${jd.industry}</strong></span>` : ''}
        </div>
        <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#374151;">${jd.jd_text}</div>
        ${buildPDFFooter()}
      </div>`).join('');
    await generatePDF(pages, 'AmbiDer_Bulk_JDs.pdf', setGenerating3);
  };

  if (loading) return <div className="page-container"><div className="empty-state">Loading reports data...</div></div>;

  return (
    <div className="page-container">
      <div className="page-header-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
        <h2>Reports</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Download professional branded PDF reports for your JDs</p>
      </div>

      <div className="reports-grid">
        {/* CARD 1 — JD Report */}
        <div className="report-card">
          <div className="report-icon-wrapper"><FileText size={22} /></div>
          <h3>Job Description Report</h3>
          <p>Download a branded AmbiDer PDF report for any generated JD with full details and formatting.</p>
          <div className="report-action-area">
            <select className="report-select" value={selectedJdId} onChange={e => setSelectedJdId(e.target.value)}>
              {jds.length === 0 && <option value="">No JDs saved yet</option>}
              {jds.map(jd => <option key={jd.id} value={jd.id}>{jd.job_title}{jd.company_name ? ` — ${jd.company_name}` : ''}</option>)}
            </select>
            <button className="report-primary-btn" onClick={handleJDReport} disabled={generating1 || jds.length === 0}>
              {generating1 ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* CARD 2 — Analytics Report */}
        <div className="report-card">
          <div className="report-icon-wrapper"><BarChart2 size={22} /></div>
          <h3>Monthly Analytics Report</h3>
          <p>Download a summary of your JD generation activity including stats and top job titles.</p>
          <div className="report-action-area">
            <input type="month" className="report-select" defaultValue={new Date().toISOString().slice(0, 7)} />
            <button className="report-primary-btn" onClick={handleAnalyticsReport} disabled={generating2 || !analytics}>
              <Download size={15} style={{ marginRight: 6 }} />
              {generating2 ? 'Generating...' : 'Download Report'}
            </button>
          </div>
        </div>

        {/* CARD 3 — Bulk Download */}
        <div className="report-card">
          <div className="report-icon-wrapper"><Bookmark size={22} /></div>
          <h3>Bulk JD Download</h3>
          <p>Select multiple JDs and download them all in one branded PDF file.</p>
          <div className="report-action-area bulk-area">
            <div className="bulk-actions">
              <button className="text-btn" onClick={() => setSelectedBulk(new Set(jds.map(j => j.id)))}>Select All</button>
              <button className="text-btn" onClick={() => setSelectedBulk(new Set())}>Clear All</button>
            </div>
            <div className="bulk-list">
              {jds.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px' }}>No JDs available</div>}
              {jds.map(jd => (
                <div key={jd.id} className="bulk-list-item" onClick={() => toggleBulk(jd.id)}>
                  {selectedBulk.has(jd.id) ? <CheckSquare size={15} color="#E8510A" /> : <Square size={15} color="#9CA3AF" />}
                  <span className="truncate">{jd.job_title}</span>
                </div>
              ))}
            </div>
            <button className="report-primary-btn" onClick={handleBulkReport} disabled={generating3 || selectedBulk.size === 0} style={{ marginTop: 12 }}>
              {generating3 ? 'Generating...' : `Download ${selectedBulk.size > 0 ? `(${selectedBulk.size}) ` : ''}Selected as PDF`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
