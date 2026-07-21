import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Header, Footer, ImageRun, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import {
  Code, Briefcase, Shield, MinusCircle, PlusCircle, Smile, Sparkles, ChevronRight, ChevronDown, CheckCircle2, Building2, MapPin, Calendar, Pencil, RefreshCw, Download, Copy, Share2, LayoutGrid, BarChart2, X, MessageSquare, FileText, Send, GraduationCap, Heart
} from 'lucide-react';
import './OutputPage.css';

import API_BASE from '../config';

const ENHANCE_OPTIONS = [
  { label: 'Make More Professional', icon: Briefcase, instruction: 'Rewrite this JD in a more formal and professional tone' },
  { label: 'ATS Optimized', icon: Shield, instruction: 'Optimize this JD for ATS systems by adding relevant keywords' },
  { label: 'Shorten Content', icon: MinusCircle, instruction: 'Make this JD more concise while preserving essential information' },
  { label: 'Expand Content', icon: PlusCircle, instruction: 'Add more detail to each section of this JD' },
  { label: 'Change Tone', icon: Smile, instruction: null, hasToneDropdown: true }
];

const TONE_OPTIONS = ['Formal', 'Friendly', 'Semi-Formal'];

function parseJDSections(jdText) {
  if (!jdText) return [];
  const sections = [];
  const lines = jdText.split('\n');
  let currentSection = null;
  let currentContent = [];

  const sectionMeta = {
    'job summary': { icon: Code, color: 'purple', key: 'summary' },
    'about the role': { icon: Code, color: 'purple', key: 'summary' },
    'key responsibilities': { icon: Briefcase, color: 'green', key: 'responsibilities' },
    'responsibilities': { icon: Briefcase, color: 'green', key: 'responsibilities' },
    'required skills': { icon: Code, color: 'purple', key: 'skills' },
    'skills': { icon: Code, color: 'purple', key: 'skills' },
    'required qualifications': { icon: GraduationCap, color: 'orange', key: 'qualifications' },
    'qualifications': { icon: GraduationCap, color: 'orange', key: 'qualifications' },
    'good to have skills': { icon: Code, color: 'purple', key: 'nice-to-have' },
    'what we offer': { icon: Heart, color: 'pink', key: 'benefits' },
    'benefits': { icon: Heart, color: 'pink', key: 'benefits' }
  };

  const flush = () => {
    if (currentSection) {
      sections.push({ ...currentSection, content: currentContent.join('\n').trim() });
      currentContent = [];
    }
  };

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,4}\s+(.+)/);
    if (headerMatch) {
      flush();
      const title = headerMatch[1].replace(/[*_]/g, '').trim();
      const titleLower = title.toLowerCase();
      const metaEntry = Object.entries(sectionMeta).find(([key]) => titleLower.includes(key));
      if (metaEntry) {
        const meta = metaEntry[1];
        currentSection = { title, icon: meta.icon, color: meta.color, key: meta.key };
      } else {
        currentSection = { title, icon: Code, color: 'blue', key: title.toLowerCase().replace(/\s+/g, '-') };
      }
    } else {
      currentContent.push(line);
    }
  }
  flush();

  if (sections.length === 0 && jdText.trim()) {
    sections.push({ title: 'Job Description', icon: Code, color: 'blue', key: 'full', content: jdText });
  }
  return sections;
}

