// utilitário simples de comparação de versos (word-level LCS)
export function compareVerses(aText = '', bText = '') {
  const normalize = s => (s || '').toString().trim().replace(/\s+/g, ' ');
  const A = normalize(aText).length ? normalize(aText).split(' ') : [];
  const B = normalize(bText).length ? normalize(bText).split(' ') : [];
  const n = A.length, m = B.length;

  // tabela DP para LCS
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; --i) {
    for (let j = m - 1; j >= 0; --j) {
      dp[i][j] = (A[i] === B[j]) ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // backtrack para produzir tokens marcados
  let i = 0, j = 0;
  const tokens = [];
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      tokens.push({ text: A[i], type: 'equal' });
      i++; j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      tokens.push({ text: B[j], type: 'added' });
      j++;
    } else if (i < n) {
      tokens.push({ text: A[i], type: 'removed' });
      i++;
    } else {
      break;
    }
  }

  // merge tokens adjacentes do mesmo tipo
  const merged = [];
  for (const t of tokens) {
    if (merged.length && merged[merged.length - 1].type === t.type) {
      merged[merged.length - 1].text += ' ' + t.text;
    } else {
      merged.push({ ...t });
    }
  }

  return merged;
}

export default compareVerses;
