import { Routes, Route } from 'react-router-dom';
import Notices from './pages/Notices';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Notices />} />
      <Route path="*" element={<Notices />} />
    </Routes>
  );
}

export default App;
