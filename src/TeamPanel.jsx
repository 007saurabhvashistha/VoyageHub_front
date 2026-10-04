import { useEffect, useState } from 'react';
import { Copy, MailPlus, Trash2, UsersRound } from 'lucide-react';
import { inviteTeamMember, listTeamAuditEvents, listTeamInvitations, listTeamMembers, removeTeamMember, revokeTeamInvitation, updateTeamMemberRole } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';

export function TeamPanel({ account }) {
  const { data: reference } = useReferenceData();
  const canManage = account.capabilities?.includes('team.manage');
  const isOwner = account.organization.accessRole === 'owner';
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [busy, setBusy] = useState('');

  const roles = reference?.memberRoles ?? [];
  const invitableRoles = roles.filter((role) => role.value !== 'owner');
  const assignableRoles = isOwner ? roles : invitableRoles;

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [memberResult, invitationResult, eventResult] = await Promise.all([
        listTeamMembers(),
        canManage ? listTeamInvitations() : Promise.resolve({ invitations: [] }),
        canManage ? listTeamAuditEvents() : Promise.resolve({ events: [] }),
      ]);
      setMembers(memberResult.members);
      setInvitations(invitationResult.invitations);
      setEvents(eventResult.events);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [canManage]);
  useEffect(() => {
    if (inviteRole || !invitableRoles.length) return;
    const working = invitableRoles.filter((role) => role.capabilities.length).sort((left, right) => left.capabilities.length - right.capabilities.length);
    setInviteRole((working[0] ?? invitableRoles[0]).value);
  }, [invitableRoles.length]);

  async function run(key, action, successMessage) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      await refresh();
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function sendInvite(event) {
    event.preventDefault();
    await run('invite', async () => {
      const result = await inviteTeamMember(inviteEmail, inviteRole);
      setInviteLink(new URL(result.acceptPath, window.location.origin).toString());
      setInviteEmail('');
    }, 'Invitation created. Share the one-time link below with the invitee.');
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice('Invitation link copied.');
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  }

  return (
    <section className="surface-section full-section team-panel">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">ORGANIZATION</p><h2>Team <span className="heading-count">{members.length}</span></h2></div><span className="match-filter"><UsersRound size={14} />Your role: {labelFor(roles, account.organization.accessRole)}</span></div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}

      {canManage && (
        <form className="team-invite-form" onSubmit={sendInvite}>
          <label className="field-label">Email<input className="form-input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} maxLength="254" required placeholder="colleague@company.com" /></label>
          <label className="field-label">Role<select className="form-select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{invitableRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <button className="primary-button" disabled={busy === 'invite' || !inviteRole}><MailPlus size={15} />{busy === 'invite' ? 'Inviting...' : 'Invite'}</button>
        </form>
      )}
      {inviteLink && <div className="invite-link-box"><input className="form-input" readOnly value={inviteLink} onFocus={(event) => event.target.select()} aria-label="Invitation link" /><button type="button" className="secondary-button" onClick={copyInviteLink}><Copy size={14} />Copy link</button><small>The link works once and expires in {reference?.limits?.invitationTtlHours ?? '-'} hours. Email delivery starts automatically once an email provider is configured.</small></div>}

      {loading ? <div className="empty-state">Loading team...</div> : (
        <div className="role-table-wrap"><table className="role-table"><thead><tr><th>MEMBER</th><th>ROLE</th><th>JOINED</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
          {members.map((member) => {
            const editable = canManage && !member.isYou && (isOwner || member.role !== 'owner');
            return <tr key={member.userId}>
              <td><strong>{member.fullName}{member.isYou ? ' (you)' : ''}</strong><small>{member.email}</small></td>
              <td>{editable ? <select className="form-select" value={member.role} disabled={busy === member.userId} onChange={(event) => run(member.userId, () => updateTeamMemberRole(member.userId, event.target.value), 'Role updated.')} aria-label={`Role for ${member.fullName}`}>{assignableRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select> : labelFor(roles, member.role)}</td>
              <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
              <td>{editable && <button className="icon-button" aria-label={`Remove ${member.fullName}`} disabled={busy === member.userId} onClick={() => window.confirm(`Remove ${member.fullName} from this organization?`) && run(member.userId, () => removeTeamMember(member.userId), 'Member removed and signed out.')}><Trash2 size={15} /></button>}</td>
            </tr>;
          })}
        </tbody></table></div>
      )}

      {canManage && invitations.length > 0 && <>
        <h3 className="team-subheading">Pending invitations</h3>
        <div className="role-table-wrap"><table className="role-table"><thead><tr><th>EMAIL</th><th>ROLE</th><th>EXPIRES</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
          {invitations.map((invitation) => <tr key={invitation.id}><td>{invitation.email}<small>Invited by {invitation.invitedBy ?? 'a former member'}</small></td><td>{labelFor(roles, invitation.role)}</td><td>{new Date(invitation.expiresAt).toLocaleString()}</td><td><button className="secondary-button" disabled={busy === invitation.id} onClick={() => run(invitation.id, () => revokeTeamInvitation(invitation.id), 'Invitation revoked.')}>Revoke</button></td></tr>)}
        </tbody></table></div>
      </>}

      {canManage && events.length > 0 && <>
        <h3 className="team-subheading">Recent team activity</h3>
        <ul className="team-activity">{events.slice(0, 20).map((event) => <li key={event.id}><strong>{event.action.replace('.', ' ').replace('_', ' ')}</strong><span>{event.actorName ?? 'Former member'}{event.targetName ? ` → ${event.targetName}` : ''}{event.details?.email ? ` (${event.details.email})` : ''}</span><time>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ul>
      </>}

      <p className="privacy-note"><UsersRound size={15} />Removing a member signs them out immediately. Role changes apply on their next action.</p>
    </section>
  );
}
