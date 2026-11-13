import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Filter, Search, UserSearch, X } from 'lucide-react';
import { api, downloadExport } from '../../lib/api';
import { PAGE_SIZE } from '../../lib/config';
import { addDays, fmt, sourceLabel, toDateOnly, today } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, Button, EmptyState, Field, Loader, Modal, useUi } from '../../components/ui';
import LeadDetailDrawer from './LeadDetailDrawer';

const EMPTY = { formIds: [], memberIds: [], enquiries: [], fromDate: '', toDate: '' };

export default function LeadsPage() {
  const { activeGroupId: gid } = useSession();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [leadId, setLeadId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const options = useQuery({ queryKey: ['leadOptions', gid], queryFn: () => api.leadFilterOptions(gid) });
  const params = { ...filter, search, page, pageSize: PAGE_SIZE };
  const q = useQuery({ queryKey: ['leads', gid, params], queryFn: () => api.leads(gid, params), placeholderData: (p) => p, refetchInterval: 60_000 });

  const active = filter.formIds.length + filter.memberIds.length + filter.enquiries.length + (filter.fromDate || filter.toDate ? 1 : 0);
  const names = useMemo(() => {
    const o = options.data;
    if (!o) return {};
    return Object.fromEntries([...o.forms, ...o.salesmen].map((x) => [x.id, x.name]));
  }, [options.data]);

  const chips = [
    ...filter.formIds.map((id) => ({ key: `f${id}`, label: names[id] || 'Form', remove: () => setFilter({ ...filter, formIds: filter.formIds.filter((x) => x !== id) }) })),
    ...filter.memberIds.map((id) => ({ key: `m${id}`, label: names[id] || 'Salesman', remove: () => setFilter({ ...filter, memberIds: filter.memberIds.filter((x) => x !== id) }) })),
    ...filter.enquiries.map((e) => ({ key: `e${e}`, label: e, remove: () => setFilter({ ...filter, enquiries: filter.enquiries.filter((x) => x !== e) }) })),
    ...(filter.fromDate || filter.toDate ? [{ key: 'd', label: `${filter.fromDate ? fmt.dateNum(filter.fromDate) : '…'} → ${filter.toDate ? fmt.dateNum(filter.toDate) : '…'}`, remove: () => setFilter({ ...filter, fromDate: '', toDate: '' }) }] : []),
  ];

  const data = q.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;

  return (
    <>
      <div className="page-head">
        <div className="titles"><h1>Leads</h1><p className="sub">Every completed lead in this group, latest first.</p></div>
        <div className="actions">
          <div className="search" style={{ width: 280 }}><Search size={16} /><input className="input" placeholder="Search name or mobile" aria-label="Search leads" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
          <Button variant="secondary" icon={Filter} onClick={() => setShowFilters(true)}>Filters{active > 0 && <Badge>{active}</Badge>}</Button>
          <Button icon={Download} disabled={!data?.totalCount} onClick={() => setExporting(true)}>Export</Button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="wrap-row">
          {chips.map((c) => <span key={c.key} className="chip on">{c.label}<button className="x" aria-label={`Remove ${c.label}`} onClick={() => { c.remove(); setPage(1); }}><X size={14} /></button></span>)}
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilter(EMPTY); setPage(1); }}>Reset</button>
        </div>
      )}

      <section className="card">
        {q.isLoading ? <Loader /> : !data?.items.length ? (
          <EmptyState icon={UserSearch} title={search || active ? 'No matching leads' : 'No leads yet'}
            message={search || active ? 'Try a different search or reset the filters.' : 'Leads captured by your salesmen and via QR codes appear here.'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Lead</th><th>Mobile</th><th>Enquiry</th><th>Form</th><th>Captured by</th><th>Captured</th></tr></thead>
                <tbody style={{ opacity: q.isFetching && !q.isLoading ? 0.6 : 1 }}>
                  {data.items.map((l) => (
                    <tr key={l.id} className="clickable" onClick={() => setLeadId(l.id)}>
                      <td>
                        <div className="cell-person">
                          <Avatar name={l.fullName} size={34} />
                          <div className="grow"><div className="n truncate">{l.fullName}</div>
                            <div className="wrap-row" style={{ gap: 4 }}>{l.isDuplicate && <Badge cls="b-amber">Duplicate</Badge>}{l.source !== 'App' && <Badge cls="b-violet">{sourceLabel(l.source)}</Badge>}</div>
                          </div>
                        </div>
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmt.mobile(l.mobile)}</td>
                      <td>{l.enquiryAbout ? <Badge>{l.enquiryAbout}</Badge> : <span className="muted">—</span>}</td>
                      <td className="small">{l.formName}</td>
                      <td className="small">{l.salesmanName || <span className="muted">Direct link</span>}</td>
                      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmt.relative(l.capturedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>Showing <b className="num">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.totalCount)}</b> of <b className="num">{fmt.num(data.totalCount)}</b></span>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="num">Page {page} of {pages}</span>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next<ChevronRight size={15} /></Button>
              </div>
            </div>
          </>
        )}
      </section>

      {showFilters && <FilterModal options={options.data} initial={filter} onClose={() => setShowFilters(false)} onApply={(f) => { setFilter(f); setPage(1); setShowFilters(false); }} />}
      {exporting && <ExportModal groupId={gid} filter={{ ...filter, search }} total={data?.totalCount || 0} onClose={() => setExporting(false)} />}
      {leadId && <LeadDetailDrawer leadId={leadId} onClose={() => setLeadId(null)} />}
    </>
  );
}

