import React, { createContext, useContext, useState, useMemo } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [restaurantSlug, setRestaurantSlug] = useState(null);

  const addToCart = (product, quantity = 1, options = [], note = "", slug = null) => {
    setCartItems(prev => {
      // Create a unique ID based on product ID and selected options/note
      const optionsKey = options.map(o => o.id).sort().join('-');
      const cartItemId = `${product.id}-${optionsKey}-${note}`;
      
      // Si el item viene de un restaurante distinto al del carrito actual, se reinicia con el nuevo restaurante
      if (slug && restaurantSlug && restaurantSlug !== slug) {
        setRestaurantSlug(slug);
        return [{ ...product, cartItemId, quantity, selectedOptions: options, note, restaurantSlug: slug }];
      }
      if (slug && !restaurantSlug) {
        setRestaurantSlug(slug);
      }

      const existingItem = prev.find(item => item.cartItemId === cartItemId);
      
      if (existingItem) {
        return prev.map(item => 
          item.cartItemId === cartItemId 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      
      return [...prev, { ...product, cartItemId, quantity, selectedOptions: options, note, restaurantSlug: slug || restaurantSlug }];
    });
  };

  const updateQuantity = (cartItemId, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (cartItemId) => {
    setCartItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCartItems([]);
    setRestaurantSlug(null);
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const optionsTotal = item.selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
      return total + ((item.price + optionsTotal) * item.quantity);
    }, 0);
  }, [cartItems]);
  
  const cartCount = useMemo(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  return (
    <CartContext.Provider value={{
      cartItems,
      restaurantSlug,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart,
      cartTotal,
      cartCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
