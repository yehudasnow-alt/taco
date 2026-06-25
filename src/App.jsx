import Globe from './components/Globe';
import SearchPanel from './components/SearchPanel';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <SearchPanel />
      <div className="globe-container">
        <Globe />
      </div>
    </div>
  );
}
