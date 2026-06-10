/**
 * 像素风下拉框：复用输入框外壳，统一图标、箭头和原生 select 的像素表单质感。
 */
import { ChevronDown } from "lucide-react";
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

type PixelSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  icon?: ReactNode;
  selectClassName?: string;
  indicatorClassName?: string;
  placeholder?: string;
};

const PixelSelect = forwardRef<HTMLSelectElement, PixelSelectProps>(function PixelSelect(
  {
    children,
    className = "",
    disabled,
    icon,
    indicatorClassName = "",
    placeholder,
    selectClassName = "",
    ...props
  },
  ref,
) {
  return (
    <div
      data-disabled={disabled ? "true" : undefined}
      className={[
        "lie-pixel-input relative isolate flex h-14 w-full items-center gap-3 px-4 text-[#fff6cf] transition-colors",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <span className="lie-pixel-input-icon shrink-0 text-[#d7bc72]">{icon}</span> : null}
      <select
        ref={ref}
        disabled={disabled}
        className={[
          "lie-pixel-input-control relative z-10 h-full min-w-0 flex-1 border-0 bg-transparent p-0 pr-8 text-[#fff6cf] outline-none disabled:cursor-not-allowed",
          selectClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute right-4 z-10 inline-flex items-center text-[#d7bc72]",
          indicatorClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <ChevronDown size={18} />
      </span>
    </div>
  );
});

export default PixelSelect;
