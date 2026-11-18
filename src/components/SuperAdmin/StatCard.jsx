import React from "react";

export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeColor = "emerald",
  badge,
  accent,
}) {
  const resolvedBadgeText = badgeText || (typeof badge === "object" ? badge?.text : badge);
  const colorKey = accent === "orange" ? "accent" : (badge?.variant === "success" ? "emerald" : (accent || badgeColor));

  const badgeClasses = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    accent: "bg-[#fff4f1] text-[#e85d3f] border-[#fbdcd5]",
  }[colorKey] || "bg-neutral-100 text-neutral-700 border-neutral-200";

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e8e8e4] shadow-xs hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          {title}
        </span>
        {Icon ? (
          <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-700">
            <Icon size={20} />
          </div>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-[#171717] tracking-tight">
          {value}
        </span>
        {resolvedBadgeText ? (
          <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${badgeClasses}`}>
            {resolvedBadgeText}
          </span>
        ) : null}
      </div>
      {subtext ? (
        <p className="text-xs text-neutral-500 line-clamp-1">
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

