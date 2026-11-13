import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt, validators } from '../../lib/format';
import { Button, Field, Modal, useUi } from '../../components/ui';

/** Invite one or more salesmen by mobile; optionally pre-assign a form. */
export default function InviteModal({ groupId, formId, formName, onClose }) {
  const ui = useUi();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [numbers, setNumbers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function add() {
    // Accept several numbers pasted at once (comma, space or newline separated)
    const parts = input.split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return numbers;
    const bad = parts.filter((p) => !validators.isMobile(p));
    if (bad.length) { setError(`Not a valid mobile: ${bad.join(', ')}`); return null; }
    const next = [...new Set([...numbers, ...parts.map(validators.normalizeMobile)])];
    setNumbers(next); setInput(''); setError('');
    return next;
  }

  async function send() {
    const list = input.trim() ? add() : numbers;
    if (!list) return;
    if (!list.length) { setError('Add at least one mobile number.'); return; }
    setBusy(true);
    try {
      const r = await api.invite(groupId, list, formId);
      qc.invalidateQueries({ queryKey: ['invitations', groupId] });
      qc.invalidateQueries({ queryKey: ['analytics', groupId] });
      if (r.data.skipped.length) ui.info(`${r.message} Skipped: ${r.data.skipped.map((s) => `${s.mobile} (${s.reason})`).join(', ')}`);
      else ui.success(r.message);
      onClose();
    } catch (e) { ui.error(e); setBusy(false); }
  }

  return (
    <Modal
      title="Invite salesmen"
      subtitle={formName ? `They will join the group and be assigned to “${formName}”.` : 'They get the invitation in their QuickLeads inbox.'}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Send} loading={busy} onClick={send}>{numbers.length > 1 ? `Send ${numbers.length} invitations` : 'Send invitation'}</Button></>}
    >
      <Field label="Mobile numbers" htmlFor="inv-m" error={error} help="Paste several numbers separated by commas or new lines.">
        <div className="row" style={{ gap: 8 }}>
          <div className="input-group grow">
            <span className="addon">+91</span>
            <input id="inv-m" className={`input ${error ? 'invalid' : ''}`} autoFocus value={input} placeholder="98765 43210"
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          </div>
          <Button variant="secondary" icon={Plus} onClick={add} aria-label="Add number">Add</Button>
        </div>
      </Field>
      {numbers.length > 0 && (
        <div className="chips">
          {numbers.map((n) => (
            <span key={n} className="chip on">{fmt.mobile(n)}
              <button className="x" aria-label={`Remove ${n}`} onClick={() => setNumbers(numbers.filter((x) => x !== n))}>×</button>
            </span>
          ))}
        </div>
      )}
    </Modal>
  );
}
