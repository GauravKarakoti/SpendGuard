'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { LayoutDashboard, ScrollText, Terminal, Shield, ChevronLeft, ChevronRight, Wallet, Settings, ExternalLink,  } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const NAV_ITEMS = [
  {
    key: 'nav-dashboard',
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    key: 'nav-audit',
    label: 'Audit Trail',
    href: '/audit-trail',
    icon: ScrollText,
    badge: '12',
  },
  {
    key: 'nav-console',
    label: 'Agent Console',
    href: '/agent-console',
    icon: Terminal,
    badge: null,
  },
];

const SECONDARY_ITEMS = [
  { key: 'nav-contract', label: 'Contract', href: '#', icon: Shield },
  { key: 'nav-wallet', label: 'Wallet', href: '#', icon: Wallet },
  { key: 'nav-settings', label: 'Settings', href: '#', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full z-30 flex flex-col
        bg-card border-r border-border
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 px-3 border-b border-border ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <AppLogo size={32} />
        {!collapsed && (
          <span className="font-bold text-base text-foreground tracking-tight">
            SpendGuard
          </span>
        )}
      </div>

      {/* Contract Badge */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-green-950 border border-green-900 animate-fade-in">
          <p className="text-xs text-muted-foreground font-medium mb-0.5">Contract</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green" />
            <p className="hash-text text-green-400 truncate">0x4f3e...8c2a</p>
            <ExternalLink size={10} className="text-muted-foreground flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Sepolia Testnet</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Monitor
          </p>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.key} href={item.href}>
              <div
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150 cursor-pointer relative group
                  ${isActive
                    ? 'text-primary bg-green-950 border border-green-900' :'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {/* Tooltip for collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-secondary border border-border text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {item.label}
                    {item.badge && <span className="ml-1 text-muted-foreground">({item.badge})</span>}
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        <div className="pt-4">
          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              System
            </p>
          )}
          {SECONDARY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href}>
                <div
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150 cursor-pointer relative group
                    text-muted-foreground hover:text-foreground hover:bg-secondary
                    ${collapsed ? 'justify-center' : ''}
                  `}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-secondary border border-border text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {item.label}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Agent Status */}
      {!collapsed && (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg bg-muted border border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse-green" />
            <span className="text-xs font-semibold text-foreground">ResearchAgent</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Active · Budget $5.00</p>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}