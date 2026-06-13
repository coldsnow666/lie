/**
 * @Description: 像素风选项切换器：用左右箭头切换选项，中间固定展示当前值。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  forwardRef,
  isValidElement,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

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
  const switcherId = id ?? `pixel-select-${generatedId}`;
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
  const availableOptions = options.filter((option) => !option.disabled);

  function commitOption(option: PixelSelectOption) {
    if (disabled || option.disabled) {
      return;
    }

    if (value === undefined) {
      setInternalValue(option.value);
    }

    onChange?.(createChangeEvent(option.value, name));
  }

  function cycleOption(direction: 1 | -1) {
    if (!availableOptions.length) {
      return;
    }

    const currentIndex = Math.max(
      0,
      availableOptions.findIndex((option) => option.value === visibleOption?.value),
    );
    const nextIndex = (currentIndex + direction + availableOptions.length) % availableOptions.length;
    commitOption(availableOptions[nextIndex]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      cycleOption(-1);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cycleOption(1);
    }
  }

  return (
    <div
      className={[
        "lie-pixel-select-switcher relative isolate flex w-full items-center justify-center gap-2",
        disabled ? "lie-pixel-select-switcher-disabled" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        aria-label="上一个选项"
        className={["lie-pixel-select-arrow", indicatorClassName].filter(Boolean).join(" ")}
        disabled={disabled || availableOptions.length <= 1}
        onBlur={onBlur}
        onClick={() => cycleOption(-1)}
        onFocus={onFocus}
      >
        <ChevronLeft size={16} strokeWidth={3.2} />
      </button>
      <button
        id={switcherId}
        ref={(node) => assignRef(ref, node)}
        type="button"
        aria-label={ariaLabel}
        aria-live="polite"
        disabled={disabled}
        onBlur={onBlur}
        onClick={() => cycleOption(1)}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        className={[
          "lie-pixel-select-display min-w-0 flex-1",
          visibleOption?.disabled ? "text-[#ffd4da]/70" : "",
          selectClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {icon ? <span className="lie-pixel-select-icon shrink-0">{icon}</span> : null}
        <span className="truncate">{visibleOption?.label ?? ""}</span>
      </button>
      <button
        type="button"
        aria-label="下一个选项"
        className={["lie-pixel-select-arrow", indicatorClassName].filter(Boolean).join(" ")}
        disabled={disabled || availableOptions.length <= 1}
        onBlur={onBlur}
        onClick={() => cycleOption(1)}
        onFocus={onFocus}
      >
        <ChevronRight size={16} strokeWidth={3.2} />
      </button>

      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
    </div>
  );
});

export default PixelSelect;
