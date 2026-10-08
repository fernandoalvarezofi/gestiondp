import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { NativeShell } from "@/components/NativeShell";
import { isNativeApp } from "@/lib/native";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { RolesProvider } from "@/contexts/RolesContext";
import { ClientLayout } from "@/components/layouts/ClientLayout";
import { RequireRole, SessionGate } from "@/navigation/guards";
import { lastContext } from "@/navigation/contexts";
import DeliveryHome from "./pages/delivery/DeliveryHome";

const Auth = lazy(() => import("./pages/Auth"));
const Arrepentimiento = lazy(() => import("./pages/Arrepentimiento"));
const Landing = lazy(() => import("./pages/Landing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Search = lazy(() => import("./pages/delivery/Search"));
const Category = lazy(() => import("./pages/delivery/Category"));
const StoreDetail = lazy(() => import("./pages/delivery/StoreDetail"));
const Cart = lazy(() => import("./pages/delivery/Cart"));
const Orders = lazy(() => import("./pages/delivery/Orders"));
const OrderDetail = lazy(() => import("./pages/delivery/OrderDetail"));
const Favorites = lazy(() => import("./pages/delivery/Favorites"));
const MyAppointments = lazy(() => import("./pages/delivery/MyAppointments"));
const Notifications = lazy(() => import("./pages/delivery/Notifications"));
const Messages = lazy(() => import("./pages/delivery/Messages"));
const MerchantMessages = lazy(() => import("./pages/delivery/merchant/MerchantMessages"));
const ServiceLocals = lazy(() => import("./pages/delivery/ServiceLocals"));
const Booking = lazy(() => import("./pages/Booking"));
const Promotions = lazy(() => import("./pages/delivery/Promotions"));
const Profile = lazy(() => import("./pages/delivery/Profile"));
const Help = lazy(() => import("./pages/delivery/Help"));
const HelpTicket = lazy(() => import("./pages/delivery/HelpTicket"));
const Club = lazy(() => import("./pages/delivery/Club"));
const Envio = lazy(() => import("./pages/delivery/Envio"));
const EnvioDetail = lazy(() => import("./pages/delivery/EnvioDetail"));
const Remis = lazy(() => import("./pages/delivery/Remis"));
const Directorio = lazy(() => import("./pages/delivery/Directorio"));
const Explore = lazy(() => import("./pages/delivery/Explore"));
const RemisDetail = lazy(() => import("./pages/delivery/RemisDetail"));
const MerchantLayout = lazy(() => import("./pages/delivery/merchant/MerchantLayout"));
const MerchantHome = lazy(() => import("./pages/delivery/merchant/MerchantHome"));
const MerchantSettings = lazy(() => import("./pages/delivery/merchant/MerchantSettings"));
const MerchantStorefront = lazy(() => import("./pages/delivery/merchant/MerchantStorefront"));
const MerchantNewStore = lazy(() => import("./pages/delivery/merchant/MerchantNewStore"));
const MerchantQuestions = lazy(() => import("./pages/delivery/merchant/MerchantQuestions"));
const MerchantReturns = lazy(() => import("./pages/delivery/merchant/MerchantReturns"));
const MerchantBookings = lazy(() => import("./pages/delivery/merchant/MerchantBookings"));
const Storefront = lazy(() => import("./pages/Storefront"));
const StorefrontPreviewFrame = lazy(() => import("./pages/StorefrontPreviewFrame"));
const StorefrontProduct = lazy(() => import("./pages/StorefrontProduct"));
const Console = lazy(() => import("./pages/Console"));
const MerchantPages = {
  Orders: lazy(() => import("./pages/delivery/merchant/MerchantPages").then((m) => ({ default: m.MerchantOrdersPage }))),
  Menu: lazy(() => import("./pages/delivery/merchant/MerchantPages").then((m) => ({ default: m.MerchantMenuPage }))),
  Promos: lazy(() => import("./pages/delivery/merchant/MerchantPages").then((m) => ({ default: m.MerchantPromosPage }))),
  Branches: lazy(() => import("./pages/delivery/merchant/MerchantBranches")),
  Campaigns: lazy(() => import("./pages/delivery/merchant/MerchantPages").then((m) => ({ default: m.MerchantCampaignsPage }))),
  Reviews: lazy(() => import("./pages/delivery/merchant/MerchantPages").then((m) => ({ default: m.MerchantReviewsPage }))),
  Stats: lazy(() => import("./pages/delivery/merchant/MerchantPages").then((m) => ({ default: m.MerchantStatsPage }))),
  Finance: lazy(() => import("./pages/delivery/merchant/MerchantFinance")),
  Customers: lazy(() => import("./pages/delivery/merchant/MerchantCustomers")),
  Team: lazy(() => import("./pages/delivery/merchant/MerchantTeam")),
};
const CourierLayout = lazy(() => import("./pages/delivery/courier/CourierLayout"));
const CourierPages = {
  Orders: lazy(() => import("./pages/delivery/courier/CourierPages").then((m) => ({ default: m.CourierOrdersPage }))),
  Map: lazy(() => import("./pages/delivery/courier/CourierPages").then((m) => ({ default: m.CourierMapPage }))),
  Earnings: lazy(() => import("./pages/delivery/courier/CourierPages").then((m) => ({ default: m.CourierEarningsPage }))),
  Incentives: lazy(() => import("./pages/delivery/courier/CourierPages").then((m) => ({ default: m.CourierIncentivesPage }))),
  History: lazy(() => import("./pages/delivery/courier/CourierPages").then((m) => ({ default: m.CourierHistoryPage }))),
  Profile: lazy(() => import("./pages/delivery/courier/CourierPages").then((m) => ({ default: m.CourierProfilePage }))),
};
const DriverLayout = lazy(() => import("./pages/delivery/driver/DriverLayout"));
const DriverPages = {
  Trips: lazy(() => import("./pages/delivery/driver/DriverPages").then((m) => ({ default: m.DriverTripsPage }))),
  Map: lazy(() => import("./pages/delivery/driver/DriverPages").then((m) => ({ default: m.DriverMapPage }))),
  Earnings: lazy(() => import("./pages/delivery/driver/DriverPages").then((m) => ({ default: m.DriverEarningsPage }))),
  History: lazy(() => import("./pages/delivery/driver/DriverPages").then((m) => ({ default: m.DriverHistoryPage }))),
  Profile: lazy(() => import("./pages/delivery/driver/DriverPages").then((m) => ({ default: m.DriverProfilePage }))),
};
const AdminLayout = lazy(() => import("./pages/delivery/admin/AdminLayout"));
const AdminSection = lazy(() => import("./pages/delivery/admin/AdminSections"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Legal = lazy(() => import("./pages/Legal"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
);

/** La app instalada abre en el último panel de trabajo usado (por defecto, el de repartidor). */
const nativeHome = () => { const last = lastContext(); return last && last !== "cliente" ? `/app/${last}` : "/app/repartidor"; };

/** Las URLs viejas de /lin y /lin/local/:slug siguen funcionando. */
function LegacyStoreRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/app/tienda/${slug}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Sonner position="top-center" richColors />
        <AuthProvider>
          <RolesProvider>
          <CartProvider>
            <FavoritesProvider>
              <BrowserRouter>
                <NativeShell />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={isNativeApp() ? <Navigate to={nativeHome()} replace /> : <Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/consola" element={<Console />} />
                    <Route path="/t/:slug" element={<Storefront />} />
                    <Route path="/t/:slug/c/:categoria" element={<Storefront />} />
                    <Route path="/t/:slug/ofertas" element={<Storefront />} />
                    <Route path="/t/:slug/buscar" element={<Storefront />} />
                    <Route path="/t/:slug/p/:id" element={<StorefrontProduct />} />
                    <Route path="/t/:slug/reservar" element={<Booking />} />
                    <Route path="/vista-previa-tienda" element={<StorefrontPreviewFrame />} />
                    <Route path="/restablecer" element={<ResetPassword />} />
                    <Route path="/terminos" element={<Legal doc="terminos" />} />
                    <Route path="/arrepentimiento" element={<Arrepentimiento />} />
                    <Route path="/privacidad" element={<Legal doc="privacidad" />} />
                    {/* /app: sesión y segundo factor; cada contexto cuelga con su propio layout. */}
                    <Route path="/app" element={<SessionGate />}>
                      {/* Contexto Cliente */}
                      <Route element={<ClientLayout />}>
                        <Route index element={<DeliveryHome />} />
                        <Route path="explorar" element={<Explore />} />
                        <Route path="servicios" element={<Navigate to="/app/explorar" replace />} />
                        <Route path="buscar" element={<Search />} />
                        <Route path="categoria/:id" element={<Category />} />
                        <Route path="tienda/:slug" element={<StoreDetail />} />
                        <Route path="carrito" element={<Cart />} />
                        <Route path="pedidos" element={<Orders />} />
                        <Route path="pedidos/:id" element={<OrderDetail />} />
                        <Route path="club" element={<Club />} />
                        <Route path="ayuda" element={<Help />} />
                        <Route path="ayuda/:id" element={<HelpTicket />} />
                        <Route path="enviar" element={<Envio />} />
                        <Route path="envios/:id" element={<EnvioDetail />} />
                        <Route path="remis" element={<Remis />} />
                        <Route path="remis/:id" element={<RemisDetail />} />
                        <Route path="directorio" element={<Directorio />} />
                        <Route path="favoritos" element={<Favorites />} />
                        <Route path="turnos" element={<MyAppointments />} />
                        <Route path="turnos/locales" element={<ServiceLocals />} />
                        <Route path="notificaciones" element={<Notifications />} />
                        <Route path="mensajes" element={<Messages />} />
                        <Route path="promociones" element={<Promotions />} />
                        <Route path="perfil" element={<Profile />} />
                        <Route path="perfil/:seccion" element={<Profile />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                      {/* Contexto Comercio: el acceso a cada sección lo decide el rol del equipo (y el servidor). */}
                      <Route path="comercio" element={<MerchantLayout />}>
                        <Route index element={<MerchantHome />} />
                        <Route path="pedidos" element={<MerchantPages.Orders />} />
                        <Route path="menu" element={<MerchantPages.Menu />} />
                        <Route path="promociones" element={<MerchantPages.Promos />} />
                        <Route path="campanas" element={<MerchantPages.Campaigns />} />
                        <Route path="sucursales" element={<MerchantPages.Branches />} />
                        <Route path="opiniones" element={<MerchantPages.Reviews />} />
                        <Route path="estadisticas" element={<MerchantPages.Stats />} />
                        <Route path="clientes" element={<MerchantPages.Customers />} />
                        <Route path="finanzas" element={<MerchantPages.Finance />} />
                        <Route path="tienda" element={<MerchantStorefront />} />
                        <Route path="nuevo" element={<MerchantNewStore />} />
                        <Route path="preguntas" element={<MerchantQuestions />} />
                        <Route path="devoluciones" element={<MerchantReturns />} />
                        <Route path="mensajes" element={<MerchantMessages />} />
                        <Route path="turnos" element={<MerchantBookings />} />
                        <Route path="equipo" element={<MerchantPages.Team />} />
                        <Route path="configuracion" element={<Navigate to="general" replace />} />
                        <Route path="configuracion/:seccion" element={<MerchantSettings />} />
                        <Route path="*" element={<Navigate to="/app/comercio" replace />} />
                      </Route>
                      {/* Contexto Repartidor: entregas de pedidos y envíos. */}
                      <Route path="repartidor" element={<CourierLayout />}>
                        <Route index element={<CourierPages.Orders />} />
                        <Route path="mapa" element={<CourierPages.Map />} />
                        <Route path="ganancias" element={<CourierPages.Earnings />} />
                        <Route path="incentivos" element={<CourierPages.Incentives />} />
                        <Route path="historial" element={<CourierPages.History />} />
                        <Route path="perfil" element={<CourierPages.Profile />} />
                        <Route path="*" element={<Navigate to="/app/repartidor" replace />} />
                      </Route>
                      {/* Contexto Conductor: viajes de remís. */}
                      <Route path="conductor" element={<DriverLayout />}>
                        <Route index element={<DriverPages.Trips />} />
                        <Route path="mapa" element={<DriverPages.Map />} />
                        <Route path="ganancias" element={<DriverPages.Earnings />} />
                        <Route path="historial" element={<DriverPages.History />} />
                        <Route path="perfil" element={<DriverPages.Profile />} />
                        <Route path="*" element={<Navigate to="/app/conductor" replace />} />
                      </Route>
                      {/* Contexto Administración: solo administradores. */}
                      <Route path="admin" element={<RequireRole context="admin"><AdminLayout /></RequireRole>}>
                        <Route index element={<AdminSection />} />
                        <Route path=":seccion" element={<AdminSection />} />
                      </Route>
                    </Route>
                    <Route path="/lin/local/:slug" element={<LegacyStoreRedirect />} />
                    <Route path="/lin/*" element={<Navigate to="/app" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </FavoritesProvider>
          </CartProvider>
          </RolesProvider>
        </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
