import React, { useState, useEffect, useCallback } from 'react';
import DiffVerse from './components/DiffVerse';

const App = () => {
  // Estados existentes
  const [books, setBooks] = useState([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [selectedBook, setSelectedBook] = useState(localStorage.getItem('lastBook') || 'gn');
  const [selectedChapter, setSelectedChapter] = useState(Number(localStorage.getItem('lastCap')) || 1);
  const [activeVersions, setActiveVersions] = useState(['nvi', 'acf']);

  const currentBook = books.find(b => b.abbrev.pt === selectedBook);
  const totalChapters = currentBook ? currentBook.chapters : 0;
  // Atualiza o localStorage sempre que mudar o capítulo
  useEffect(() => {
    localStorage.setItem('lastCap', selectedChapter);
  }, [selectedChapter]);

  // Se mudar o livro, resetar para o capítulo 1 caso o atual não exista no novo livro
  useEffect(() => {
    if (totalChapters > 0 && selectedChapter > totalChapters) {
      setSelectedChapter(1);
    }
  }, [selectedBook, totalChapters]);

  // Versões disponíveis provenientes da API (version + total verses)
  const apiVersions = [
    { version: 'acf', verses: 'Almeida Corrigida Fiel ' },
    { version: 'apee', verses: 30975 },
    { version: 'bbe', verses: 'Simple Bible in Basic English '},
    { version: 'kjv', verses: 'Rei Jaimes Ingles' },
    { version: 'bkj', verses: 'Rei Jaimes Fiel PT' },
    { version: 'nvi', verses: 'Nova Versão Internacional '},
    { version: 'ra', verses: 'Almeida Revista e Atualizada'},
    { version: 'rvr', verses: 'Reina-Valera'},
  ];
  const availableVersions = apiVersions.map(v => v.version);
  const [content, setContent] = useState({});
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('favs')) || []);
  const [loadError, setLoadError] = useState(null);
  const [booksLoading, setBooksLoading] = useState(false);
  // Search (POST /api/verses/search)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVersion, setSearchVersion] = useState(activeVersions[0] || 'nvi');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  // Token de API (pode ser salvo em localStorage). Se preferir, substitua pelo seu token.
  const apiToken = localStorage.getItem('api_token') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHIiOiJNb24gTWFyIDMwIDIwMjYgMTc6NTk6NTMgR01UKzAwMDAuZnNjbGF1ZGlvQGdtYWlsLmNvbSIsImlhdCI6MTc3NDg5MzU5M30.7dLxSUyQcv_xMthRt8DYm9II8kZZCL3mZqdt9ZK5QU8';
  const buildHeaders = useCallback((extra = {}) => {
    const headers = { 'Accept': 'application/json', ...extra };
    if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;
    return headers;
  }, [apiToken]);

  const tryFetchJson = useCallback(async (paths) => {
    for (const p of paths) {
      try {
        const res = await fetch(p, { headers: buildHeaders() });
        if (!res.ok) {
          console.warn(`Tentativa ${p} retornou status ${res.status}`);
          continue;
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const txt = await res.text();
          console.warn(`Tentativa ${p} retornou tipo ${ct}; início do corpo:`, txt.slice(0, 300));
          continue;
        }
        return await res.json();
      } catch (err) {
        console.warn(`Erro ao tentar ${p}:`, err && err.code ? err.code : err.message || err);
        continue;
      }
    }
    throw new Error('Todas as tentativas falharam');
  }, [buildHeaders]);

  // Helper to POST JSON to multiple endpoints (tries sequentially)
  const tryPostJson = useCallback(async (paths, body) => {
    const payload = JSON.stringify(body || {});
    for (const p of paths) {
      try {
        const res = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...buildHeaders() }, body: payload });
        if (!res.ok) {
          console.warn(`POST tentativa ${p} retornou status ${res.status}`);
          continue;
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const txt = await res.text();
          console.warn(`POST tentativa ${p} retornou tipo ${ct}; início do corpo:`, txt.slice(0, 300));
          continue;
        }
        return await res.json();
      } catch (err) {
        console.warn(`Erro no POST para ${p}:`, err && err.name ? err.name : err && err.message ? err.message : err);
        continue;
      }
    }
    throw new Error('Todas as tentativas POST falharam');
  }, [buildHeaders]);

  const doSearch = useCallback(async () => {
    if (!searchQuery || searchQuery.trim().length === 0) return setSearchError('Digite um termo para buscar');
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    const body = { version: searchVersion, search: searchQuery };
    const paths = [
      '/api/verses/search',
      'https://www.abibliadigital.com.br/api/verses/search'
    ];
    try {
      const json = await tryPostJson(paths, body);
      // json pode ter vários formatos, normalizamos um array de versos
      const results = Array.isArray(json) ? json : (json?.verses || json?.results || []);
      setSearchResults(results);
    } catch (err) {
      console.error('doSearch falhou:', err);
      setSearchError(err.message || 'Falha na busca');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, searchVersion, tryPostJson]);

  // ... (Efeitos de carregamento de livros e versículos permanecem os mesmos)

  useEffect(() => {
    let mounted = true;
    const fetchAllVersions = async () => {
      if (!booksLoaded) {
        console.log('Aguardando lista de livros antes de buscar versículos...');
        return;
      }
      const results = {};
      // 1. Criamos um mapa para converter suas siglas (gn, mt...) nos números que a API Bolls exige
const bollsBookMap = {
  'gn': 1, 'ex': 2, 'lv': 3, 'nm': 4, 'dt': 5, 'js': 6, 'jz': 7, 'rt': 8, '1sm': 9, '2sm': 10,
  '1rs': 11, '2rs': 12, '1cr': 13, '2cr': 14, 'ed': 15, 'ne': 16, 'et': 17, 'jo': 18, 'ps': 19, 'pv': 20,
  'ec': 21, 'ct': 22, 'is': 23, 'jr': 24, 'lm': 25, 'ez': 26, 'dn': 27, 'os': 28, 'jl': 29, 'am': 30,
  'ob': 31, 'jn': 32, 'mq': 33, 'na': 34, 'hc': 35, 'sf': 36, 'ag': 37, 'zc': 38, 'ml': 39,
  'mt': 40, 'mc': 41, 'lc': 42, 'joao': 43, 'at': 44, 'rm': 45, '1co': 46, '2co': 47, 'gl': 48, 'ef': 49,
  'fp': 50, 'cl': 51, '1ts': 52, '2ts': 53, '1tm': 54, '2tm': 55, 'tt': 56, 'fm': 57, 'hb': 58, 'tg': 59,
  '1pe': 60, '2pe': 61, '1jo': 62, '2jo': 63, '3jo': 64, 'jd': 65, 'ap': 66
};

for (const v of activeVersions) {
  try {
    let json;

    // Se a versão for King James (kja ou bkj), buscamos na API Bolls
    if (v === 'kja' || v === 'bkj') {
      const bookId = bollsBookMap[selectedBook] || 1;
       const bollsUrl = `https://bolls.life/get-chapter/KJA/${bookId}/${selectedChapter}/`;
      
      const res = await fetch(bollsUrl);
      const rawData = await res.json();
      
      // Normalizamos o formato da Bolls para o formato da ABíbliaDigital que seu app já usa
      json = {
        verses: rawData.map(v => ({
          number: v.verse,
          text: v.text
        }))
      };
    } else {
      // Lógica Original para as outras versões (nvi, acf, ra...)
      const paths = [
        `/api/verses/${v}/${selectedBook}/${selectedChapter}`,
        `https://www.abibliadigital.com.br/api/verses/${v}/${selectedBook}/${selectedChapter}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.abibliadigital.com.br/api/verses/${v}/${selectedBook}/${selectedChapter}`)}`,
      ];
      json = await tryFetchJson(paths);
    }

    results[v] = json;
  } catch (e) {
    console.error(`Falha ao carregar versão ${v}:`, e);
    results[v] = { verses: [] };
    if (mounted) setLoadError('Erro ao carregar a versão ' + v);
  }
}

      if (mounted) setContent(results);
    };

    fetchAllVersions();
    return () => { mounted = false; };
  }, [selectedBook, selectedChapter, activeVersions, booksLoaded, tryFetchJson]);

  // Buscar lista de livros e popular `books`
  useEffect(() => {
    let mounted = true;

    // Normaliza o payload retornado pela API para o formato esperado pelo app
    const normalizeBooks = (raw) => {
      if (!raw) return [];
      // Se já for um array com os campos, retorna mapeado
      if (Array.isArray(raw)) {
        return raw.map(b => ({
          name: b.name ?? (b.nome ?? ''),
          abbrev: b.abbrev ?? { pt: (b.abbrev_pt ?? b.pt ?? '').toString() },
          author: b.author ?? b.autor ?? '',
          chapters: Number(b.chapters ?? b.capitulos ?? 0),
          group: b.group ?? b.grupo ?? '',
          testament: (b.testament ?? b.testamento ?? b.testamentName ?? '').toString(),
        }));
      }
      // se for objeto com propriedade data, tentar extrair
      if (typeof raw === 'object' && raw !== null && raw.data) {
        return normalizeBooks(raw.data);
      }
      return [];
    };

    const BOOKS_CACHE_KEY = 'books_cache_v1';
    const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

    const fetchWithTimeout = async (resource, options = {}) => {
      const { timeout = 5000 } = options;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    };

    const fetchBooks = async () => {
      setBooksLoading(true);
      try {
        // tentar usar cache local para respeitar limite de 20 req/h da API pública
        try {
          const cached = JSON.parse(localStorage.getItem(BOOKS_CACHE_KEY) || 'null');
          if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
            const normalized = normalizeBooks(cached.payload);
            if (mounted) {
              setBooks(normalized);
              setBooksLoaded(true);
            }
            return;
          }
        } catch {
          console.warn('Cache de livros inválido, continuando para fetch remoto');
        }

        // Tentar endpoints possíveis para lista de livros: remoto direto (com token) primeiro,
        // depois proxy local, depois rota pt. Evitamos proxies públicos para reduzir latência.
        const tryPaths = [
          { url: '/api/books', timeout: 3000 },
          { url: 'https://www.abibliadigital.com.br/api/books', timeout: 5000 },
        ];

        let success = false;
        for (const p of tryPaths) {
          try {
            const r = await fetchWithTimeout(p.url, { headers: buildHeaders(), timeout: p.timeout });
            if (r.status === 429) {
              // limitação da API pública
              console.warn(`Rate limit atingido ao tentar ${p.url}`);
              setLoadError('Limite de requisições atingido para /books. Aguarde ou autentique-se para remover limites.');
              break;
            }
            if (!r.ok) {
              console.warn(`Tentativa ${p.url} retornou status ${r.status}`);
              continue;
            }
            const ct = r.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
              const txt = await r.text();
              console.warn(`Tentativa ${p.url} retornou tipo ${ct}; corpo inicial:`, txt.slice(0, 300));
              continue;
            }
            const json = await r.json();
            console.debug('fetchBooks: resposta de', p.url, json);
            let normalized = normalizeBooks(json);
            // Se a normalização não retornou nada, mas o payload é um array,
            // usar o array cru como fallback para popular o select (ajuda na depuração).
            if ((!normalized || normalized.length === 0) && Array.isArray(json)) {
              console.warn('normalizeBooks retornou vazio; usando payload bruto como fallback para popular books');
              normalized = json;
            }
            if (mounted) {
              setBooks(normalized);
              setBooksLoaded(true);
            }
            // salvar cache local
            try {
              localStorage.setItem(BOOKS_CACHE_KEY, JSON.stringify({ ts: Date.now(), payload: json }));
            } catch (err) { console.warn('Falha ao salvar cache de livros:', err); }
            success = true;
            break;
          } catch (e) {
            console.warn(`Erro ao tentar ${p.url}:`, e && e.name ? e.name : e && e.message ? e.message : e);
          }
        }

  if (!success) {
          console.error('Não foi possível obter lista de livros em nenhuma rota tentada. Veja os logs acima para detalhes.');
          // fallback local: usar arquivo em public/books-fallback.json para desenvolvimento
          try {
            const fb = await fetch('/books-fallback.json');
            if (fb.ok) {
              const json = await fb.json();
              const normalized = normalizeBooks(json);
              if (mounted) {
                setBooks(normalized);
                console.log('fetchBooks: usando livros do books',books);
                setBooksLoaded(true);
                setLoadError('Usando lista de livros local (fallback) - API remota indisponível.');
              }
            } else {
              if (mounted) setLoadError('Não foi possível carregar a lista de livros (incluindo fallback). Veja o console para detalhes.');
            }
          } catch (e) {
            console.error('Falha ao carregar fallback local de livros:', e);
            if (mounted) setLoadError('Não foi possível carregar a lista de livros. Veja o console para detalhes.');
          }
        }
      } catch (err) {
        console.error('Erro ao buscar livros:', err);
      } finally {
        setBooksLoading(false);
      }
    };
    fetchBooks();
    return () => { mounted = false; };
  }, [buildHeaders]);

  // NOVO: Função para Exportar Favoritos
  const exportFavorites = () => {
    if (favorites.length === 0) return alert("Sua lista de favoritos está vazia!");

    let textContent = "MINHAS PASSAGENS FAVORITAS\n";
    textContent += "===========================\n\n";

    favorites.forEach((f, index) => {
      textContent += `${index + 1}. ${f.bookName.toUpperCase()} ${f.cap}:${f.number}\n`;
      textContent += `${f.text}\n`;
      textContent += `---------------------------\n`;
    });

    const element = document.createElement("a");
    const file = new Blob([textContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "favoritos_biblia.txt";
    document.body.appendChild(element); // Necessário para Firefox
    element.click();
  };

  // Permite alternar uma versão ativa (checkbox). Não permite remover a última versão.
  const toggleVersion = (version) => {
    setActiveVersions(prev => {
      if (prev.includes(version)) {
        if (prev.length === 1) return prev; // protege contra lista vazia
        return prev.filter(v => v !== version);
      }
      return [...prev, version];
    });
  };

  const toggleFavorite = (verse) => {
    const isFav = favorites.find(f => f.text === verse.text);
    let newFavs = isFav ? favorites.filter(f => f.text !== verse.text) : [...favorites, { ...verse, bookName: selectedBook, cap: selectedChapter }];
    setFavorites(newFavs);
    localStorage.setItem('favs', JSON.stringify(newFavs));
  };

  return (
    <div style={styles.container}>
      {loadError && (
        <div style={{ background: '#ffe6e6', color: '#900', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
          {loadError}
        </div>
      )}
      <header style={styles.header}>
        <h1>📖 Bíblia Completa Em Versões</h1>
          <div style={styles.controls}>
  {/* Combo de Livros */}
  <div style={styles.selectContainer}>
    <label style={styles.selectLabel}>Livro</label>
    <select 
      style={styles.selectField}
      value={selectedBook} 
      onChange={(e) => setSelectedBook(e.target.value)}
    >
      {books.map(b => (
        <option key={b.abbrev.pt} value={b.abbrev.pt}>{b.name}</option>
      ))}
    </select>
  </div>
          {/* Combo de Capítulos */}
  <div style={styles.selectContainer}>
    <label style={styles.selectLabel}>Capítulo</label>
    <select 
      style={styles.selectField}
      value={selectedChapter} 
      onChange={(e) => setSelectedChapter(Number(e.target.value))}
    >
      {Array.from({ length: totalChapters }, (_, i) => i + 1).map(cap => (
        <option key={cap} value={cap}>
          {cap}
        </option>
      ))}
    </select>
  </div>
            <button onClick={() => setSelectedChapter(prev => Math.max(1, prev - 1))}>⬅️</button>
            <span>Cap. {selectedChapter}</span>
            <button onClick={() => setSelectedChapter(prev => prev + 1)}>➡️</button>
          <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', alignItems: 'center' }}>
            {booksLoading ? (
              <span key="loading">Carregando versões...</span>
            ) : (
              availableVersions.map(v => {
                const meta = apiVersions.find(x => x.version === v) || {};
                const count = meta.verses ? ` (${meta.verses})` : '';
                return (
                  <label key={v} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={activeVersions.includes(v)} onChange={() => toggleVersion(v)} />
                    {v.toUpperCase()}{count}
                  </label>
                );
              })
            )}
          </div>
          {/* Busca por texto (POST /api/verses/search) */}
          <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', alignItems: 'center' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar texto (ex: terra)"
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
            <select value={searchVersion} onChange={(e) => setSearchVersion(e.target.value)}>
              {availableVersions.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
            <button onClick={doSearch} disabled={searchLoading} style={{ padding: '6px 10px' }}>{searchLoading ? 'Buscando...' : 'Buscar'}</button>
            {!apiToken && (
              <span style={{ color: '#a33', fontSize: '0.8rem', marginLeft: 8 }}>Sem token: limite 20 req/h</span>
            )}
          </div>
        </div>
      </header>

      {/* Resultados de busca */}
      {searchError && (
        <div style={{ background: '#fff4e5', padding: 10, margin: '8px 0', borderRadius: 6, color: '#a33' }}>{searchError}</div>
      )}
      {searchResults && searchResults.length > 0 && (
        <section style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <h3>Resultados da busca ({searchResults.length})</h3>
          {searchResults.map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
              <strong>{(r.book_name || r.book || '')} {r.chapter ?? r.cap}:{r.number ?? r.verse}</strong>
              <p style={{ margin: '4px 0' }}>{r.text ?? JSON.stringify(r)}</p>
            </div>
          ))}
        </section>
      )}

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* SIDEBAR COM EXPORTAÇÃO */}
        <aside style={styles.favSidebar}>
          <h3>⭐ Favoritos</h3>
          <button 
            onClick={exportFavorites} 
            style={styles.btnExport}
            disabled={favorites.length === 0}
          >
            📥 Baixar .TXT
          </button>
          
          <div style={{ marginTop: '15px' }}>
            {favorites.map((f, i) => (
              <div key={i} style={styles.favItem}>
                <strong>{(f.bookName ?? '').toString().toUpperCase()} {f.cap}:{f.number}</strong>
                <p style={{fontSize: '0.85rem'}}>{(f.text ?? '').toString().substring(0, 30)}...</p>
                <button onClick={() => toggleFavorite(f)} style={{color: 'red', border: 'none', background: 'none', cursor: 'pointer'}}>Remover</button>
              </div>
            ))}
          </div>
        </aside>

        {/* ÁREA PRINCIPAL */}
        <main style={styles.grid(activeVersions.length)}>
          {activeVersions.map((v, index) => (
            <div key={v} style={styles.column(index)}>
              <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '5px', fontSize: '1.1rem' }}>
  {apiVersions.find(api => api.version === v)?.verses || v.toUpperCase()}</h2>
              {content[v]?.verses?.map((verse, idx) => (
                <div key={`${v}-${verse?.number ?? idx}`} style={styles.verseWrapper}>
                  <button 
                    onClick={() => toggleFavorite(verse)} 
                    style={{ ...styles.btnStar, color: favorites.some(f => f.text === verse.text) ? '#f1c40f' : '#ccc' }}
                  >
                    ★
                  </button>
                  <p>
                    <strong>{verse.number}</strong>{' '}
                    {(() => {
                      const baseline = activeVersions[0];
                      if (!baseline || baseline === v) return verse.text;
                      const baseVerse = content[baseline]?.verses?.find(bv => bv.number === verse.number) || { text: '' };
                      return <DiffVerse leftText={baseVerse.text} rightText={verse.text} />;
                    })()}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '10px 5px', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' },
  header: { textAlign: 'center', marginBottom: '24px', background: '#fff', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 6px 14px rgba(0,0,0,0.06)', boxSizing: 'border-box' },
  controls: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', alignItems: 'center', width: '100%', maxWidth: '1100px', margin: '0 auto' },
  favSidebar: { width: '220px', background: '#fff', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  btnExport: { width: '100%', padding: '10px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
  favItem: { padding: '10px', borderBottom: '1px solid #eee', marginBottom: '5px' },
  grid: (cols) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '20px', flex: 1 }),
  column: () => ({ background: '#fff', padding: '20px', borderRadius: '10px', maxHeight: '65vh', overflowY: 'auto' }),
  verseWrapper: { display: 'flex', gap: '10px', marginBottom: '10px' },
  btnStar: { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' },
  
  selectContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: 'fit-content',
    minWidth: '120px'
  },
  selectLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
    marginLeft: '4px'
  },
  selectField: {
    width: '100%',
    padding: '12px',
    fontSize: '16px', // Tamanho 16px evita o zoom automático no iPhone
    borderRadius: '8px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    color: '#333',
    appearance: 'none', // Remove a seta padrão do navegador
    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://w3.org\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    outline: 'none'
  }
};

// Error boundary para capturar erros em tempo de execução no App
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // você pode enviar esse erro para um serviço de logs aqui
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // opcional: limpar localStorage que pode estar em estado inconsistente
    try {
      localStorage.removeItem('favs');
      localStorage.removeItem('lastBook');
      localStorage.removeItem('lastCap');
    } catch (err) {
      console.warn('Falha ao limpar localStorage antes do reload:', err);
    }
    window.location.reload();
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20 }}>
          <h2>Ocorreu um erro inesperado</h2>
          <p style={{ color: '#900' }}>{this.state.error && this.state.error.toString()}</p>
          {this.state.errorInfo && (
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo.componentStack}
            </details>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={this.handleReload} style={{ padding: '8px 12px' }}>Recarregar (limpar estado)</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
