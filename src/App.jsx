import Globe from './components/Globe';
import RouteSidebar from './components/RouteSidebar';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <RouteSidebar />
      <div className="globe-container">
        <Globe />
      </div>
    </div>
  );
}
