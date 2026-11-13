import { Mail, Phone } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../../lib/config';

const FAQ = [
  ['How does a salesman join a group?', 'The admin invites the salesman’s mobile number. The salesman signs in, opens Invitations, clicks Accept and enters their name.'],
  ['What is a primary form?', 'The primary form opens directly when a salesman clicks Add lead. Set it from My forms using the star.'],
  ['How do visitors fill the form themselves?', 'Open the QR print page, print it or save it as PDF, and place it at the stall. Visitors scan it with their phone camera. Leads are credited to the salesman on the QR.'],
  ['Why can’t a lead be added?', 'The form may not be live today (outside its start and end dates), or the salesman may be deactivated by the admin.'],
  ['What are incomplete leads?', 'Visitors who started the QR form but did not submit it. What they typed is kept so you can follow up.'],
  ['Can leads be captured offline?', 'Yes, in the QuickLeads mobile app. Leads sync automatically when the phone is back online. The web app needs a connection.'],
];

export default function HelpPage() {
  return (
    <>
      <div className="page-head"><div className="titles"><h1>Help &amp; support</h1><p className="sub">Our team is happy to help you get the most out of QuickLeads.</p></div></div>
      <div className="grid cols-2">
        <a className="choice" href={`mailto:${SUPPORT_EMAIL}?subject=QuickLeads%20support`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ci" style={{ background: 'var(--sky-100)', color: 'var(--sky-700)' }}><Mail size={24} /></span>
          <span><b>Email</b><span className="muted" style={{ display: 'block' }}>{SUPPORT_EMAIL}</span></span>
        </a>
        <a className="choice" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ci" style={{ background: 'var(--green-50)', color: 'var(--green)' }}><Phone size={24} /></span>
          <span><b>Phone / WhatsApp</b><span className="muted" style={{ display: 'block' }}>{SUPPORT_PHONE}</span></span>
        </a>
      </div>
      <section className="card">
        <div className="card-head"><h2>Frequently asked questions</h2></div>
        <div className="card-body stack">
          {FAQ.map(([q, a]) => (
            <details key={q} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}>{q}</summary>
              <p className="muted" style={{ marginTop: 8 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
