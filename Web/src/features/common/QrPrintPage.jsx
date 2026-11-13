import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { ArrowLeft, Link2, Printer } from 'lucide-react';
import { api } from '../../lib/api';
import { copyText, fmt } from '../../lib/format';
import { Button, Loader, QueryView, useUi } from '../../components/ui';

/** A4 QR print page: the same QR twice, with company, form and salesman details. Print or save as PDF. */
export default function QrPrintPage() {
  const { formId } = useParams();
  const [params] = useSearchParams();
  const memberId = params.get('m') || undefined;
  const nav = useNavigate();
  const ui = useUi();
  const q = useQuery({ queryKey: ['qr', formId, memberId], queryFn: () => api.qr(formId, memberId) });
  const [img, setImg] = useState(null);

  useEffect(() => {
    if (!q.data?.url) return;
    QRCode.toDataURL(q.data.url, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0F172A', light: '#FFFFFF' } }).then(setImg);
  }, [q.data?.url]);

  return (
    <QueryView query={q}>
      {(d) => (
        <>
          <div className="page-head no-print">
            <div className="titles">
              <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }} onClick={() => nav(-1)}><ArrowLeft size={15} />Back</button>
              <h1>QR print</h1>
              <p className="sub">{d.salesmanName ? `Personal QR for ${d.salesmanName}. Every scan is credited to them.` : 'Form QR without a salesman. Scans are recorded as “Direct link”.'}</p>
            </div>
            <div className="actions">
              <Button variant="secondary" icon={Link2} onClick={async () => { await copyText(d.url); ui.success('Link copied'); }}>Copy link</Button>
              <Button icon={Printer} onClick={() => window.print()}>Print / Save as PDF</Button>
            </div>
          </div>
          <p className="muted small no-print">Link: <span className="mono">{d.url}</span> · In the print dialog choose A4, margins “None”, and turn on background graphics.</p>

          <div className="print-stage">
            {!img ? <Loader /> : (
              <div className="a4">
                <Half d={d} img={img} />
                <div className="qr-cut">cut here</div>
                <Half d={d} img={img} />
              </div>
            )}
          </div>
        </>
      )}
    </QueryView>
  );
}

function Half({ d, img }) {
  const contact = [d.contactPerson, d.contactMobile && fmt.mobile(d.contactMobile), d.contactEmail, d.website].filter(Boolean).join('  |  ');
  return (
    <div className="qr-half">
      <div className="qr-band">
        <div><div className="co">{d.companyName}</div><div className="ev">{d.eventName || d.formName}</div></div>
        <div className="dt">{fmt.dateNum(d.startDate)} to {fmt.dateNum(d.endDate)}</div>
      </div>
      <div className="qr-main">
        <img src={img} alt={`QR code for ${d.formName}`} />
        <div>
          <h3>Scan to share your details</h3>
          <div className="hint">Open your phone camera, point it at the QR code and fill the short form. We will get in touch with you.</div>
          <div className="fn">{d.formName}</div>
          {d.salesmanName && (
            <div className="qr-person">
              <div className="l">Your contact</div>
              <div className="nm">{d.salesmanName}</div>
              <div className="id">ID: {d.salesmanCode}  |  {fmt.mobile(d.salesmanMobile)}</div>
            </div>
          )}
        </div>
      </div>
      <div className="qr-foot"><span>{contact}</span><span>QuickLeads by <b>DatagenixAI</b></span></div>
    </div>
  );
}
