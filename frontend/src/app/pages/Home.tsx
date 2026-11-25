import { Link, useNavigate } from 'react-router';
import { useRef, useState } from 'react';
import CardSwap from '../components/react-bits/CardSwap';
import SpecularButton from '../components/react-bits/SpecularButton';
import { getAccessToken, getBooks } from '../data/api';
import { ArrowRight, BookOpen } from 'lucide-react';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import database from '../assets/images/books/SY IT/DBMS.jpg';
import structures from '../assets/images/books/SY IT/DSA.jpg';
import mathematics from '../assets/images/books/SY IT/Maths 3.jpg';

const shelf = [
  { cover: database, subject: 'Database systems' },
  { cover: structures, subject: 'Data structures' },
  { cover: mathematics, subject: 'Mathematics III' },
];

export default function Home() {
  const services = [
    ['Borrowing', 'dashboard'],
    ['Library assistant', 'chatbot'],
    ['Student reviews', 'history'],
  ];
  const navigate = useNavigate();
  const [front, setFront] = useState(0);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<{book_id:string; title:string; author:string; available_copies:number}[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const stack = useRef<{ next(): void }>(null);
  const signedIn = !!getAccessToken() && window.localStorage.getItem('smart-library-student-auth') === 'true';
  async function openService(tab: string) {
    if (signedIn) return navigate('/student/dashboard', {state:{tab}});
    setSelected(tab);
    if (tab === 'dashboard' && catalog === null) {
      setCatalogError(false);
      try { setCatalog(await getBooks()); } catch { setCatalogError(true); }
    }
  }
  const matches = catalog?.filter(b => (b.title + ' ' + b.author).toLowerCase().includes(query.trim().toLowerCase())).slice(0,5);
  return (
    <div className="reading-home">
      <main>
      <section className="reading-scene" aria-labelledby="collection-title">
        <div className="library-photo" aria-hidden="true" />
      <header className="reading-bar"><a href="/" className="library-mark"><BookOpen aria-hidden="true" /> Smart Library</a>
        <nav aria-label="Library navigation"><Link to="/admin/login">Staff sign in</Link><ThemeToggle /></nav>
      </header>
        <div className="reading-hero">
          <div><p>Pillai College of Engineering</p><h1 id="collection-title">Browse the collection</h1>
            <p>Find a textbook for your next class, check your loans, or ask the library assistant for a recommendation.</p>
            <SpecularButton className="library-entry" size="md" radius={10} tint="#8ed4ff" tintOpacity={1} textColor="#07131c" lineColor="#ffffff" baseColor="#4698c9" onClick={() => navigate(signedIn ? '/student/dashboard' : '/student/login')}>
              {signedIn ? 'Open student dashboard' : 'Student sign in'} <ArrowRight aria-hidden="true" size={18} />
            </SpecularButton>
          </div>
          <section className="catalog-stack" id="featured-books" aria-label="Featured textbooks">
            <CardSwap ref={stack} width={500} height={326} cardDistance={36} verticalDistance={20}
              skewAmount={2} cardRadius={12} autoplay={false} parallax={0} onChange={setFront}
              onCardClick={(index: number) => { if (index === front) stack.current?.next(); }}>
              {shelf.map(({cover, subject}) => <div className="book-window" key={subject}>
                <div className="window-bar" aria-hidden="true"><i/><i/><i/></div>
                <img src={cover} alt={subject + ' textbook cover'} draggable={false} />
              </div>)}
            </CardSwap>
            <span className="sr-only" role="status">{shelf[front].subject}</span>
          </section>
        </div>
      </section>
        <section className="library-shortcuts"><h2>At the library</h2>
          <nav aria-label="Library services">{services.map(([label, tab]) =>
            <button key={tab} type="button" aria-pressed={selected === tab} onClick={() => openService(tab)}>{label}<ArrowRight size={16} aria-hidden="true" /></button>)}</nav>
          {!signedIn && selected && <div className="service-preview">
            {selected === 'dashboard' ? <>
              <label htmlFor="public-catalog">Find a book to borrow</label>
              <input id="public-catalog" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Title or author" />
              {catalogError ? <p>The catalog could not be loaded. <button onClick={() => openService('dashboard')}>Try again</button></p> :
                !matches ? <p>Loading books…</p> : !matches.length ? <p>No matching books.</p> :
                <ul>{matches.map(b => <li key={b.book_id}><strong>{b.title}</strong><span>{b.available_copies} available</span></li>)}</ul>}
            </> : selected === 'chatbot' ? <p>Ask the library assistant for a subject recommendation, a book summary, or a shelf location. Your student account supplies your department and reading history.</p> :
              <p>Open your borrowing history and choose a returned book to share a review with other readers.</p>}
            <Link to="/student/login" state={{tab:selected}}>{selected === 'dashboard' ? 'Sign in to request a book' : selected === 'chatbot' ? 'Sign in to chat' : 'Sign in to write a review'} →</Link>
          </div>}
        </section>
      </main>
      <footer className="reading-footer"><div><h2>Library desk</h2><a href="mailto:pcelibrary@mes.ac.in">pcelibrary@mes.ac.in</a><br/><a href="tel:02265748000">022-65748000</a></div>
        <div><h2>Opening hours</h2>Monday–Friday, 8 am–6 pm<br/>During exams, 8 am–8 pm</div>
        <div><a href="https://pce.ac.in">Pillai College of Engineering</a></div>
      </footer>
    </div>
  );
}
