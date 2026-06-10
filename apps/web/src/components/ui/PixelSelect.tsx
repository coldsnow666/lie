/**
 * 像素风下拉框：自绘选项浮层，避免原生 option 弹层破坏游戏 UI 质感。
 */
"use client";

import { ChevronDown } from "lucide-react";
import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type PixelSelectOption = {
  disabled: boolean;
  label: string;
  value: string;
};

type PixelSelectValue = string | number | readonly string[];

type PixelSelectProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "defaultValue" | "onChange" | "role" | "size" | "type" | "value"
> & {
  children: ReactNode;
  defaultValue?: PixelSelectValue;
  icon?: ReactNode;
  indicatorClassName?: string;
  name?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  selectClassName?: string;
  value?: PixelSelectValue;
};

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromNode).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }

  return "";
}

function createChangeEvent(value: string, name?: string) {
  return {
    currentTarget: {
      name,
      value,
    },
    target: {
      name,
      value,
    },
  } as ChangeEvent<HTMLSelectElement>;
}

function assignRef(ref: ForwardedRef<HTMLButtonElement>, node: HTMLButtonElement | null) {
  if (typeof ref === "function") {
    ref(node);
    return;
  }

  if (ref) {
    ref.current = node;
  }
}

const PixelSelect = forwardRef<HTMLButtonElement, PixelSelectProps>(function PixelSelect(
  {
    "aria-label": ariaLabel,
    children,
    className = "",
    defaultValue,
    disabled,
    icon,
    id,
    indicatorClassName = "",
    name,
    onBlur,
    onChange,
    onFocus,
    placeholder,
    selectClassName = "",
    value,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const buttonId = id ?? `pixel-select-${generatedId}`;
  const listboxId = `${buttonId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [internalValue, setInternalValue] = useState(() => {
    if (Array.isArray(defaultValue)) {
      return String(defaultValue[0] ?? "");
    }

    return defaultValue === undefined ? "" : String(defaultValue);
  });
  const options = useMemo(() => {
    const parsedOptions = Children.toArray(children)
      .filter((child): child is ReactElement<{ children?: ReactNode; disabled?: boolean; value?: string | number }> =>
        isValidElement(child) && child.type === "option",
      )
      .map((child) => {
        const label = textFromNode(child.props.children);
        return {
          disabled: Boolean(child.props.disabled),
          label,
          value: String(child.props.value ?? label),
        };
      });

    return placeholder
      ? [
          {
            disabled: true,
            label: placeholder,
            value: "",
          },
          ...parsedOptions,
        ]
      : parsedOptions;
  }, [children, placeholder]);
  const currentValue = value === undefined ? internalValue : Array.isArray(value) ? String(value[0] ?? "") : String(value);
  const selectedOption = options.find((option) => option.value === currentValue);
  const visibleOption = selectedOption ?? options.find((option) => !option.disabled) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateDropdownPosition() {
      const rootRect = rootRef.current?.getBoundingClientRect();
      if (!rootRect) {
        return;
      }

      const gap = 8;
      const maxListHeight = 224;
      const spaceBelow = window.innerHeight - rootRect.bottom - gap;
      const spaceAbove = rootRect.top - gap;
      const openUpward = spaceBelow < 132 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(96, Math.min(maxListHeight, openUpward ? spaceAbove : spaceBelow));

      setDropdownStyle({
        left: rootRect.left,
        maxHeight: availableHeight,
        top: openUpward ? rootRect.top - gap - availableHeight : rootRect.bottom + gap,
        width: rootRect.width,
      });
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const selectedIndex = options.findIndex((option) => option.value === currentValue && !option.disabled);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, options.findIndex((option) => !option.disabled)));
  }, [currentValue, open, options]);

  function commitOption(option: PixelSelectOption) {
    if (disabled || option.disabled) {
      return;
    }

    if (value === undefined) {
      setInternalValue(option.value);
    }

    onChange?.(createChangeEvent(option.value, name));
    setOpen(false);
  }

  function moveHighlight(direction: 1 | -1) {
    if (!options.length) {
      return;
    }

    let nextIndex = highlightedIndex;
    for (let step = 0; step < options.length; step += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }

      moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }

      const option = options[highlightedIndex];
      if (option) {
        commitOption(option);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const optionList = open && dropdownStyle
    ? createPortal(
        <div
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          aria-labelledby={buttonId}
          className="lie-pixel-select-dropdown fixed z-[100] overflow-y-auto bg-[#17282b] p-2 shadow-[-4px_7px_0_#101a1d]"
          style={dropdownStyle}
        >
          {options.map((option, index) => {
            const selected = option.value === currentValue;
            const highlighted = index === highlightedIndex;

            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => commitOption(option)}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setHighlightedIndex(index);
                  }
                }}
                className={[
                  "block min-h-10 w-full border-2 px-3 py-2 text-left text-sm font-black tracking-[0.08em] transition-colors",
                  option.disabled ? "cursor-not-allowed border-transparent text-[#8ea19b]" : "cursor-pointer text-[#fff6cf]",
                  selected || highlighted
                    ? "border-[#ffe7a8] bg-[#d48516] text-[#fff9e8] shadow-[inset_0_0_0_2px_rgba(23,37,31,0.32)]"
                    : "border-transparent bg-[#17282b] hover:border-[#d7bc72] hover:bg-[#243d3d]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={[
        "relative isolate w-full overflow-visible",
        open ? "z-50" : "z-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        data-disabled={disabled ? "true" : undefined}
        className="lie-pixel-input relative isolate flex h-14 w-full items-center gap-3 px-4 text-[#fff6cf] transition-colors"
      >
        {icon ? <span className="lie-pixel-input-icon shrink-0 text-[#d7bc72]">{icon}</span> : null}
        <button
          id={buttonId}
          ref={(node) => {
            triggerRef.current = node;
            assignRef(ref, node);
          }}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onBlur={onBlur}
          onClick={() => setOpen((current) => !current)}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
          className={[
            "relative z-10 flex h-full min-w-0 flex-1 cursor-pointer items-center border-0 bg-transparent p-0 pr-8 text-left text-[#fff6cf] outline-none disabled:cursor-not-allowed",
            selectClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          <span className={visibleOption?.disabled ? "truncate text-[#8ea19b]" : "truncate"}>{visibleOption?.label ?? ""}</span>
        </button>
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute right-4 z-10 inline-flex items-center text-[#d7bc72] transition-transform",
            open ? "rotate-180" : "",
            indicatorClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ChevronDown size={18} />
        </span>
      </div>

      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      {optionList}
    </div>
  );
});

export default PixelSelect;
