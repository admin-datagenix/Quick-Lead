import { useQuery } from '@tanstack/react-query';
import { Copy, MessageCircle, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { copyText, fmt, sourceLabel } from '../../lib/format';
import { Avatar, Badge, Drawer, QueryView, useUi } from '../../components/ui';

export default function LeadDetailDrawer({ leadId, onClose }) {
  const ui = useUi();
  const q = useQuery({ queryKey: ['lead', leadId], queryFn: () => api.lead(leadId) });

  return (
    <Drawer title="Lead details" onClose={onClose}>
      <QueryView query={q}>
        {(l) => (
          <>
            <div className="card card-pad" style={{ display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center' }}>
              <Avatar name={l.fullName} size={64} />
              <h2 style={{ fontSize: 20 }}>{l.fullName}</h2>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await copyText(l.mobile); ui.success('Mobile number copied'); }}>
                <span className="num" style={{ fontSize: 15, color: 'var(--ink)' }}>{fmt.mobile(l.mobile)}</span><Copy size={14} />
              </button>
              <div className="wrap-row" style={{ justifyContent: 'center' }}>
                {l.enquiryAbout && <Badge cls="b-sky">{l.enquiryAbout}</Badge>}
                {l.isDuplicate && <Badge cls="b-amber" dot>Possible duplicate</Badge>}
                {l.status === 'Incomplete' && <Badge cls="b-red" dot>Incomplete</Badge>}
              </div>
              <div className="grid cols-2" style={{ width: '100%', gap: 10, marginTop: 6 }}>
                <a className="btn btn-secondary" href={`tel:+91${l.mobile}`}><Phone size={16} />Call</a>
                <a className="btn btn-success" target="_blank" rel="noreferrer"
                  href={`https://wa.me/91${l.mobile}?text=${encodeURIComponent(l.whatsAppMessage)}`}><MessageCircle size={16} />WhatsApp</a>
              </div>
            </div>

            <section className="card">
              <div className="card-head"><h2>Lead info</h2></div>
              <div className="card-body info-list" style={{ paddingBlock: 6 }}>
                <div className="info-row"><span className="k">Form</span><span className="v">{l.formName}</span></div>
                {l.eventName && <div className="info-row"><span className="k">Event</span><span className="v">{l.eventName}</span></div>}
                <div className="info-row"><span className="k">Captured by</span><span className="v">{l.salesmanName ? <>{l.salesmanName} <span className="mono muted">· {l.salesmanCode}</span></> : 'Direct link'}</span></div>
                <div className="info-row"><span className="k">Captured on</span><span className="v">{fmt.dateTime(l.capturedAt)}</span></div>
                <div className="info-row"><span className="k">Source</span><span className="v">{sourceLabel(l.source)}</span></div>
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h2>Answers</h2></div>
              <div className="card-body info-list" style={{ paddingBlock: 6 }}>
                {l.answers.map((a) => (
                  <div key={a.key} className="info-row">
                    <span className="k">{a.label}</span>
                    <span className="v">{!a.value ? '—' : a.fieldType === 'Date' ? fmt.dateNum(a.value) : a.fieldType === 'Phone' ? fmt.mobile(a.value) : a.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card card-pad stack" style={{ gap: 8 }}>
              <h3>WhatsApp message</h3>
              <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{l.whatsAppMessage}</p>
            </section>
          </>
        )}
      </QueryView>
    </Drawer>
  );
}
