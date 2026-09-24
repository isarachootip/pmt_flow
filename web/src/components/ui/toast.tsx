import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      duration={4000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--text-secondary)]',
          actionButton:
            'group-[.toast]:bg-[var(--primary)] group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-[var(--bg-subtle)] group-[.toast]:text-[var(--text-secondary)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
