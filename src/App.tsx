import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";

import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import LinFeed from "./pages/lin/Feed";
import LinPublicar from "./pages/lin/Publicar";
import LinPerfil from "./pages/lin/Perfil";
import LinEditarPerfil from "./pages/lin/EditarPerfil";
import LinBuscador from "./pages/lin/Buscador";
import LinPublicacionDetalle from "./pages/lin/PublicacionDetalle";
import LinMensajes from "./pages/lin/Mensajes";
import LinNotificaciones from "./pages/lin/Notificaciones";
import LinPanel from "./pages/lin/Panel";
import LinFavoritos from "./pages/lin/Favoritos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<AppLayout />}>
                <Route path="/lin" element={<LinFeed />} />
                <Route path="/lin/publicar" element={<LinPublicar />} />
                <Route path="/lin/buscar" element={<LinBuscador />} />
                <Route path="/lin/perfil" element={<LinPerfil />} />
                <Route path="/lin/perfil/editar" element={<LinEditarPerfil />} />
                <Route path="/lin/perfil/:slug" element={<LinPerfil />} />
                <Route path="/lin/publicacion/:id" element={<LinPublicacionDetalle />} />
                <Route path="/lin/mensajes" element={<LinMensajes />} />
                <Route path="/lin/mensajes/:id" element={<LinMensajes />} />
                <Route path="/lin/notificaciones" element={<LinNotificaciones />} />
                <Route path="/lin/panel" element={<LinPanel />} />
                <Route path="/lin/favoritos" element={<LinFavoritos />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
