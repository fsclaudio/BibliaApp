import React from 'react';
import compareVerses from '../utils/diff';

export default function DiffVerse({ leftText = '', rightText = '' }) {
  const segments = compareVerses(leftText, rightText);
  return (
    <span>
      {segments.map((s, idx) => {
        if (s.type === 'equal') return <span key={idx}>{s.text} </span>;
        if (s.type === 'removed') return <span key={idx} style={{ background: '#ffe6e6', textDecoration: 'line-through', padding: '0 4px', borderRadius: 4 }}>{s.text} </span>;
        return <span key={idx} style={{ background: '#e6ffea', padding: '0 4px', borderRadius: 4 }}>{s.text} </span>;
      })}
    </span>
  );
}
