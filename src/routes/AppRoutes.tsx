import { Routes, Route } from "react-router-dom";

import HomePage from "../components/HomePage.tsx";
import DashboardPage from "../components/DashboardPage.tsx";
import AuthPage from "../components/AuthPage.tsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  );
}
