import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import { CartProvider } from "./context/CartContext";
import { OrderProvider } from "./context/OrderContext";
import { AuthProvider } from "./context/AuthContext";

// Vistas Cliente
import Restaurant from "./pages/Client/Restaurant";
import Checkout from "./pages/Client/Checkout";
import OrderConfirmation from "./pages/Client/OrderConfirmation";
import ClientOrders from "./pages/Client/Orders";
import Login from "./pages/Client/Login";
import Register from "./pages/Client/Register";

// Vistas Panel Restaurante
import AdminDashboard from "./pages/Admin/Dashboard";

// SuperAdmin Core & Views
import SuperAdminRoute from "./components/SuperAdmin/SuperAdminRoute";
import SuperAdminLayout from "./pages/SuperAdmin/Layout";
import SuperAdminDashboard from "./pages/SuperAdmin/Dashboard";
import SuperAdminRestaurants from "./pages/SuperAdmin/Restaurants";
import SuperAdminRestaurantDetail from "./pages/SuperAdmin/RestaurantDetail";
import SuperAdminUsers from "./pages/SuperAdmin/Users";
import SuperAdminUserDetail from "./pages/SuperAdmin/UserDetail";
import SuperAdminOrders from "./pages/SuperAdmin/Orders";
import SuperAdminAnalytics from "./pages/SuperAdmin/Analytics";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <OrderProvider>
            <Routes>
              {/* Rutas Públicas y Cliente */}
              <Route path="/" element={<Restaurant />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-status" element={<OrderConfirmation />} />
              <Route path="/orders" element={<ClientOrders />} />

              {/* Panel de Restaurante (Local) */}
              <Route path="/admin" element={<AdminDashboard initialPage="Dashboard" />} />
              <Route path="/admin/orders" element={<AdminDashboard initialPage="Pedidos" />} />

              {/* SuperAdmin Panel (Protegido para rol global SUPERADMIN) */}
              <Route element={<SuperAdminRoute />}>
                <Route element={<SuperAdminLayout />}>
                  <Route path="/superadmin" element={<SuperAdminDashboard />} />
                  <Route path="/superadmin/restaurants" element={<SuperAdminRestaurants />} />
                  <Route path="/superadmin/restaurants/:id" element={<SuperAdminRestaurantDetail />} />
                  <Route path="/superadmin/users" element={<SuperAdminUsers />} />
                  <Route path="/superadmin/users/:id" element={<SuperAdminUserDetail />} />
                  <Route path="/superadmin/orders" element={<SuperAdminOrders />} />
                  <Route path="/superadmin/analytics" element={<SuperAdminAnalytics />} />
                </Route>
              </Route>

              {/* Rutas Públicas Dinámicas por Slug */}
              <Route path="/r/:slug" element={<Restaurant />} />
              <Route path="/:slug" element={<Restaurant />} />
            </Routes>
          </OrderProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);
