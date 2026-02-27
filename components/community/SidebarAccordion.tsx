"use client";

import { useState } from "react";

type Props = {
  children: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
};

/**
 * Collapsible sidebar section used on mobile when the sidebar
 * stacks below the main content.
 */
export function SidebarAccordion({ children, title, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="sidebar-accordion">
      <button
        type="button"
        className="sidebar-accordion__trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={`sidebar-accordion__chevron ${open ? "sidebar-accordion__chevron--open" : ""}`}>
          ›
        </span>
      </button>
      {open && <div className="sidebar-accordion__body">{children}</div>}
    </div>
  );
}
