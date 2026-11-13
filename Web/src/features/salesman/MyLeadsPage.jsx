import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { Avatar, Badge, Button, EmptyState, QueryView } from '../../components/ui';

/** Salesman's own leads: name and time only. */
export default function MyLeadsPage() {
  const { activeGroupId: gid } = useSession();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['myLeads', gid, page], queryFn: () => api.myLeads(gid, page), placeholderData: (p) => p });

  return (
    <>
      <div className="page-head">
        <div className="titles"><h1>My leads</h1><p className="sub">Leads you captured, latest first.</p></div>
        {q.data && <Badge>{fmt.num(q.data.totalCount)} total</Badge>}
      </div>
      <section className="card">
        <QueryView query={q}>
          {(data) => data.items.length === 0 ? <EmptyState icon={Users} title="No leads yet" message="Leads you capture will appear here." /> : (
            <>
              {data.items.map((l) => (
                <div key={l.id} className="feed-item" style={{ cursor: 'default' }}>
                  <Avatar name={l.fullName} size={38} />
                  <div className="meta"><div className="n">{l.fullName}</div><div className="s">{fmt.relative(l.capturedAt)}</div></div>
                  <CheckCircle2 size={19} color="#15803D" />
                </div>
              ))}
              {data.totalCount > data.pageSize && (
                <div className="pager">
                  <span>Page {page} of {Math.ceil(data.totalCount / data.pageSize)}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="secondary" size="sm" disabled={!(page * data.pageSize < data.totalCount)} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </QueryView>
      </section>
    </>
  );
}
