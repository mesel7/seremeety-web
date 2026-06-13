'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cx } from '@/shared/lib/classNames';
import styles from './DatePicker.module.scss';

interface DatePickerProps {
  // YYYY-MM-DD or '' (no value).
  value: string;
  onChange: (value: string) => void;
  // 선택 가능 범위 경계. inclusive. YYYY-MM-DD.
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDate = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const formatDisplay = (value: string): string => {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
};

const parseDate = (value: string): { year: number; month: number; day: number } | null => {
  if (!value) return null;
  const [yStr, mStr, dStr] = value.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const compareYmd = (a: string, b: string): number => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

const startWeekday = (year: number, month: number): number =>
  new Date(year, month - 1, 1).getDay();

const DatePicker = ({
  value,
  onChange,
  min,
  max,
  placeholder = '날짜 선택',
  disabled,
  isClearable,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: DatePickerProps) => {
  const reactId = useId();
  const buttonId = id ?? reactId;
  const popupId = `${buttonId}-popup`;

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // viewYear/viewMonth — 달력에 현재 보여지는 연/월. 초기엔 value 우선,
  // 없으면 max 경계, 없으면 오늘.
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }, []);

  const initialView = useMemo(() => {
    const parsed = parseDate(value);
    if (parsed) return { year: parsed.year, month: parsed.month };
    const parsedMax = parseDate(max ?? '');
    if (parsedMax) return { year: parsedMax.year, month: parsedMax.month };
    return { year: today.year, month: today.month };
  }, [value, max, today.year, today.month]);

  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);
  const [pickerMode, setPickerMode] = useState<'day' | 'year'>('day');

