import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { useAuthStore } from "@/store/auth-store";
import { AppLayout } from "@/components/layout/app-layout";
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { DashboardPage } from "@/pages/dashboard";
import { NewStoryPage } from "@/pages/new-story";
import { ProjectPage } from "@/pages/project";
import { SettingsPage } from "@/pages/settings";
import { PromptStudioPage } from "@/pages/prompt-studio";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="purana-theme">
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
              <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="new-story" element={<NewStoryPage />} />
                <Route path="project/:id" element={<ProjectPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="prompt-studio" element={<PromptStudioPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
