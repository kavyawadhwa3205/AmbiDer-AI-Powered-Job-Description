import { useState, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import './Pages.css';

import API_BASE from '../config';

function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch (err) { console.error('Failed to fetch history:', err); }
    finally { setLoading(false); }
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const industries = [...new Set(history.map(h => h.industry).filter(Boolean))];

  const filtered = history.filter(item => {
    const date = new Date(item.created_at);
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate + 'T23:59:59')) return false;
    if (industryFilter && item.industry !== industryFilter) return false;
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h2>Generation History</h2>
      </div>

      {/* Filters */}
      <div className="filter-row">
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>From</label>
        <input type="date" className="filter-date-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>To</label>
        <input type="date" className="filter-date-input" value={toDate} onChange={e => setToDate(e.target.value)} />
        <select className="filter-select" value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
          <option value="">All Industries</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        {(fromDate || toDate || industryFilter) && (
          <button className="action-btn" style={{ fontSize: '12px' }} onClick={() => { setFromDate(''); setToDate(''); setIndustryFilter(''); }}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading your history...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No history found</h3>
          <p>No JDs match your filters, or you haven't generated any yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <thead>
              <tr style={{ background: '#FFF7F5' }}>
                <th>Job Title</th>
                <th>Industry</th>
                <th>Generated On</th>
                <th>Edits</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const dateStr = new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                const isExpanded = expandedId === item.id;
                return (
                  <>
                    <tr key={item.id} className="history-row" onClick={() => toggleExpand(item.id)} style={{ cursor: 'pointer', background: isExpanded ? '#FFF7F5' : 'var(--bg-white)' }}>
                      <td style={{ fontWeight: 600, color: '#E8510A' }}>{item.job_title}</td>
                      <td>
                        {item.industry ? (
                          <span className="industry-tag">{item.industry}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Calendar size={13} /> {dateStr}
                      </td>
                      <td>
                        <span style={{ background: item.edit_count > 0 ? '#FFF0EA' : 'var(--bg-gray)', color: item.edit_count > 0 ? '#E8510A' : 'var(--text-muted)', padding: '2px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                          {item.edit_count} edits
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#E8510A', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                          {isExpanded ? <><ChevronUp size={16} /> Hide</> : <><ChevronDown size={16} /> Expand</>}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`expand-${item.id}`}>
                        <td colSpan={5} style={{ padding: 0, background: '#FFF7F5' }}>
                          <div style={{ padding: '20px', borderTop: '1px solid #FDDECE' }}>
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: 'Poppins' }}>Original JD</div>
                              <div className="jd-preview-box">{item.original_jd}</div>
                            </div>
                            {item.edits.length > 0 && (
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', fontFamily: 'Poppins' }}>Edit Timeline</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '16px', borderLeft: '2px solid #FDDECE' }}>
                                  {item.edits.map((edit, idx) => (
                                    <div key={idx} style={{ position: 'relative' }}>
                                      <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#E8510A' }} />
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{new Date(edit.edited_at).toLocaleString()}</div>
                                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px', background: '#FFF0EA', padding: '6px 10px', borderRadius: '6px', display: 'inline-block' }}>
                                        "{edit.instruction}"
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default History;
