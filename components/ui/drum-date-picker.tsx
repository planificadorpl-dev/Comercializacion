import React, { useEffect, useRef, useState, useMemo } from "react"
import { getDaysInMonth, isValid, parseISO } from "date-fns"

interface DrumPickerProps {
  value?: string // YYYY-MM-DD
  onChange: (value: string) => void
  minYear?: number
  maxYear?: number
  minDate?: Date
  maxDate?: Date
}

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]

export function DrumDatePicker({ 
  value, 
  onChange, 
  minYear = 1920, 
  maxYear = new Date().getFullYear() + 5,
  minDate,
  maxDate
}: DrumPickerProps) {
  const dateObj = value && isValid(parseISO(value)) ? parseISO(value) : new Date()
  
  const [day, setDay] = useState(dateObj.getDate())
  const [month, setMonth] = useState(dateObj.getMonth() + 1)
  const [year, setYear] = useState(dateObj.getFullYear())

  const maxDays = useMemo(() => getDaysInMonth(new Date(year, month - 1)), [year, month])

  useEffect(() => {
    if (day > maxDays) setDay(maxDays)
  }, [maxDays, day])

  useEffect(() => {
    let finalDay = Math.min(day, maxDays)
    let finalMonth = month
    let finalYear = year
    const selectedDate = new Date(year, month - 1, finalDay)
    const startOfSelected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())

    if (minDate) {
      const startOfMin = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
      if (startOfSelected < startOfMin) {
        finalYear = minDate.getFullYear()
        finalMonth = minDate.getMonth() + 1
        finalDay = minDate.getDate()
        setYear(finalYear)
        setMonth(finalMonth)
        setDay(finalDay)
        return // Avoid triggering onChange out of bounds, will re-trigger
      }
    }

    if (maxDate) {
      const startOfMax = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())
      if (startOfSelected > startOfMax) {
        finalYear = maxDate.getFullYear()
        finalMonth = maxDate.getMonth() + 1
        finalDay = maxDate.getDate()
        setYear(finalYear)
        setMonth(finalMonth)
        setDay(finalDay)
        return
      }
    }

    const newDateStr = `${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`
    if (newDateStr !== value) {
      onChange(newDateStr)
    }
  }, [day, month, year, maxDays, value, onChange, minDate, maxDate])

  return (
    <div className="flex justify-center items-center h-[200px] w-full bg-background relative select-none">
      <div className="absolute top-[80px] h-[40px] w-full bg-muted/40 border-y border-border pointer-events-none rounded-lg" />
      <div className="absolute top-0 w-full h-[80px] bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 w-full h-[80px] bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />

      <div className="flex w-full px-2 gap-1 z-0 relative">
        <ScrollColumn
          items={Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, '0'))}
          value={String(Math.min(day, maxDays)).padStart(2, '0')}
          onChange={(v) => setDay(Number(v))}
          width="w-1/3"
        />
        <ScrollColumn
          items={MONTHS}
          value={MONTHS[month - 1]}
          onChange={(v) => setMonth(MONTHS.indexOf(v as string) + 1)}
          width="w-1/3"
        />
        <ScrollColumn
          items={Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i)}
          value={year}
          onChange={(v) => setYear(Number(v))}
          width="w-1/3"
        />
      </div>
    </div>
  )
}

function ScrollColumn({ items, value, onChange, width }: { items: (string|number)[], value: string|number, onChange: (val: any) => void, width: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ITEM_HEIGHT = 40
  const isScrolling = useRef(false)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startScrollTop = useRef(0)

  useEffect(() => {
    if (containerRef.current && !isScrolling.current && !isDragging.current) {
      const index = items.indexOf(value)
      if (index !== -1) {
        containerRef.current.scrollTop = index * ITEM_HEIGHT
      }
    }
  }, [value, items])

  // Custom Wheel Interceptor for Desktop (prevents massive jumps)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let lastWheelTime = 0
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      // Limit wheel actions to one jump every 100ms (fixes fast-scroll jumping)
      if (now - lastWheelTime < 100) return
      lastWheelTime = now

      const direction = e.deltaY > 0 ? 1 : -1
      el.scrollBy({ top: direction * ITEM_HEIGHT, behavior: 'smooth' })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.pageY
    startScrollTop.current = containerRef.current?.scrollTop || 0
    if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'none'
        containerRef.current.style.cursor = 'grabbing'
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    e.preventDefault()
    const walk = (e.pageY - startY.current) * 1.5 // drag speed
    containerRef.current.scrollTop = startScrollTop.current - walk
    
    // Live update value while dragging
    const index = Math.max(0, Math.min(items.length - 1, Math.round(containerRef.current.scrollTop / ITEM_HEIGHT)))
    if (items[index] !== undefined && items[index] !== value) {
      onChange(items[index])
    }
  }

  const stopDragging = () => {
    if (isDragging.current && containerRef.current) {
        isDragging.current = false
        containerRef.current.style.scrollSnapType = 'y mandatory'
        containerRef.current.style.cursor = 'grab'
        // Force snap to closest item
        const index = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT)
        containerRef.current.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isDragging.current) return // Handled by mouse move
    isScrolling.current = true
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    
    const scrollTop = e.currentTarget.scrollTop
    const index = Math.round(scrollTop / ITEM_HEIGHT)
    if (items[index] !== undefined && items[index] !== value) {
      onChange(items[index])
    }

    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false
    }, 150)
  }

  const handleClick = (index: number) => {
    // Ignore clicks if we just finished dragging a significant amount
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
    }
  }

  return (
    <div 
      className={`h-[200px] ${width} overflow-y-auto overflow-x-hidden touch-pan-y snap-y snap-mandatory scrollbar-hide [&::-webkit-scrollbar]:hidden text-center outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded-md cursor-grab`}
      ref={containerRef}
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
      tabIndex={0}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="h-[80px] shrink-0 pointer-events-none" />
      {items.map((item, idx) => (
        <div 
          key={`${item}`} 
          onClick={() => handleClick(idx)}
          className={`h-[40px] snap-center snap-always flex items-center justify-center cursor-pointer transition-colors duration-200 text-lg font-medium
            ${item === value ? 'text-foreground font-bold text-xl scale-105' : 'text-muted-foreground hover:text-foreground/80'}`}
        >
          {item}
        </div>
      ))}
      <div className="h-[80px] shrink-0" />
    </div>
  )
}
