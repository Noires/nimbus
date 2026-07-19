import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CanvasRouter } from "./components/CanvasRouter";
import { ShareView } from "./components/ShareView";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/canvas/:id" element={<CanvasRouter />} />
        <Route path="/" element={<CanvasRouter />} />
      </Routes>
    </BrowserRouter>
  );
}
