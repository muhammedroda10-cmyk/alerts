import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Header() {
  const { pathname } = useLocation();
  const nav = [
    { href: "/", label: "التبليغات" },
    { href: "/trips", label: "الرحلات" },
  ];
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
          <span className="text-lg font-extrabold tracking-tight">FLY4ALL</span>
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                pathname === item.href && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
