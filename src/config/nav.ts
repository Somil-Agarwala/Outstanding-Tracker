import {
  BarChart3,
  Building2,
  ClipboardList,
  FilePlus,
  Inbox,
  LayoutDashboard,
  Package,
  PackageOpen,
  Send,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// "Claim pipeline" is ordered to mirror the physical workflow:
// collect -> count -> pack -> send. A new person can read the sidebar
// top to bottom and understand the process.
export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Claim pipeline",
    items: [
      { label: "Collections", href: "/collections", icon: Inbox },
      { label: "Sorted bags", href: "/sorted-bags", icon: PackageOpen },
      { label: "Dispatches", href: "/dispatches", icon: Send },
    ],
  },
  {
    title: "Own inventory",
    items: [
      { label: "New entry", href: "/new-entry", icon: FilePlus },
      { label: "All records", href: "/records", icon: ClipboardList },
    ],
  },
  {
    title: "Master data",
    items: [
      { label: "Companies", href: "/master-data/companies", icon: Building2 },
      { label: "Products", href: "/master-data/products", icon: Package },
      { label: "Parties", href: "/master-data/distributors", icon: Truck },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3 }],
  },
  {
    title: "Administration",
    items: [
      { label: "Users & roles", href: "/users", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
