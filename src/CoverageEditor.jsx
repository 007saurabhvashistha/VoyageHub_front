import { useEffect, useState } from 'react';
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';
import { Ban, Check, MapPin, X } from 'lucide-react';
import { getDestinationChildren, getDestinationCountries } from './api.js';
import { DestinationPicker } from './DestinationPicker.jsx';
import { labelFor, useReferenceData } from './referenceData.js';

const toNode = (destination) => ({ key: destination.id, title: destination.name, isLeaf: !destination.hasChildren, destination });

function insertChildren(nodes, key, children) {
  return nodes.map((node) => {
    if (node.key === key) return { ...node, children };
    return node.children ? { ...node, children: insertChildren(node.children, key, children) } : node;
  });
}

/**
 * DMC coverage as include/exclude rules over the destination tree (country > level 1 > level 2 > place).
 * The most specific rule wins on the server, so "whole region except one district" is two rules.
 */
export function CoverageEditor({ rules, onChange, max }) {
  const { data: reference } = useReferenceData();
  const [treeData, setTreeData] = useState([]);
  const [error, setError] = useState('');
  const byId = new Map(rules.map((rule) => [rule.destination.id, rule]));

  useEffect(() => {
    getDestinationCountries()
      .then((result) => setTreeData(result.countries.map(toNode)))
      .catch((requestError) => setError(requestError.message));
  }, []);

  async function loadData(node) {
    if (node.children) return;
    const result = await getDestinationChildren(node.key);
    setTreeData((current) => insertChildren(current, node.key, result.destinations.map(toNode)));
  }

  function setMode(destination, mode) {
    const others = rules.filter((rule) => rule.destination.id !== destination.id);
    if (!mode) return onChange(others);
    if (!byId.has(destination.id) && rules.length >= max) return undefined;
    return onChange([...others, { destination, mode }]);
  }

  function titleRender(node) {
    const mode = byId.get(node.key)?.mode;
    return (
      <span className={`coverage-node ${mode ?? ''}`}>
        <span>{node.title}<small>{node.destination.kindLabel}</small></span>
        <span className="coverage-node-actions">
          <button type="button" className={`coverage-toggle ${mode === 'include' ? 'active' : ''}`} title="We cover this area" aria-label={`Cover ${node.title}`} onClick={(event) => { event.stopPropagation(); setMode(node.destination, mode === 'include' ? null : 'include'); }}><Check size={12} /></button>
          <button type="button" className={`coverage-toggle exclude ${mode === 'exclude' ? 'active' : ''}`} title="We do not cover this area" aria-label={`Exclude ${node.title}`} onClick={(event) => { event.stopPropagation(); setMode(node.destination, mode === 'exclude' ? null : 'exclude'); }}><Ban size={12} /></button>
        </span>
      </span>
    );
  }

  return (
    <fieldset className="coverage-editor">
      <legend>Areas you cover ({rules.length}/{max})</legend>
      <p className="table-secondary">Cover a whole state, only some districts, or single places. Mark an area inside a covered one as not covered to exclude it.</p>
      {rules.length > 0 && <div className="invite-chips">{rules.map((rule) => (
        <button type="button" key={rule.destination.id} className={`invite-chip coverage-chip ${rule.mode}`} onClick={() => setMode(rule.destination, null)} aria-label={`Remove ${rule.destination.label}`}>
          {rule.mode === 'exclude' ? <Ban size={12} /> : <MapPin size={12} />}{labelFor(reference?.coverageModes, rule.mode)}: {rule.destination.label}<X size={12} />
        </button>
      ))}</div>}
      <DestinationPicker label="Quick add a covered area" value={[]} onChange={([destination]) => destination && setMode(destination, 'include')} placeholder="Search a state, district or place" />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="coverage-tree">
        {treeData.length ? <Tree treeData={treeData} loadData={loadData} titleRender={titleRender} selectable={false} /> : <small className="table-secondary">Loading destinations...</small>}
      </div>
    </fieldset>
  );
}
