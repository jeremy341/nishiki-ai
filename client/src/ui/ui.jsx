import { useEdgeBack } from "./edgeBack.js";
import { t } from "../i18n/index.js";
// Shared building blocks. Radix handles focus and keyboard for dialogs, menus, tabs and
// switches. Styling is restrained: 6px controls, 8px cards, 12px dialogs, pills only for
// badges and switches, hairline borders instead of shadows. Nothing here is rounder than 12px.
import { useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ArrowLeft, X } from "lucide-react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg";
// The same ring drawn inside the element, for tabs that sit in a clipped scroll row.
const FOCUS_INSET = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg";

const BUTTON_VARIANT = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-raised",
  ghost: "text-fg-muted hover:bg-raised hover:text-fg",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};

const BUTTON_SIZE = {
  sm: "h-8 rounded-md px-3 text-label",
  md: "h-9 rounded-md px-3.5 text-sm",
  lg: "h-10 rounded-md px-4 text-[15px]",
};

export function Button({ variant = "secondary", size = "md", className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "pressable inline-flex items-center justify-center gap-2 font-medium",
        "disabled:pointer-events-none", FOCUS,
        BUTTON_VARIANT[variant], BUTTON_SIZE[size], className,
      )}
      {...props}
    />
  );
}

// Icon button. The default is 36px; pass className="size-11" for a 44px touch target.
export function IconButton({ label, active = false, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        // A size passed in replaces the default size (both classes would fight in the stylesheet).
        /\bsize-/.test(className || "") ? "" : "size-9",
        "pressable grid shrink-0 place-items-center rounded-md disabled:pointer-events-none",
        FOCUS,
        active ? "bg-raised text-fg" : "text-fg-muted hover:bg-raised hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("grid gap-1.5", className)}>
      {label && <span className="text-label font-medium text-fg-muted">{label}</span>}
      {children}
      {hint && <span className="text-caption text-fg-subtle">{hint}</span>}
    </label>
  );
}

// 44px tall with 16px text on phones (iOS does not zoom on focus), 36px with 14px from md up.
const FIELD = "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-base md:h-9 md:text-sm "
  + "placeholder:text-fg-subtle transition-colors duration-150 hover:border-fg-subtle "
  + "focus:border-fg focus:outline-none focus:ring-1 focus:ring-fg disabled:opacity-50";

export function Input({ className, ...props }) {
  return <input className={cx(FIELD, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return <select className={cx(FIELD, "pr-8", className)} {...props}>{children}</select>;
}

export function Switch({ checked, onCheckedChange, label, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 has-[:disabled]:cursor-default">
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-raised ring-1 ring-inset ring-border-strong transition-colors duration-150",
          "data-[state=checked]:bg-accent data-[state=checked]:ring-transparent disabled:opacity-40", FOCUS,
        )}
      >
        <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-fg-muted transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg" />
      </SwitchPrimitive.Root>
      <span className="text-sm leading-5 text-fg">{label}</span>
    </label>
  );
}

// Underlined tabs: a 2px accent line under the current tab, a hairline under the whole row.
export function Tabs({ value, onValueChange, items, className }) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      <TabsPrimitive.List className="flex gap-5 overflow-x-auto border-b border-border" aria-label={t("Sections")}>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cx(
              "relative -mb-px h-10 shrink-0 whitespace-nowrap border-b-2 border-transparent text-sm text-fg-muted transition-colors duration-150",
              "hover:text-fg data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-fg", FOCUS_INSET,
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

// Settings and other panels: a bottom sheet on phones, a centred 12px dialog on wider screens.
export function Sheet({ open, onOpenChange, title, description, children, footer, wide = false }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="motion-overlay fixed inset-0 z-40 bg-scrim" />
        <DialogPrimitive.Content
          className={cx(
            "motion-sheet fixed z-50 flex flex-col bg-overlay text-fg outline-none",
            "inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),12px)] rounded-t-xl border-t border-border-strong",
            "md:inset-auto md:left-1/2 md:top-1/2 md:h-auto md:max-h-[min(680px,86vh)] md:w-[min(92vw,720px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
            wide && "md:w-[min(94vw,920px)]",
          )}
        >
          <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-2">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold tracking-tight">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-label text-fg-muted">{description}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label={t("Close")}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
          {footer && <footer className="shrink-0 border-t border-border px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// A menu from a trigger button: the account menu and the per-chat menu. Hairline border, no shadow.
export function Menu({ trigger, children, align = "end" }) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={6}
          className="motion-menu z-50 min-w-[200px] rounded-lg border border-border-strong bg-overlay p-1 text-fg outline-none"
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export function MenuItem({ icon: Icon, children, onSelect, destructive = false, checked }) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      className={cx(
        "flex h-8 cursor-pointer select-none items-center gap-2.5 rounded px-2 text-sm outline-none",
        "data-[highlighted]:bg-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        destructive && "text-danger",
      )}
    >
      {Icon && <Icon size={16} aria-hidden="true" className="shrink-0 text-fg-muted" />}
      <span className="flex-1">{children}</span>
      {checked !== undefined && <span className="text-caption text-fg-subtle">{checked ? t("On") : t("Off")}</span>}
    </DropdownPrimitive.Item>
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-border" />;
}

// Small centred dialog for a question or a short form (rename, delete, confirm).
export function Modal({ open, onOpenChange, title, description, children, footer }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="motion-overlay fixed inset-0 z-40 bg-scrim" />
        <DialogPrimitive.Content className="motion-dialog fixed left-1/2 top-1/2 z-50 max-h-[86dvh] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border-strong bg-overlay p-5 text-fg outline-none">
          <DialogPrimitive.Title className="text-base font-semibold tracking-tight">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="mt-1.5 text-label text-fg-muted">{description}</DialogPrimitive.Description>}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Pills are kept for badges only.
export function Badge({ tone = "neutral", children }) {
  return (
    <span className={cx(
      "inline-flex items-center rounded-full border px-2 py-px text-caption font-medium",
      tone === "neutral" && "border-border-strong text-fg-muted",
      tone === "danger" && "border-danger/40 text-danger",
      tone === "accent" && "border-transparent bg-accent text-accent-fg",
    )}>
      {children}
    </span>
  );
}

export function Card({ className, children }) {
  return <div className={cx("rounded-lg border border-border bg-surface", className)}>{children}</div>;
}

// Full-page screen for settings and calendar (not a modal). Esc or the back arrow leaves it.
export function FullPage({ title, onBack, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEdgeBack(ref, onBack ?? onClose);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") (onBack ?? onClose)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onClose]);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none animate-enter"
    >
      {/* Close (or back) on the left, the title centred, nothing on the right; a hairline under the header. */}
      <header className="grid h-14 shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-border px-3">
        {onBack ? (
          <IconButton label={t("Back")} onClick={onBack} className="size-11 md:size-9">
            <ArrowLeft size={19} aria-hidden="true" />
          </IconButton>
        ) : (
          <IconButton label={t("Close")} onClick={onClose} className="size-11 md:size-9">
            <X size={19} aria-hidden="true" />
          </IconButton>
        )}
        <h2 className="truncate text-center text-base font-semibold">{title}</h2>
        <span aria-hidden="true" />
      </header>
      <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-10 md:px-6">
        <div className={`mx-auto py-5 ${wide ? "max-w-5xl" : "max-w-xl"}`}>{children}</div>
      </div>
    </section>
  );
}
