'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AssetInput, Frequency } from '@/types'
import { Plus, Trash2 } from 'lucide-react'

interface AssetInputListProps {
  title: string
  description: string
  items: AssetInput[]
  onChange: (items: AssetInput[]) => void
  showFrequency?: boolean
  itemPlaceholder?: string
}

const frequencyLabels: Record<Frequency, string> = {
  monthly: '월',
  yearly: '연',
  once: '일시',
}

export function AssetInputList({
  title,
  description,
  items,
  onChange,
  showFrequency = true,
  itemPlaceholder = '항목명',
}: AssetInputListProps) {
  const addItem = () => {
    onChange([
      ...items,
      { name: '', amount: 0, frequency: 'monthly' as Frequency },
    ])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, updates: Partial<AssetInput>) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...updates } : item))
    )
  }

  const totalAmount = items.reduce((sum, item) => {
    const amount = item.amount ?? 0
    if (item.frequency === 'yearly') return sum + amount / 12
    if (item.frequency === 'once') return sum
    return sum + amount
  }, 0)

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-2">{description}</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
          >
            <div className="flex gap-3 items-start">
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="sr-only">항목명</Label>
                    <Input
                      placeholder={itemPlaceholder}
                      value={item.name}
                      onChange={(e) => updateItem(index, { name: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="w-36">
                    <Label className="sr-only">금액</Label>
                    <Input
                      type="number"
                      placeholder="금액 (원)"
                      value={item.amount || ''}
                      onChange={(e) =>
                        updateItem(index, { amount: parseInt(e.target.value) || 0 })
                      }
                      className="h-10"
                    />
                  </div>
                  {showFrequency && (
                    <div className="w-20">
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={item.frequency}
                        onChange={(e) =>
                          updateItem(index, { frequency: e.target.value as Frequency })
                        }
                      >
                        {Object.entries(frequencyLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <Input
                    placeholder="메모 (선택)"
                    value={item.notes || ''}
                    onChange={(e) => updateItem(index, { notes: e.target.value })}
                    className="text-sm h-9"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addItem}
          className="w-full border-dashed border-2 h-12 text-muted-foreground hover:text-primary hover:border-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          항목 추가
        </Button>

        {items.length > 0 && totalAmount > 0 && (
          <div className="flex justify-end items-center gap-2 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">월 환산 합계:</span>
            <span className="text-lg font-semibold text-primary">
              {totalAmount.toLocaleString()}원
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
