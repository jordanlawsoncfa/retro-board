import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage, BoardPage, NotFoundPage } from '@/pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:boardId" element={<BoardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
