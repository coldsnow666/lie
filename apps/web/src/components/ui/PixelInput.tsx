/**
 * 像素风输入框：统一表单输入的图标、像素边框、焦点态和自动填充样式。
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type PixelInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  icon?: ReactNode;
  inputClassName?: string;
};

const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(function PixelInput(
  {
    className = "",
    icon,
    inputClassName = "",
    disabled,
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
      <input
        ref={ref}
        disabled={disabled}
        className={[
          "lie-pixel-input-control relative z-10 h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[#fff6cf] outline-none placeholder:text-[#9eb0a4] disabled:cursor-not-allowed",
          inputClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    </div>
  );
});

export default PixelInput;
