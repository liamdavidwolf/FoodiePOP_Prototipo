import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { orderApi } from "../services/api";

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const { addToCart, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Carga los pedidos reales del usuario autenticado desde Neon.
   */
  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await orderApi.getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar pedidos desde Neon:", err);
      setError(err.message || "No se pudieron cargar tus pedidos.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /**
   * Crea un nuevo pedido enviándolo a la API de Express y persistiendo en PostgreSQL.
   */
  const createOrder = async (orderData) => {
    setError(null);
    try {
      const createdOrder = await orderApi.createOrder(orderData);
      setOrders((prev) => [createdOrder, ...prev]);
      return createdOrder;
    } catch (err) {
      console.error("Error al crear el pedido:", err);
      throw err; // El componente que invoca maneja el error y conserva el carrito
    }
  };

  /**
   * Busca un pedido en memoria o lo consulta directamente desde el servidor.
   */
  const getOrderById = useCallback(
    async (id) => {
      // 1. Buscar en estado local
      const existing = orders.find(
        (o) => o.id === id || o.orderNumber === id || o.orderId === id
      );
      if (existing) return existing;

      // 2. Si no está en memoria, consultar al backend
      try {
        const remoteOrder = await orderApi.getOrderById(id);
        if (remoteOrder) {
          setOrders((prev) => {
            const hasIt = prev.some((o) => o.id === remoteOrder.id || o.orderId === remoteOrder.orderId);
            return hasIt ? prev : [remoteOrder, ...prev];
          });
        }
        return remoteOrder;
      } catch (err) {
        console.error("Error al obtener pedido por ID:", err);
        return null;
      }
    },
    [orders]
  );

  /**
   * Actualiza el estado de un pedido (panel administrativo).
   */
  const updateOrderStatus = async (id, newStatus) => {
    try {
      const updated = await orderApi.updateOrderStatus(id, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === id || o.orderId === id ? updated : o))
      );
      return updated;
    } catch (err) {
      console.error("Error al actualizar estado del pedido:", err);
      throw err;
    }
  };

  /**
   * Repite un pedido agregando sus productos al carrito.
   */
  const repeatOrder = (order) => {
    clearCart();

    const orderSlug = order.restaurant?.slug || order.restaurantSlug || null;

    (order.items || []).forEach((item) => {
      const product = {
        id: item.productId,
        name: item.name,
        price: item.unitPrice,
        image: item.image || "",
      };

      addToCart(product, item.quantity, item.options || item.selectedOptions || [], item.notes || "", orderSlug);
    });

    navigate("/checkout");
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        loading,
        error,
        fetchOrders,
        createOrder,
        getOrderById,
        updateOrderStatus,
        repeatOrder,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrders debe usarse dentro de un OrderProvider");
  }
  return context;
}