  // 외부 value / 경계가 바뀌면 view를 다시 동기화.
  useEffect(() => {
    setViewYear(initialView.year);
    setViewMonth(initialView.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 팝업이 닫힐 때 view를 value 기준으로 리셋.
  useEffect(() => {
    if (!open) {
      setPickerMode('day');
      setViewYear(initialView.year);
      setViewMonth(initialView.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isOutOfRange = (ymd: string): boolean => {
    if (min && compareYmd(ymd, min) < 0) return true;
    if (max && compareYmd(ymd, max) > 0) return true;
    return false;
  };

  const handleToggle = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange('');
  };

  const handleSelectDay = (day: number) => {
    const ymd = formatDate(viewYear, viewMonth, day);
    if (isOutOfRange(ymd)) return;
    onChange(ymd);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const goPrevMonth = () => {
    setViewMonth((prevMonth) => {
      if (prevMonth === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return prevMonth - 1;
    });
  };

  const goNextMonth = () => {
    setViewMonth((prevMonth) => {
      if (prevMonth === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return prevMonth + 1;
    });
  };

  // 월 단위 버튼이 boundary에 닿았는지 — 비활성화에 사용.
  const isPrevMonthDisabled = useMemo(() => {
    if (!min) return false;
    const firstOfThis = formatDate(viewYear, viewMonth, 1);
    return compareYmd(firstOfThis, min) <= 0;
  }, [min, viewYear, viewMonth]);

  const isNextMonthDisabled = useMemo(() => {
    if (!max) return false;
    const lastOfThis = formatDate(viewYear, viewMonth, daysInMonth(viewYear, viewMonth));
    return compareYmd(lastOfThis, max) >= 0;
  }, [max, viewYear, viewMonth]);

  // 일(day) 그리드 셀 — leading null로 시작 요일 패딩.
  const dayCells = useMemo(() => {
    const startDow = startWeekday(viewYear, viewMonth);
    const totalDays = daysInMonth(viewYear, viewMonth);
    const cells: { day: number | null; ymd: string | null; disabled: boolean }[] = [];
    for (let i = 0; i < startDow; i += 1) {
      cells.push({ day: null, ymd: null, disabled: true });
    }
    for (let d = 1; d <= totalDays; d += 1) {
      const ymd = formatDate(viewYear, viewMonth, d);
      cells.push({ day: d, ymd, disabled: isOutOfRange(ymd) });
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, min, max]);

  // year 그리드 옵션. min/max 사이의 모든 연도. 내림차순(최근→과거)이 출생연도 UX에 친숙.
  const yearOptions = useMemo(() => {
    const minYear = min ? Number(min.split('-')[0]) : 1900;
    const maxYear = max ? Number(max.split('-')[0]) : today.year + 5;
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) years.push(y);
    return years;
  }, [min, max, today.year]);

  const handleSelectYear = (year: number) => {
    setViewYear(year);
    // 선택된 year에 viewMonth가 범위를 벗어나면 가까운 경계 월로 보정.
    if (max && formatDate(year, viewMonth, 1) > max) {
      setViewMonth(Number(max.split('-')[1]));
    } else if (min && formatDate(year, viewMonth, daysInMonth(year, viewMonth)) < min) {
      setViewMonth(Number(min.split('-')[1]));
    }
    setPickerMode('day');
  };

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const parsedValue = parseDate(value);
  const showClear = isClearable && parsedValue && !disabled;

  return (
    <div
      ref={wrapperRef}
      className={cx(styles.root, disabled && styles['root--disabled'], className)}
    >
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={styles.control}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
      >
        <span className={cx(styles.value, !parsedValue && styles['value--placeholder'])}>
          {parsedValue ? formatDisplay(value) : placeholder}
        </span>
        {showClear && (
          <span
            className={styles.clear}
            role="button"
            tabIndex={-1}
            aria-label="선택 해제"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            <X size={14} aria-hidden="true" />
          </span>
        )}
        <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
      </button>

      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label="날짜 선택"
          className={styles.popup}
        >
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={goPrevMonth}
              onKeyDown={handleHeaderKeyDown}
              disabled={isPrevMonthDisabled}
              aria-label="이전 달"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.headerLabel}
              onClick={() =>
                setPickerMode((prev) => (prev === 'year' ? 'day' : 'year'))
              }
              onKeyDown={handleHeaderKeyDown}
              aria-label="연도 선택 모드 전환"
            >
              {viewYear}년 {viewMonth}월
              <ChevronDown size={14} aria-hidden="true" className={styles.headerChevron} />
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={goNextMonth}
              onKeyDown={handleHeaderKeyDown}
              disabled={isNextMonthDisabled}
              aria-label="다음 달"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {pickerMode === 'day' ? (
            <>
              <div className={styles.weekdayRow} aria-hidden="true">
                {WEEKDAY_LABELS.map((wd) => (
                  <span key={wd} className={styles.weekday}>
                    {wd}
                  </span>
                ))}
              </div>
              <div
                role="grid"
                aria-label={`${viewYear}년 ${viewMonth}월`}
                className={styles.dayGrid}
              >
                {dayCells.map((cell, idx) => {
                  if (cell.day === null) {
                    return <span key={`pad-${idx}`} className={styles.dayCellEmpty} />;
                  }
                  const isSelected = cell.ymd === value;
                  const isToday =
                    cell.ymd ===
                    formatDate(today.year, today.month, today.day);
                  return (
                    <button
                      key={cell.ymd}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      className={cx(
                        styles.dayCell,
                        isSelected && styles['dayCell--selected'],
                        isToday && !isSelected && styles['dayCell--today'],
                        cell.disabled && styles['dayCell--disabled']
                      )}
                      disabled={cell.disabled}
                      onClick={() => cell.day && handleSelectDay(cell.day)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <ul className={styles.yearList} role="listbox" aria-label="연도 선택">
              {yearOptions.map((year) => (
                <li key={year}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={year === viewYear}
                    className={cx(
                      styles.yearItem,
                      year === viewYear && styles['yearItem--selected']
                    )}
                    onClick={() => handleSelectYear(year)}
                  >
                    {year}년
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default DatePicker;
