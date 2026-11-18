import React from "react";

export function RestaurantStatusBadge({ status, active }) {
  if (active === false) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        Desactivado
      </span>
    );
  }

  switch (status) {
    case "OPEN":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Abierto
        </span>
      );
    case "CLOSED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Cerrado
        </span>
      );
    case "PAUSED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pausado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600">
          {status}
        </span>
      );
  }
}

export function OrderStatusBadge({ status }) {
  const normalized = String(status).toUpperCase();
  switch (normalized) {
    case "RECEIVED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Recibido
        </span>
      );
    case "CONFIRMED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Confirmado
        </span>
      );
    case "PREPARING":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          En Preparación
        </span>
      );
    case "READY":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Listo
        </span>
      );
    case "ON_THE_WAY":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
          En Camino
        </span>
      );
    case "DELIVERED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Entregado
        </span>
      );
    case "CANCELLED":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Cancelado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600">
          {status}
        </span>
      );
  }
}

export function AccountStatusBadge({ active }) {
  if (active === false) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Inactivo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Activo
    </span>
  );
}

export function RoleBadge({ role }) {
  const norm = String(role).toUpperCase();
  switch (norm) {
    case "SUPERADMIN":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
          SuperAdmin
        </span>
      );
    case "ADMIN":
    case "OWNER":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
          {norm}
        </span>
      );
    case "MANAGER":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
          Manager
        </span>
      );
    case "KITCHEN":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          Cocina
        </span>
      );
    case "CLIENT":
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
          Cliente
        </span>
      );
  }
}

export default function StatusBadge({ type, value, ...props }) {
  if (type === "restaurantStatus") {
    return <RestaurantStatusBadge status={value} {...props} />;
  }
  if (type === "orderStatus") {
    return <OrderStatusBadge status={value} {...props} />;
  }
  if (type === "accountStatus") {
    return <AccountStatusBadge active={value} {...props} />;
  }
  if (type === "globalRole" || type === "localRole" || type === "role") {
    return <RoleBadge role={value} {...props} />;
  }
  return <span>{String(value ?? "")}</span>;
}
