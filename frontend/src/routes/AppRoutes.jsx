import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import MarketingLayout from "@/layouts/MarketingLayout";
import AuthLayout from "@/layouts/AuthLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";

import LandingPage from "@/pages/marketing/LandingPage";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";

import Dashboard from "@/pages/app/Dashboard";
import Interview from "@/pages/app/Interview";
import History from "@/pages/app/History";
import Report from "@/pages/app/Report";
import Profile from "@/pages/app/Profile";
import CvAnalysis from "@/pages/app/CvAnalysis";
import Jobs from "@/pages/app/Jobs";

export default function AppRoutes() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Marketing */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* App */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="cv" element={<CvAnalysis />} />
            <Route path="interview" element={<Interview />} />
            <Route path="history" element={<History />} />
            <Route path="reports" element={<Report />} />
            <Route path="reports/:id" element={<Report />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Legacy redirects */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/interview" element={<Navigate to="/app/interview" replace />} />
          <Route path="/history" element={<Navigate to="/app/history" replace />} />
          <Route path="/report" element={<Navigate to="/app/reports" replace />} />
          <Route path="/subscription" element={<Navigate to="/app/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}
