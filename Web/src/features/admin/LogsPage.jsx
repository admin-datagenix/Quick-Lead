import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, History, LogIn, LogOut } from 'lucide-react';
import { api, downloadExport } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, Button, EmptyState, QueryView, useUi } from '../../components/ui';

export default function LogsPage() {
  const [tab, setTab] = useState('exports');
  return (
    <>
      <div className="page-head">
        <div className="titles"><h1>Logs</h1><p className="sub">Lead exports and salesman sign-in activity.</p></div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'exports'} className={tab === 'exports' ? 'on' : ''} onClick={() => setTab('exports')}>Export logs</button>
        <button role="tab" aria-selected={tab === 'salesmen'} className={tab === 'salesmen' ? 'on' : ''} onClick={() => setTab('salesmen')}>Salesman logs</button>
      </div>
      {tab === 'exports' ? <ExportLogs /> : <SalesmanLogs />}
    </>
  );
}

function Pager({ page, setPage, data }) {
  const pages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <span>{fmt.num(data.totalCount)} entries</span>
      <div className="row" style={{ gap: 6 }}>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function ExportLogs() {
  const { activeGroupId: gid } = useSession();
  const ui = useUi();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['exports', gid, page], queryFn: () => api.exportLogs(gid, page) });
  const [busy, setBusy] = useState(null);

  async function dl(e) {
    setBusy(e.id);
    try { await downloadExport(e.id, e.fileName); } catch (err) { ui.error(err); } finally { setBusy(null); }
  }

  return (
    <section className="card">
      <QueryView query={q}>
        {(data) => data.items.length === 0 ? <EmptyState icon={Download} title="No exports yet" message="Exports from the Leads page are listed here." /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>File</th><th>Rows</th><th>Size</th><th>Filters</th><th>Exported by</th><th>Date &amp; time</th><th /></tr></thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td><div className="row" style={{ gap: 10 }}>
                        <span className="kpi-ic" style={{ background: e.format === 'Csv' ? 'var(--violet-50)' : 'var(--green-50)', color: e.format === 'Csv' ? 'var(--violet)' : 'var(--green)' }}>
                          {e.format === 'Csv' ? <FileText size={17} /> : <FileSpreadsheet size={17} />}</span>
                        <b className="small">{e.fileName}</b></div></td>
                      <td className="num"><b>{fmt.num(e.rowCount)}</b></td>
                      <td className="num muted">{fmt.fileSize(e.fileSizeBytes)}</td>
                      <td className="small muted" style={{ maxWidth: 260 }}>{e.filterSummary}</td>
                      <td className="small">{e.exportedByName || '—'}</td>
                      <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmt.date(e.createdAt)}<div className="muted">{fmt.time(e.createdAt)}</div></td>
                      <td><Button variant="secondary" size="sm" icon={Download} loading={busy === e.id} onClick={() => dl(e)}>Download</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} setPage={setPage} data={data} />
          </>
        )}
      </QueryView>
    </section>
  );
}

function SalesmanLogs() {
  const { activeGroupId: gid } = useSession();
  const [memberId, setMemberId] = useState('');
  const [page, setPage] = useState(1);
  const salesmen = useQuery({ queryKey: ['salesmen', gid], queryFn: () => api.salesmen(gid) });
  const q = useQuery({ queryKey: ['salesmanLogs', gid, memberId, page], queryFn: () => api.salesmanLogs(gid, memberId || undefined, page) });

  return (
    <>
      {salesmen.data?.length > 0 && (
        <div className="chips">
          <button className={`chip ${!memberId ? 'on' : ''}`} onClick={() => { setMemberId(''); setPage(1); }}>All salesmen</button>
          {salesmen.data.map((s) => <button key={s.memberId} className={`chip ${memberId === s.memberId ? 'on' : ''}`} onClick={() => { setMemberId(s.memberId); setPage(1); }}>{s.displayName}</button>)}
        </div>
      )}
      <section className="card">
        <QueryView query={q}>
          {(data) => data.items.length === 0 ? <EmptyState icon={History} title="No activity yet" message="Salesman sign-in and sign-out activity appears here." /> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Salesman</th><th>Activity</th><th>Date &amp; time</th><th>Device</th></tr></thead>
                  <tbody>
                    {data.items.map((l) => (
                      <tr key={l.id}>
                        <td><div className="cell-person"><Avatar name={l.memberName || l.mobile} size={32} /><div><div className="n">{l.memberName || '—'}</div><div className="s num">{fmt.mobile(l.mobile)}</div></div></div></td>
                        <td>{l.type === 'Login' ? <Badge cls="b-live"><LogIn size={13} />Login</Badge> : l.type === 'Logout' ? <Badge cls="b-draft"><LogOut size={13} />Logout</Badge> : <Badge>{l.type}</Badge>}</td>
                        <td className="small">{fmt.dateTime(l.createdAt)}</td>
                        <td className="small muted" style={{ maxWidth: 320 }}><span className="truncate" style={{ display: 'block' }}>{l.deviceInfo || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} setPage={setPage} data={data} />
            </>
          )}
        </QueryView>
      </section>
    </>
  );
}