function FilterModal({ options, initial, onApply, onClose }) {
  const [f, setF] = useState(initial);
  const toggle = (key, v) => setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  const quick = (days) => setF({ ...f, fromDate: toDateOnly(addDays(today(), -(days - 1))), toDate: toDateOnly(today()) });

  return (
    <Modal wide title="Filter leads" onClose={onClose}
      footer={<><Button variant="ghost" onClick={() => setF(EMPTY)}>Reset</Button><span className="grow" /><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onApply(f)}>Apply filters</Button></>}>
      {!options ? <Loader /> : (
        <>
          <Field label="Date range">
            <div className="wrap-row">
              {[['Today', 1], ['Last 7 days', 7], ['Last 30 days', 30]].map(([l, d]) => <button key={l} className="chip" onClick={() => quick(d)}>{l}</button>)}
              <input type="date" className="input" style={{ width: 160 }} aria-label="From date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} />
              <span className="muted">to</span>
              <input type="date" className="input" style={{ width: 160 }} aria-label="To date" value={f.toDate} min={f.fromDate || undefined} onChange={(e) => setF({ ...f, toDate: e.target.value })} />
            </div>
          </Field>
          {options.forms.length > 0 && <Field label="Form"><div className="chips">{options.forms.map((x) => <button key={x.id} className={`chip ${f.formIds.includes(x.id) ? 'on' : ''}`} onClick={() => toggle('formIds', x.id)}>{x.name}</button>)}</div></Field>}
          {options.salesmen.length > 0 && <Field label="Salesman"><div className="chips">{options.salesmen.map((x) => <button key={x.id} className={`chip ${f.memberIds.includes(x.id) ? 'on' : ''}`} onClick={() => toggle('memberIds', x.id)}>{x.name}</button>)}</div></Field>}
          {options.enquiries.length > 0 && <Field label="Enquiry about"><div className="chips">{options.enquiries.map((x) => <button key={x} className={`chip ${f.enquiries.includes(x) ? 'on' : ''}`} onClick={() => toggle('enquiries', x)}>{x}</button>)}</div></Field>}
        </>
      )}
    </Modal>
  );
}

function ExportModal({ groupId, filter, total, onClose }) {
  const ui = useUi();
  const qc = useQueryClient();
  const [format, setFormat] = useState('Xlsx');
  const [busy, setBusy] = useState(false);
  const filtered = filter.search || filter.formIds.length || filter.memberIds.length || filter.enquiries.length || filter.fromDate || filter.toDate;

  async function run() {
    setBusy(true);
    try {
      const r = await api.exportLeads(groupId, {
        search: filter.search, formIds: filter.formIds, memberIds: filter.memberIds, enquiries: filter.enquiries,
        fromDate: filter.fromDate || null, toDate: filter.toDate || null,
      }, format);
      await downloadExport(r.data.id, r.data.fileName);
      ui.success(r.message);
      qc.invalidateQueries({ queryKey: ['exports', groupId] });
      onClose();
    } catch (e) { ui.error(e); setBusy(false); }
  }

  return (
    <Modal title="Export leads" subtitle={filtered ? `Exports the ${fmt.num(total)} leads matching your search and filters.` : `Exports all ${fmt.num(total)} completed leads.`}
      onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Download} loading={busy} onClick={run}>Export &amp; download</Button></>}>
      {[['Xlsx', 'Excel (.xlsx)', 'Best for reports and follow-up', FileSpreadsheet], ['Csv', 'CSV (.csv)', 'For importing into a CRM', FileText]].map(([v, t, d, Icon]) => (
        <label key={v} className="choice" style={{ padding: 14, borderColor: format === v ? 'var(--sky)' : undefined, background: format === v ? 'var(--sky-50)' : undefined }}>
          <input type="radio" name="fmt" checked={format === v} onChange={() => setFormat(v)} style={{ accentColor: '#0369A1' }} />
          <span className="kpi-ic" style={{ background: 'var(--sky-100)', color: 'var(--sky-700)' }}><Icon size={18} /></span>
          <span className="grow"><b>{t}</b><span className="muted small" style={{ display: 'block' }}>{d}</span></span>
        </label>
      ))}
      <p className="muted small">Each export is recorded in Logs with its row count and can be downloaded again later.</p>
    </Modal>
  );
}
