/**
 * lib/nav.js
 * ----------
 * Single source of truth for the sidebar / mobile navigation. Every entry
 * points at a route that exists — no placeholder links.
 */

import {
  BarChart3,
  Bookmark,
  FolderOpen,
  History,
  LayoutGrid,
  MessagesSquare,
  Settings,
  Sparkles,
} from "lucide-react";

export const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, end: true },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/process", label: "New Chat", icon: MessagesSquare },
    ],
  },
  {
    title: "Library",
    items: [
      { to: "/history", label: "History", icon: History },
      { to: "/summaries", label: "AI Summaries", icon: Sparkles },
      { to: "/collections", label: "Collections", icon: FolderOpen },
      { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    title: "Account",
    items: [{ to: "/profile", label: "Settings", icon: Settings }],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