function OutputPage({ jdText, formData, onJDUpdate, onRegenerate, onNavigate }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [enhanceLoading, setEnhanceLoading] = useState('');
  const [toneOpen, setToneOpen] = useState(false);
  const [atsData, setAtsData] = useState(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [logoBase64, setLogoBase64] = useState('');
  const jdRef = useRef(null);
  const pdfHiddenRef = useRef(null);
  const chatEndRef = useRef(null);
  const AMBIDER_LOGO_BASE64 = logoBase64;

  // Load logo as base64 for PDF & DOCX
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const resp = await fetch('/logo.png');
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result);
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error('Failed to load logo', e);
      }
    };
    fetchLogo();
  }, []);

  useEffect(() => {
    if (jdText) fetchATSScore();
  }, [jdText]);

  const fetchATSScore = async () => {
    setAtsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/ats-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jd_text: jdText, job_title: formData.job_title || '', skills: formData.skills || [] })
      });
      if (res.ok) {
        const data = await res.json();
        setAtsData(data);
      }
    } catch (e) {
      console.error('ATS fetch error', e);
    } finally {
      setAtsLoading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const wordCount = jdText ? jdText.split(/\s+/).filter(Boolean).length : 0;
  const calculateReadability = (text) => {
    if (!text) return 0;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (sentences.length === 0) return 0;
    const avg = words.length / sentences.length;
    let score = 100;
    if (avg > 25) score -= 30;
    else if (avg > 20) score -= 15;
    if (words.length < 200) score -= 20;
    return Math.max(Math.min(score, 100), 0);
  };

  const readabilityScore = calculateReadability(jdText);
  let readabilityLabel = 'Needs Improvement';
  if (readabilityScore >= 80) readabilityLabel = 'Excellent';
  else if (readabilityScore >= 65) readabilityLabel = 'Good';
  else if (readabilityScore >= 50) readabilityLabel = 'Average';

  const sections = parseJDSections(jdText);

  const handleCopy = () => {
    navigator.clipboard.writeText(jdText).then(() => showToast('Copied to clipboard'));
  };

  const cleanMarkdown = (text) => {
    return text
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .trim();
  };

  const handleDownloadPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const jobTitle = formData?.job_title || 'Job Description';
      const industry = formData?.industry || '';
      const company = formData?.company_name || '';
      const experience = formData?.experience || '';
      const currentDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric'
      });
      
      let y = 20;
      const margin = 20;
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageWidth = pdfWidth - margin * 2;
      
      // Add Logo
      if (AMBIDER_LOGO_BASE64) {
        const logoWidth = 50;
        const logoHeight = 15;
        const logoX = (pdfWidth - logoWidth) / 2;
        pdf.addImage(AMBIDER_LOGO_BASE64, 'PNG', logoX, y, logoWidth, logoHeight);
        y += logoHeight + 10;
      }
      
      // App Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor('#E8510A');
      pdf.text('AmbiDer Job Description Generator', pdfWidth / 2, y, { align: 'center' });
      y += 8;
      
      // Divider
      pdf.setDrawColor('#E8510A');
      pdf.setLineWidth(1);
      pdf.line(margin, y, pdfWidth - margin, y);
      y += 15;
      
      // Job Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(26, 26, 26);
      const titleLines = pdf.splitTextToSize(jobTitle, pageWidth);
      pdf.text(titleLines, margin, y);
      y += titleLines.length * 10 + 5;
      
      // Info Row
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(102, 102, 102);
      const infoParts = [
        industry && `Industry: ${industry}`,
        company && `Company: ${company}`,
        experience && `Experience: ${experience}`,
        `Generated: ${currentDate}`
      ].filter(Boolean).join('   |   ');
      
      const infoLines = pdf.splitTextToSize(infoParts, pageWidth);
      pdf.text(infoLines, margin, y);
      y += infoLines.length * 6 + 10;
      
      const SECTION_HEADINGS = [
        'about the role', 'key responsibilities',
        'required qualifications', 'skills and tools',
        'good to have', 'what we offer', 'job summary',
        'benefits', 'qualifications', 'job title'
      ];
      
      const lines = (jdText || '').split('\n');
      
      for (const line of lines) {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        
        const raw = line.trim();
        if (!raw) {
          y += 4;
          continue;
        }
        
        const cleaned = cleanMarkdown(raw);
        if (!cleaned) continue;
        
        const isHeading = SECTION_HEADINGS.some(h => 
          cleaned.toLowerCase().startsWith(h)
        );
        
        if (isHeading) {
          y += 6;
          if (y > 270) { pdf.addPage(); y = 20; }
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(16);
          pdf.setTextColor('#E8510A');
          pdf.text(cleaned, margin, y);
          y += 2;
          
          pdf.setDrawColor('#FDDECE');
          pdf.setLineWidth(0.5);
          pdf.line(margin, y, pdfWidth - margin, y);
          y += 8;
          continue;
        }
        
        if (raw.startsWith('- ') || raw.startsWith('• ') || raw.match(/^\d+\.\s/)) {
          const content = cleanMarkdown(raw.replace(/^[-•]\s/, '').replace(/^\d+\.\s*/, ''));
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(12);
          pdf.setTextColor(47, 47, 47);
          const bulletLines = pdf.splitTextToSize(`• ${content}`, pageWidth - 5);
          pdf.text(bulletLines, margin + 5, y);
          y += bulletLines.length * 6 + 2;
          continue;
        }
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(47, 47, 47);
        const textLines = pdf.splitTextToSize(cleaned, pageWidth);
        pdf.text(textLines, margin, y);
        y += textLines.length * 6 + 2;
      }
      
      // Footer on all pages
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(153, 153, 153);
        const footerText = `AmbiDer Advisors & Management Consultants LLP  |  ambider.com  |  Generated on ${currentDate}`;
        pdf.text(footerText, pdfWidth / 2, 285, { align: 'center' });
      }
      
      const filename = `${jobTitle.replace(/\s+/g, '_')}_JD.pdf`;
      pdf.save(filename);
      showToast('PDF downloaded');
    } catch (e) {
      console.error('PDF generation error:', e);
      showToast('PDF download failed');
    }
  };

  const handleDownloadDOCX = async () => {
    const jobTitle = formData?.job_title || 'Job Description';
    const industry = formData?.industry || '';
    const company = formData?.company_name || '';
    const experience = formData?.experience || '';
    const currentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    
    const base64ToArrayBuffer = (base64) => {
      if (!base64) return null;
      const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    };
    
    const bodyParagraphs = [];
    
    
    
    bodyParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: jobTitle,
            bold: true,
            size: 40,
            color: '1A1A1A',
            font: 'Calibri'
          })
        ]
      })
    );
    

    const infoParts = [
      industry && `Industry: ${industry}`,
      company && `Company: ${company}`,
      experience && `Experience: ${experience}`,
      `Generated: ${currentDate}`
    ].filter(Boolean);
    
    bodyParagraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 360 },
        children: infoParts.map((part, i) => [
          new TextRun({ text: part, size: 20, color: '666666', font: 'Calibri' }),
          i < infoParts.length - 1
            ? new TextRun({ text: '   |   ', size: 20, color: 'CCCCCC', font: 'Calibri' })
            : null
        ]).flat().filter(Boolean)
      })
    );
    
    const lines = (jdText || '').split('\n');
    
    const SECTION_HEADINGS = [
      'about the role', 'key responsibilities',
      'required qualifications', 'skills and tools',
      'good to have', 'what we offer', 'job summary',
      'benefits', 'qualifications', 'job title'
    ];
    
    lines.forEach(line => {
      const raw = line.trim();
      if (!raw) {
        bodyParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { before: 0, after: 80 }
          })
        );
        return;
      }
      
      const cleaned = cleanMarkdown(raw);
      if (!cleaned) return;
      
      const isHeading = SECTION_HEADINGS.some(h => 
        cleaned.toLowerCase().startsWith(h)
      );
      
      if (isHeading) {
        bodyParagraphs.push(
          new Paragraph({
            spacing: { before: 320, after: 120 },
            children: [
              new TextRun({
                text: cleaned,
                bold: true,
                size: 26,
                color: 'E8510A',
                font: 'Calibri'
              })
            ]
          })
        );
        bodyParagraphs.push(
          new Paragraph({
            spacing: { before: 0, after: 120 },
            border: {
              bottom: {
                color: 'FDDECE',
                space: 2,
                style: BorderStyle.SINGLE,
                size: 4
              }
            },
            children: [new TextRun({ text: '' })]
          })
        );
        return;
      }
      
      if (raw.startsWith('- ') || raw.startsWith('• ') || 
          raw.match(/^\d+\.\s/)) {
        const content = cleanMarkdown(
          raw.replace(/^[-•]\s/, '').replace(/^\d+\.\s*/, '')
        );
        bodyParagraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 60, after: 60 },
            keepLines: true,
            children: [
              new TextRun({
                text: content,
                size: 22,
                color: '2F2F2F',
                font: 'Calibri'
              })
            ]
          })
        );
        return;
      }
      
      bodyParagraphs.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text: cleaned,
              size: 22,
              color: '2F2F2F',
              font: 'Calibri'
            })
          ]
        })
      );
    });
    
    const doc = new Document({
      numbering: {
        config: [{
          reference: 'bullet-list',
          levels: [{
            level: 0,
            format: 'bullet',
            text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 }
              }
            }
          }]
        }]
      },
      sections: [{
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `AmbiDer Advisors & Management Consultants LLP  |  ambider.com  |  Generated on ${currentDate}`,
                    size: 16,
                    color: '999999',
                    font: 'Calibri'
                  })
                ]
              })
            ]
          })
        },
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1080,
              bottom: 1440,
              left: 1080
            }
          }
        },
        children: bodyParagraphs
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    const filename = jobTitle.replace(/\s+/g, '_') + '_JD.docx';
    saveAs(blob, filename);
    showToast('DOCX downloaded');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied to clipboard'));
  };

  const handleEnhance = async (instruction) => {
    setEnhanceLoading(instruction);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_jd: jdText, instruction, jd_id: formData.saved_jd_id })
      });
      const data = await res.json();
      if (data.error) showToast('Error: ' + data.error);
      else {
        onJDUpdate(data.jd);
        showToast('JD updated successfully');
        if (formData.saved_jd_id) {
          try {
            await fetch(`${API_BASE}/save/edit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ jd_id: formData.saved_jd_id, instruction, updated_jd: data.jd })
            });
          } catch (e) { console.error('Failed to log edit', e); }
        }
      }
    } catch { showToast('Could not reach server. Is Flask running?'); }
    finally { setEnhanceLoading(''); setToneOpen(false); }
  };

  // ── Chat Logic (unchanged) ──
  const handleChatSend = async (instruction) => {
    const msg = instruction || chatInput.trim();
    if (!msg) return;
    setChatError('');
    const newMsgs = [...chatMessages, { role: 'user', text: msg }];
    setChatMessages(newMsgs);
    if (!instruction) setChatInput('');
    setChatLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_jd: jdText, instruction: msg, jd_id: formData.saved_jd_id })
      });
      const data = await res.json();
      if (data.error) {
        setChatMessages([...newMsgs, { role: 'ai', text: 'Error: ' + data.error }]);
      } else {
        onJDUpdate(data.jd);
        setChatMessages([...newMsgs, { role: 'ai', text: 'Done! The JD has been updated.' }]);
        if (formData.saved_jd_id) {
          try {
            await fetch(`${API_BASE}/save/edit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ jd_id: formData.saved_jd_id, instruction: msg, updated_jd: data.jd })
            });
          } catch (e) { console.error('Failed to log edit', e); }
        }
      }
    } catch {
      setChatError('Could not reach server. Make sure Flask is running on port 5001.');
    } finally { setChatLoading(false); }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const extractTags = (content, type) => {
    if (!content) return [];
    return content.split('\n').map(l => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim()).filter(Boolean);
  };

  return (
    <>
      {/* Hidden PDF div */}
      <div ref={pdfHiddenRef} style={{ display: 'none' }} id="pdf-content">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img 
            src={AMBIDER_LOGO_BASE64} 
            alt="AmbiDer Logo"
            style={{ height: '50px', display: 'block', margin: '0 auto 8px auto' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <h1 style={{ fontSize: '24px', color: '#1a1a1a', marginBottom: '10px', textAlign: 'center' }}>{formData.job_title || ''}</h1>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          {formData.company_name && <span><strong>Company:</strong> {formData.company_name}</span>}
          {formData.industry && <span><strong>Industry:</strong> {formData.industry}</span>}
          {formData.experience && <span><strong>Experience:</strong> {formData.experience}</span>}
        </div>
        <div className="pdf-markdown-content" style={{ fontSize: '12px', color: '#333', lineHeight: '1.6' }}>
          <ReactMarkdown>{cleanMarkdown(jdText)}</ReactMarkdown>
        </div>
        <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '10px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
          AmbiDer Advisors & Management Consultants LLP  |  ambider.com  |  Generated on {dateStr}
        </div>
      </div>

      <div className="output-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{formData.job_title || 'Job Title'}</h2>
        {formData.reporting_to && (
          <span className="reporting-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            Reporting to: {formData.reporting_to}
          </span>
        )}
      </div>

      <div className="output-layout">
        <div className="jd-content-area">
          <div className="jd-header-bar">
            <div className="jd-header-left">
              <div className="jd-header-icon"><Code size={24} /></div>
              <div className="jd-header-info">
                <h2>{formData.job_title || 'Job Title'}</h2>
                <div className="jd-header-meta">
                  {formData.company_name && (<>
                    <span className="meta-item"><Building2 className="meta-icon" /> {formData.company_name}</span>
                    <span className="meta-dot">•</span>
                  </>)}
                  {formData.location && (<>
                    <span className="meta-item"><MapPin className="meta-icon" /> {formData.location}</span>
                    <span className="meta-dot">•</span>
                  </>)}
                  {formData.employment_type && (<span className="meta-item"><Calendar className="meta-icon" /> {formData.employment_type}</span>)}
                </div>
                <div className="jd-generated-date">Generated on {dateStr}</div>
              </div>
            </div>
            <div className="jd-header-actions">
              <button className="header-btn" onClick={() => onNavigate('form')} id="edit-inputs-btn"><Pencil className="btn-icon" /> Edit Inputs</button>
              <button className="header-btn" onClick={onRegenerate} id="regenerate-btn"><RefreshCw className="btn-icon" /> Regenerate JD</button>
              <button className="header-btn primary" id="save-jd-btn"><Download className="btn-icon" /> Save JD</button>
            </div>
          </div>

          {/* JD Sections */}
          <div ref={jdRef}>
            {sections.map(sec => {
              const IconComp = sec.icon;
              const isSkill = sec.key === 'skills' || sec.key === 'nice-to-have';
              const isBenefit = sec.key === 'benefits';
              if (isSkill) {
                const tags = extractTags(sec.content, 'skill');
                return (
                  <div className="jd-card" key={sec.key}>
                    <div className="jd-section-header">
                      <div className={`jd-section-icon ${sec.color}`}><IconComp size={20} /></div>
                      <h3>{sec.title}</h3>
                    </div>
                    <div className="jd-skills-tags">
                      {tags.map((t, i) => <span className="jd-skill-tag" key={i}>{t}</span>)}
                    </div>
                  </div>
                );
              }
              if (isBenefit) {
                const tags = extractTags(sec.content, 'benefit');
                return (
                  <div className="jd-card" key={sec.key}>
                    <div className="jd-section-header">
                      <div className={`jd-section-icon ${sec.color}`}><IconComp size={20} /></div>
                      <h3>{sec.title}</h3>
                    </div>
                    <div className="benefit-tags">
                      {tags.map((t, i) => <span className="benefit-tag" key={i}>{t}</span>)}
                    </div>
                  </div>
                );
              }
              return (
                <div className="jd-card" key={sec.key}>
                  <div className="jd-section-header">
                    <div className={`jd-section-icon ${sec.color}`}><IconComp size={20} /></div>
                    <h3>{sec.title}</h3>
                  </div>
                  <div className="jd-markdown-body">
                    <ReactMarkdown>{sec.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="output-right-panel">
          <div className="panel-card">
            <div className="panel-title"><Sparkles className="panel-icon" /> AI Enhance</div>
            <div className="panel-subtitle">Improve your job description</div>
            <div className="enhance-list">
              {ENHANCE_OPTIONS.map(opt => {
                const OptIcon = opt.icon;
                if (opt.hasToneDropdown) {
                  return (
                    <div key={opt.label}>
                      <button className={`enhance-item ${enhanceLoading === opt.label ? 'loading' : ''}`} onClick={() => setToneOpen(!toneOpen)} disabled={!!enhanceLoading}>
                        <span className="enhance-left"><OptIcon className="enhance-icon" /> {opt.label}</span>
                        {enhanceLoading === opt.label ? <span className="enhance-spinner" /> : <ChevronDown className="enhance-arrow" />}
                      </button>
                      {toneOpen && (
                        <div style={{ paddingLeft: 34 }}>
                          {TONE_OPTIONS.map(tone => (
                            <button key={tone} className="enhance-item" onClick={() => handleEnhance(`Change the tone of this JD to ${tone}`)} style={{ fontSize: 12, padding: '6px 10px' }}>
                              <span>{tone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <button className={`enhance-item ${enhanceLoading === opt.instruction ? 'loading' : ''}`} key={opt.label} onClick={() => handleEnhance(opt.instruction)} disabled={!!enhanceLoading}>
                    <span className="enhance-left"><OptIcon className="enhance-icon" /> {opt.label}</span>
                    {enhanceLoading === opt.instruction ? <span className="enhance-spinner" /> : <ChevronRight className="enhance-arrow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title"><BarChart2 className="panel-icon" /> JD Insights</div>
            <div className="panel-subtitle" />
            <div className="insight-row">
              <div className="insight-label-row"><span className="insight-label">Readability</span><span className="insight-value">{readabilityScore}/100</span></div>
              <div className="insight-badge">{readabilityLabel}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${readabilityScore}%` }} /></div>
            </div>
            <div className="insight-row">
              <span className="insight-label">Word Count</span>
              <div className="word-count-display"><span className="word-count-value">{wordCount}</span><span className="word-count-label">words</span></div>
            </div>
            <div className="insight-row">
              <div className="insight-label-row"><span className="insight-label">ATS Score</span><span className="insight-value">{atsLoading ? '...' : `${atsData?.score ?? 0}/100`}</span></div>
              <div className="insight-badge" style={{ background: (atsData?.score ?? 0) >= 75 ? '#DCFCE7' : (atsData?.score ?? 0) >= 50 ? '#FFF7ED' : '#FEE2E2', color: (atsData?.score ?? 0) >= 75 ? '#166534' : (atsData?.score ?? 0) >= 50 ? '#C2410C' : '#991B1B' }}>
                {atsLoading ? 'Analyzing...' : (atsData?.score >= 80 ? 'Excellent' : atsData?.score >= 65 ? 'Good' : atsData?.score >= 45 ? 'Average' : 'Needs Work')}
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${atsData?.score ?? 0}%`, background: (atsData?.score ?? 0) >= 75 ? '#22C55E' : (atsData?.score ?? 0) >= 50 ? '#E8510A' : '#EF4444' }} /></div>
              {!atsLoading && atsData?.tips?.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>💡 Tips to improve</div>
                  {atsData.tips.map((tip, i) => (
                    <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 0', borderBottom: i < atsData.tips.length - 1 ? '1px solid var(--border)' : 'none' }}>• {tip}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title"><LayoutGrid className="panel-icon" /> Similar Templates</div>
            <div className="template-list">
              {['Frontend Developer', 'Full Stack Developer', 'Backend Developer', 'Data Analyst'].map(t => (
                <button className="template-item" key={t} onClick={() => onNavigate('form', { job_title: t })}>
                  <span>{t}</span><ChevronRight className="t-arrow" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bottom-action-bar">
        <button className="bottom-btn" onClick={handleCopy} id="copy-jd-btn"><Copy className="btn-icon" /> Copy JD</button>
        <button className="bottom-btn" onClick={handleDownloadPDF} id="download-pdf-btn"><FileText className="btn-icon red" /> Download PDF</button>
        <button className="bottom-btn" onClick={handleDownloadDOCX} id="download-docx-btn"><span className="btn-icon blue" style={{ fontWeight: 700, fontSize: 14 }}>W</span> Download DOCX</button>
        <button className="bottom-btn" onClick={handleShare} id="share-jd-btn"><Share2 className="btn-icon" /> Share JD</button>
        <button className="bottom-btn improve" onClick={() => setChatOpen(true)} id="improve-ai-btn"><Sparkles className="btn-icon" /> Improve with AI</button>
      </div>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="chat-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChatOpen(false); }}>
          <div className="chat-panel-slide">
            <div className="chat-panel-header">
              <div className="chat-panel-header-left">
                <div className="chat-icon"><Sparkles size={16} /></div>
                <div><h3>Edit with AI</h3><p>Type an instruction to modify the JD</p></div>
              </div>
              <button className="chat-close-btn" onClick={() => setChatOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 && !chatError ? (
                <div className="chat-empty">
                  <div className="chat-empty-inner">
                    <MessageSquare className="empty-icon" />
                    <p>Tell me how to edit the JD.<br />For example:<br />"Make it more formal"<br />"Add a line about remote work"<br />"Shorten the responsibilities"</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div className={`chat-message ${msg.role}`} key={i}>
                    <span className="msg-label">{msg.role === 'user' ? 'You' : 'AI'}</span>
                    <div className="msg-bubble">{msg.text}</div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="chat-message ai"><span className="msg-label">AI</span><div className="msg-bubble">Updating the JD...</div></div>
              )}
              {chatError && (
                <div className="chat-error">{chatError}<button className="retry-btn" onClick={() => { setChatError(''); handleChatSend(chatMessages[chatMessages.length - 1]?.text); }}>Retry</button></div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-area">
              <input type="text" placeholder="e.g. Make it more concise..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) handleChatSend(); }} disabled={chatLoading} id="chat-input" />
              <button className="chat-send-btn" onClick={() => handleChatSend()} disabled={chatLoading || !chatInput.trim()} aria-label="Send"><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default OutputPage;
