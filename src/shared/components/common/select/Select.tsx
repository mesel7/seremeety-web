'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cx } from '@/shared/lib/classNames';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  // searchable: 메뉴 상단에 검색 input을 노출하고 라벨로 옵션을 필터링한다.
  // 학교/도시같이 옵션이 많은 select에서 사용.
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const TYPE_AHEAD_TIMEOUT_MS = 500;

const Select = ({
  id,
  value,
  onChange,
  options,
  placeholder = '선택',
  disabled,
  isClearable,
  searchable = false,
  searchPlaceholder = '검색',
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: SelectProps) => {
  const reactId = useId();
  const buttonId = id ?? reactId;
  const listId = `${buttonId}-listbox`;
  const searchId = `${buttonId}-search`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [search, setSearch] = useState('');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const typeAheadRef = useRef<{ buffer: string; timer: number }>({ buffer: '', timer: 0 });

  // searchable일 때만 필터링된 옵션을 사용. 그 외에는 원본 그대로.
  const visibleOptions = useMemo(() => {
    if (!searchable || !search.trim()) {
      return options;
    }
    const q = search.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, searchable, search]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const visibleSelectedIndex = useMemo(
    () => visibleOptions.findIndex((option) => option.value === value),
    [visibleOptions, value]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }
    if (searchable) {
      // 입력 필드가 mount된 직후 포커스. 다른 keyboard nav은 input에서 처리.
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    setActiveIndex(visibleSelectedIndex >= 0 ? visibleSelectedIndex : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 필터 결과가 변하면 active index를 첫 항목으로 리셋.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (visibleOptions.length === 0) {
      setActiveIndex(-1);
      return;
    }
    if (activeIndex < 0 || activeIndex >= visibleOptions.length) {
      setActiveIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleOptions.length, open]);

  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) {
      return;
    }
    const item = listRef.current.querySelector<HTMLLIElement>(
      `[data-option-index="${activeIndex}"]`
    );
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const closeAndFocus = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const selectAt = (index: number) => {
    const option = visibleOptions[index];
    if (!option || option.disabled) {
      return;
    }
    onChange(option.value);
    closeAndFocus();
  };

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleClear = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    onChange('');
  };

  const moveActive = (delta: number) => {
    if (visibleOptions.length === 0) {
      return;
    }
    setActiveIndex((prev) => {
      const start = prev < 0 ? 0 : prev;
      let next = start;
      for (let i = 0; i < visibleOptions.length; i += 1) {
        next = (next + delta + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[next].disabled) {
          return next;
        }
      }
      return prev;
    });
  };

  const runTypeAhead = (key: string) => {
    if (key.length !== 1) {
      return false;
    }
    const ta = typeAheadRef.current;
    ta.buffer += key.toLowerCase();
    window.clearTimeout(ta.timer);
    ta.timer = window.setTimeout(() => {
      ta.buffer = '';
    }, TYPE_AHEAD_TIMEOUT_MS);
    const idx = visibleOptions.findIndex(
      (option) => !option.disabled && option.label.toLowerCase().startsWith(ta.buffer)
    );
    if (idx < 0) {
      return false;
    }
    if (open) {
      setActiveIndex(idx);
    } else {
      selectAt(idx);
    }
    return true;
  };

  // 메뉴가 닫힌 상태(button focus) 또는 searchable=false 메뉴 열림 상태에서의 키보드.
  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      runTypeAhead(event.key);
      return;
    }
    // searchable이면 menu 열려 있을 때 button이 포커스 안되므로 여기 안 옴.
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        return;
      case 'Home':
        event.preventDefault();
        setActiveIndex(visibleOptions.findIndex((option) => !option.disabled));
        return;
      case 'End':
        event.preventDefault();
        for (let i = visibleOptions.length - 1; i >= 0; i -= 1) {
          if (!visibleOptions[i].disabled) {
            setActiveIndex(i);
            break;
          }
        }
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeIndex >= 0) {
          selectAt(activeIndex);
        }
        return;
      case 'Escape':
      case 'Tab':
        if (event.key === 'Escape') {
          event.preventDefault();
        }
        setOpen(false);
        return;
    }
    runTypeAhead(event.key);
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        return;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0) {
          selectAt(activeIndex);
        }
        return;
      case 'Escape':
        event.preventDefault();
        closeAndFocus();
        return;
      case 'Tab':
        setOpen(false);
        return;
    }
  };

  const showClear = isClearable && selectedOption && !disabled;

  return (
    <div
      ref={wrapperRef}
      className={cx(styles.root, disabled && styles['root--disabled'], className)}
    >
      <button
        ref={buttonRef}
        type="button"
        id={buttonId}
        className={styles.control}
        onClick={handleToggle}
        onKeyDown={handleButtonKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${buttonId}-option-${activeIndex}` : undefined
        }
      >
        <span className={cx(styles.value, !selectedOption && styles['value--placeholder'])}>
          {selectedOption ? selectedOption.label : placeholder}
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
        <div className={styles.popup}>
          {searchable && (
            <div className={styles.searchRow}>
              <Search size={14} aria-hidden="true" className={styles.searchIcon} />
              <input
                ref={searchInputRef}
                id={searchId}
                type="text"
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className={styles.searchInput}
                aria-label={searchPlaceholder}
                aria-autocomplete="list"
                aria-controls={listId}
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            className={styles.menu}
          >
            {visibleOptions.length === 0 ? (
              <li className={styles.empty} role="status">
                결과가 없어요
              </li>
            ) : (
              visibleOptions.map((option, idx) => (
                <li
                  key={option.value}
                  id={`${buttonId}-option-${idx}`}
                  role="option"
                  data-option-index={idx}
                  aria-selected={visibleSelectedIndex === idx}
                  aria-disabled={option.disabled || undefined}
                  className={cx(
                    styles.option,
                    idx === activeIndex && styles['option--active'],
                    visibleSelectedIndex === idx && styles['option--selected'],
                    option.disabled && styles['option--disabled']
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => !option.disabled && selectAt(idx)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Select;
