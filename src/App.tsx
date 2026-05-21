import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { CallProvider } from "@/contexts/CallContext";
import { CallOverlay } from "@/components/lin/CallOverlay";

import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Feed from "./pages/lin/Feed";
import Publicar from "./pages/lin/Publicar";
import Perfil from "./pages/lin/Perfil";
import EditarPerfil from "./pages/lin/EditarPerfil";
import Buscador from "./pages/lin/Buscador";
import PublicacionDetalle from "./pages/lin/PublicacionDetalle";
import Mensajes from "./pages/lin/Mensajes";
import Notificaciones from "./pages/lin/Notificaciones";
import Panel from "./pages/lin/Panel";
import Favoritos from "./pages/lin/Favoritos";
import Proyectos from "./pages/lin/Proyectos";
import ProyectoDetalle from "./pages/lin/ProyectoDetalle";
import NuevoProyecto from "./pages/lin/NuevoProyecto";
import Comunidades from "./pages/lin/Comunidades";
import ComunidadDetalle from "./pages/lin/ComunidadDetalle";
import NuevaComunidad from "./pages/lin/NuevaComunidad";
import Foro from "./pages/lin/Foro";
import ForoPost from "./pages/lin/ForoPost";
import NuevoForoPost from "./pages/lin/NuevoForoPost";

import NuevaHistoria from "./pages/lin/NuevaHistoria";
import HistoriaViewer from "./pages/lin/HistoriaViewer";
import Reels from "./pages/lin/Reels";
import Explorar from "./pages/lin/Explorar";
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
            <CallProvider>
              <CallOverlay />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route element={<AppLayout />}>
                  <Route path="/lin" element={<Feed />} />
                  <Route path="/lin/explorar" element={<Explorar />} />
                  <Route path="/lin/reels" element={<Reels />} />
                  <Route path="/lin/publicar" element={<Publicar />} />
                  <Route path="/lin/buscar" element={<Buscador />} />
                  
                  <Route path="/lin/perfil" element={<Perfil />} />
                  <Route path="/lin/perfil/editar" element={<EditarPerfil />} />
                  <Route path="/lin/perfil/:slug" element={<Perfil />} />
                  <Route path="/lin/publicacion/:id" element={<PublicacionDetalle />} />
                  <Route path="/lin/mensajes" element={<Mensajes />} />
                  <Route path="/lin/mensajes/:id" element={<Mensajes />} />
                  <Route path="/lin/notificaciones" element={<Notificaciones />} />
                  <Route path="/lin/panel" element={<Panel />} />
                  <Route path="/lin/favoritos" element={<Favoritos />} />
                  <Route path="/lin/proyectos" element={<Proyectos />} />
                  <Route path="/lin/proyectos/nuevo" element={<NuevoProyecto />} />
                  <Route path="/lin/proyectos/:slug" element={<ProyectoDetalle />} />
                  <Route path="/lin/comunidades" element={<Comunidades />} />
                  <Route path="/lin/comunidades/nueva" element={<NuevaComunidad />} />
                  <Route path="/lin/comunidades/:slug" element={<ComunidadDetalle />} />
                  <Route path="/lin/foro" element={<Foro />} />
                  <Route path="/lin/foro/nuevo" element={<NuevoForoPost />} />
                  <Route path="/lin/foro/post/:id" element={<ForoPost />} />
                  <Route path="/lin/historias/nueva" element={<NuevaHistoria />} />
                  <Route path="/lin/historias/:perfilId" element={<HistoriaViewer />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CallProvider>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
