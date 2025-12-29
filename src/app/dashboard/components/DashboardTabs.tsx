'use client'

import * as TabsPrimitive from "@radix-ui/react-tabs"
import styles from './DashboardTabs.module.css'

interface DashboardTabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

export function DashboardTabs({ value, onValueChange, children }: DashboardTabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={styles.root}
    >
      {children}
    </TabsPrimitive.Root>
  )
}

interface TabsListProps {
  children: React.ReactNode
}

export function TabsList({ children }: TabsListProps) {
  return (
    <TabsPrimitive.List className={styles.tabsList}>
      {children}
    </TabsPrimitive.List>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
}

export function TabsTrigger({ value, children }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger value={value} className={styles.tabsTrigger}>
      {children}
    </TabsPrimitive.Trigger>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
}

export function TabsContent({ value, children }: TabsContentProps) {
  return (
    <TabsPrimitive.Content value={value} className={styles.tabsContent}>
      {children}
    </TabsPrimitive.Content>
  )
}
