import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainPage, GeneratePage, PlanDetailPage } from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/plan/:planId" element={<PlanDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
